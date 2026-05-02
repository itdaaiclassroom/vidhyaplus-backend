import mediasoup from 'mediasoup';
import os from 'os';

let workers = [];
let nextWorkerIdx = 0;

export const config = {
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls'],
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
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  },
};

export async function createWorkers() {
  const num = Math.min(os.cpus().length, 2);

  for (let i = 0; i < num; i++) {
    const worker = await mediasoup.createWorker(config.worker);

    worker.on('died', () => {
      console.error('Worker died');
      process.exit(1);
    });

    workers.push(worker);
  }

  console.log(`Workers started: ${workers.length}`);
}

function getWorker() {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
}

export async function createRouter() {
  const worker = getWorker();
  return worker.createRouter({ mediaCodecs: config.router.mediaCodecs });
}

export async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport(config.webRtcTransport);

  transport.on('dtlsstatechange', (state) => {
    if (state === 'closed') transport.close();
  });

  return transport;
}