import mediasoup from 'mediasoup';
import os from 'os';

let workers = [];
let nextMediasoupWorkerIdx = 0;

export const config = {
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
        },
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        // In production, you might want to dynamically get the public IP or use a known public IP
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null, 
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },
};

export async function createWorkers() {
  const numWorkers = Object.keys(os.cpus()).length;
  console.log(`[mediasoup] Starting ${numWorkers} workers`);

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(config.worker);

    worker.on('died', () => {
      console.error(`[mediasoup] worker died [pid:${worker.pid}]`);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }
}

export function getWorker() {
  const worker = workers[nextMediasoupWorkerIdx];
  nextMediasoupWorkerIdx = (nextMediasoupWorkerIdx + 1) % workers.length;
  return worker;
}

export async function createRouter() {
  const worker = getWorker();
  return await worker.createRouter({ mediaCodecs: config.router.mediaCodecs });
}

export async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport(config.webRtcTransport);

  transport.on('dtlsstatechange', dtlsState => {
    if (dtlsState === 'closed') transport.close();
  });

  transport.on('routerclose', () => {
    transport.close();
  });

  return transport;
}
