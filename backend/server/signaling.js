import { Server } from 'socket.io';
import { createRouter, createWebRtcTransport } from './mediasoup.js';

const rooms = new Map();
const transports = new Map();
const producers = new Map();
const consumers = new Map();

export function setupSignaling(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('connected:', socket.id);

    // ---------------- COMMON ----------------

    socket.on('disconnect', () => {
      socket.transportIds?.forEach(id => {
        transports.get(id)?.close();
        transports.delete(id);
      });

      socket.producerIds?.forEach(id => {
        producers.get(id)?.close();
        producers.delete(id);
      });

      socket.consumerIds?.forEach(id => {
        consumers.get(id)?.close();
        consumers.delete(id);
      });
    });

    socket.on('get-router-rtp-capabilities', async ({ roomId }, cb) => {
      let room = rooms.get(roomId);

      if (!room) {
        const router = await createRouter();
        room = {
          router,
          teacherProducers: {}
        };
        rooms.set(roomId, room);
      }

      cb({ rtpCapabilities: room.router.rtpCapabilities });
    });

    socket.on('create-webrtc-transport', async ({ roomId }, cb) => {
      const room = rooms.get(roomId);
      const transport = await createWebRtcTransport(room.router);

      transports.set(transport.id, transport);

      socket.transportIds ??= new Set();
      socket.transportIds.add(transport.id);

      cb({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        }
      });
    });

    socket.on('connect-transport', async ({ transportId, dtlsParameters }, cb) => {
      await transports.get(transportId).connect({ dtlsParameters });
      cb({ success: true });
    });

    // ---------------- TEACHER ----------------

    socket.on('start-stream', ({ roomId }, cb) => {
      socket.join(roomId); // 🔥 REQUIRED
      cb({ success: true });
    });

    socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, cb) => {
      const room = rooms.get(roomId);
      const transport = transports.get(transportId);

      const producer = await transport.produce({ kind, rtpParameters });

      producers.set(producer.id, producer);

      socket.producerIds ??= new Set();
      socket.producerIds.add(producer.id);

      room.teacherProducers[kind] = producer.id;

      socket.to(roomId).emit('new-producer', {
        producerId: producer.id,
        kind
      });

      cb({ id: producer.id });
    });

    socket.on('stop-stream', ({ roomId }) => {
      io.to(roomId).emit('stream-stopped');
      rooms.get(roomId)?.router.close();
      rooms.delete(roomId);
    });

    // ---------------- ADMIN ----------------

    socket.on('watch-stream', ({ roomId }, cb) => {
      socket.join(roomId);

      const room = rooms.get(roomId);
      if (!room) return cb({ error: 'No stream' });

      cb({
        producerIds: Object.values(room.teacherProducers)
      });
    });

    socket.on('consume', async ({ roomId, transportId, producerId, rtpCapabilities }, cb) => {
      const room = rooms.get(roomId);
      const transport = transports.get(transportId);

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        return cb({ error: 'cannot consume' });
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      consumers.set(consumer.id, consumer);

      socket.consumerIds ??= new Set();
      socket.consumerIds.add(consumer.id);

      cb({
        params: {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters
        }
      });
    });

    socket.on('resume-consumer', async ({ consumerId }, cb) => {
      await consumers.get(consumerId).resume();
      cb({ success: true });
    });
  });
}