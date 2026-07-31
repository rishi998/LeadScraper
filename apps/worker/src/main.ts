import { connectMongo, disconnectMongo } from '@leadintel/database';
import { MongoJobQueue } from '@leadintel/job-queue';
import { WORKER_DEFAULTS } from '@leadintel/shared';
import pino from 'pino';
import { loadWorkerConfig, WorkerLoop } from './worker-loop';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  await connectMongo(process.env.MONGODB_URI);
  logger.info({ workerId: process.env.WORKER_ID ?? `worker-${process.pid}` }, 'database connected');

  const config = loadWorkerConfig();
  const queue = new MongoJobQueue({
    maxAttempts: Number(process.env.WORKER_MAX_ATTEMPTS ?? WORKER_DEFAULTS.maxAttempts),
  });

  logger.info(
    {
      workerId: config.workerId,
      concurrency: config.concurrency,
      pollIntervalMs: config.pollIntervalMs,
      lockTimeoutMs: config.lockTimeoutMs,
      queue: 'mongodb',
    },
    'LeadIntel worker starting (MongoDB job queue)',
  );

  const loop = new WorkerLoop(queue, config);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'received shutdown signal');
    await loop.stop();
    await disconnectMongo();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await loop.start();
}

main().catch((err) => {
  logger.error(err, 'worker failed to start');
  process.exit(1);
});
