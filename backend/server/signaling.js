import { Server } from 'socket.io';
import { createRouter, createWebRtcTransport } from './mediasoup.js';

// Map of roomId -> { router, teacherProducer: { audio, video }, transports: Set, consumers: Set }
const rooms = new Map();

// Map of transportId -> transport
const transports = new Map();

// Map of producerId -> producer
const producers = new Map();

// Map of consumerId -> consumer
const consumers = new Map();

export function setupSignaling(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // allow all in dev, should restrict in prod
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    // --- Common ---
    
    socket.on('disconnect', () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
      // Cleanup transports/producers/consumers associated with this socket
      if (socket.transportIds) {
        socket.transportIds.forEach(id => {
          const transport = transports.get(id);
          if (transport) transport.close();
          transports.delete(id);
        });
      }
      if (socket.producerIds) {
        socket.producerIds.forEach(id => {
          const producer = producers.get(id);
          if (producer) producer.close();
          producers.delete(id);
        });
      }
      if (socket.consumerIds) {
        socket.consumerIds.forEach(id => {
          const consumer = consumers.get(id);
          if (consumer) consumer.close();
          consumers.delete(id);
        });
      }
    });

    socket.on('get-turn-credentials', (data, callback) => {
      // Return standard coturn credentials
      // In production, these should be securely generated via REST API or secret.
      callback({
        iceServers: [
          {
            urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
          },
          {
            urls: process.env.TURN_SERVER_URL || 'turn:your-coturn-server.com:3478',
            username: process.env.TURN_SERVER_USER || 'turnuser',
            credential: process.env.TURN_SERVER_PASSWORD || 'turnpassword'
          }
        ]
      });
    });

    socket.on('get-router-rtp-capabilities', async ({ roomId }, callback) => {
      console.log(`[socket] get-router-rtp-capabilities for room: ${roomId}`);
      try {
        let room = rooms.get(roomId);
        if (!room) {
          console.log(`[socket] Creating new router for room: ${roomId}`);
          const router = await createRouter();
          room = {
            router,
            teacherProducers: {},
            transports: new Set(),
            consumers: new Set()
          };
          rooms.set(roomId, room);
        }
        callback({ rtpCapabilities: room.router.rtpCapabilities });
      } catch (err) {
        console.error('[socket] get-router-rtp-capabilities error:', err);
        callback({ error: err.message });
      }
    });

    socket.on('create-webrtc-transport', async ({ roomId }, callback) => {
      console.log(`[socket] create-webrtc-transport for room: ${roomId}`);
      try {
        const room = rooms.get(roomId);
        if (!room) throw new Error(`Room ${roomId} not found`);

        const transport = await createWebRtcTransport(room.router);
        console.log(`[socket] Transport created: ${transport.id}`);
        
        transports.set(transport.id, transport);
        room.transports.add(transport.id);

        if (!socket.transportIds) socket.transportIds = new Set();
        socket.transportIds.add(transport.id);

        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          }
        });
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    });

    socket.on('connect-transport', async ({ transportId, dtlsParameters }, callback) => {
      try {
        const transport = transports.get(transportId);
        if (!transport) throw new Error(`Transport ${transportId} not found`);

        await transport.connect({ dtlsParameters });
        callback({ success: true });
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    });

    // --- Teacher Flow ---

    socket.on('start-stream', ({ roomId, schoolId, classId, sectionId, teacherId }, callback) => {
      // In a real app, verify teacher permissions here
      console.log(`[live-class] Teacher ${teacherId} starting stream for ${roomId}`);
      callback({ success: true });
    });

    socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, callback) => {
      try {
        const room = rooms.get(roomId);
        if (!room) throw new Error(`Room ${roomId} not found`);

        const transport = transports.get(transportId);
        if (!transport) throw new Error(`Transport ${transportId} not found`);

        const producer = await transport.produce({ kind, rtpParameters });
        
        producers.set(producer.id, producer);
        if (!socket.producerIds) socket.producerIds = new Set();
        socket.producerIds.add(producer.id);

        room.teacherProducers[kind] = producer.id;

        // Notify admins in the room that a new producer is available
        socket.to(roomId).emit('new-producer', { producerId: producer.id, kind });

        callback({ id: producer.id });
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    });

    socket.on('stop-stream', ({ roomId }, callback) => {
      console.log(`[live-class] Stream stopped for room ${roomId}`);
      const room = rooms.get(roomId);
      if (room) {
        // Clean up room resources
        room.router.close();
        rooms.delete(roomId);
        io.to(roomId).emit('stream-stopped');
      }
      if (callback) callback({ success: true });
    });

    // --- Admin Flow ---

    socket.on('watch-stream', ({ roomId }, callback) => {
      console.log(`[live-class] Admin joining stream for ${roomId}`);
      socket.join(roomId);
      
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ error: 'No active stream for this class' });
      }

      // Return active producers
      callback({ 
        success: true, 
        producerIds: Object.values(room.teacherProducers) 
      });
    });

    socket.on('consume', async ({ roomId, transportId, producerId, rtpCapabilities }, callback) => {
      try {
        const room = rooms.get(roomId);
        if (!room) throw new Error(`Room ${roomId} not found`);

        const transport = transports.get(transportId);
        if (!transport) throw new Error(`Transport ${transportId} not found`);

        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error('Cannot consume');
        }

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true, // start paused, resume after client handles SDP
        });

        consumers.set(consumer.id, consumer);
        if (!socket.consumerIds) socket.consumerIds = new Set();
        socket.consumerIds.add(consumer.id);
        room.consumers.add(consumer.id);

        consumer.on('transportclose', () => {
          consumer.close();
        });
        
        consumer.on('producerclose', () => {
          socket.emit('producer-closed', { producerId });
          consumer.close();
        });

        callback({
          params: {
            id: consumer.id,
            producerId: producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters
          }
        });
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    });

    socket.on('resume-consumer', async ({ consumerId }, callback) => {
      try {
        const consumer = consumers.get(consumerId);
        if (!consumer) throw new Error(`Consumer ${consumerId} not found`);

        await consumer.resume();
        callback({ success: true });
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    });

  });
}
