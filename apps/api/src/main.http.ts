import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './http/app.module.js';
import { DomainErrorFilter } from './http/filters/domain-error.filter.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new DomainErrorFilter());
  app.enableShutdownHooks();
  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'API de MICROSLAB escuchando');
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
