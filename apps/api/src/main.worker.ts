import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { OutboxDispatcher, type PublishedEvent } from './kernel/index.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

/**
 * Proceso en segundo plano de la Fase 0: publica el outbox en colas BullMQ, una por módulo.
 * Los consumidores (PDF, notificaciones, comisiones, reglas, IA...) se agregan en sus fases.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  if (!config.DATABASE_URL_DISPATCHER) throw new Error('Falta DATABASE_URL_DISPATCHER');

  const pool = new pg.Pool({ connectionString: config.DATABASE_URL_DISPATCHER, max: 2 });
  const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const queues = new Map<string, Queue>();
  const queueFor = (module: string) => {
    let q = queues.get(module);
    if (!q) {
      q = new Queue(`events-${module}`, { connection });
      queues.set(module, q);
    }
    return q;
  };

  const dispatcher = new OutboxDispatcher(pool, {
    publish: async (event: PublishedEvent) => {
      const module = event.type.split('.')[0]!;
      // jobId = id del evento: si el despachador reintenta, BullMQ no duplica el trabajo.
      await queueFor(module).add(event.type, event, { jobId: event.id, removeOnComplete: 1000 });
    },
  });

  let running = true;
  const stop = () => {
    running = false;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  logger.info('Despachador del outbox iniciado');
  while (running) {
    const published = await dispatcher.dispatchOnce().catch((error: unknown) => {
      logger.error({ err: error }, 'Error despachando el outbox');
      return 0;
    });
    if (published === 0) await new Promise((r) => setTimeout(r, 500));
  }
  await Promise.all([...queues.values()].map((q) => q.close()));
  await connection.quit();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
