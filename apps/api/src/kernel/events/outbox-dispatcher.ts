import type { PgPoolLike } from '../database/pg-tenant-database.js';

/** Evento tal como sale del outbox hacia las colas. */
export interface PublishedEvent {
  readonly id: string;
  readonly laboratoryId: string;
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;
  readonly requestId: string | null;
  readonly occurredAt: string;
}

/** Destino de los eventos (BullMQ en producción; una lista en memoria en las pruebas). */
export interface EventPublisher {
  publish(event: PublishedEvent): Promise<void>;
}

interface OutboxRow {
  id: string;
  laboratory_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  request_id: string | null;
  occurred_at: string;
}

/**
 * Lee eventos pendientes del outbox y los publica. Corre con el rol microslab_dispatcher,
 * que ve la cola de todos los laboratorios pero ningún dato clínico.
 * - SKIP LOCKED permite varios despachadores en paralelo sin publicar dos veces el mismo lote.
 * - Si publicar falla, el evento queda pendiente con el error y se reintenta (entrega al menos una vez;
 *   los consumidores deben ser idempotentes usando el id del evento).
 */
export class OutboxDispatcher {
  constructor(
    private readonly pool: PgPoolLike,
    private readonly publisher: EventPublisher,
    private readonly batchSize = 100,
    private readonly maxAttempts = 10,
  ) {}

  /** Publica un lote. Devuelve cuántos eventos se publicaron. */
  async dispatchOnce(): Promise<number> {
    const client = await this.pool.connect();
    let published = 0;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OutboxRow>(
        `SELECT id, laboratory_id, event_type, aggregate_type, aggregate_id, payload, request_id, occurred_at
           FROM kernel.outbox_events
          WHERE published_at IS NULL AND attempts < $1
          ORDER BY occurred_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [this.maxAttempts, this.batchSize],
      );
      for (const row of rows) {
        try {
          await this.publisher.publish({
            id: row.id,
            laboratoryId: row.laboratory_id,
            type: row.event_type,
            aggregateType: row.aggregate_type,
            aggregateId: row.aggregate_id,
            payload: row.payload,
            requestId: row.request_id,
            occurredAt: String(row.occurred_at),
          });
          await client.query(
            'UPDATE kernel.outbox_events SET published_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1',
            [row.id],
          );
          published++;
        } catch (error) {
          await client.query(
            'UPDATE kernel.outbox_events SET attempts = attempts + 1, last_error = $2 WHERE id = $1',
            [row.id, error instanceof Error ? error.message.slice(0, 500) : 'error desconocido'],
          );
        }
      }
      await client.query('COMMIT');
      return published;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
