import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { connectMongo } from '@leadintel/database';
import { AppModule } from './app.module';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

async function bootstrap() {
  await connectMongo(process.env.MONGODB_URI);
  logger.info({ db: process.env.MONGODB_DB_NAME ?? 'default' }, 'MongoDB connected');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, process.env.API_HOST ?? '0.0.0.0');
  logger.info({ port }, 'LeadIntel API listening');
}

bootstrap().catch((err) => {
  logger.error(err, 'API failed to start');
  process.exit(1);
});
