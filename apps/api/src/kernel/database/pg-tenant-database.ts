import type { SessionSettings } from '../context/request-context.js';
import { contextStatement, type SqlClient, type TenantDatabase } from './sql.js';

/**
 * Forma mínima de un pool de `pg` (node-postgres). Se declara aquí para que el kernel
 * no dependa de la librería: cualquier `pg.Pool` la cumple.
 */
export interface PgPoolLike {
  connect(): Promise<PgPoolClientLike>;
}
export interface PgPoolClientLike extends SqlClient {
  release(error?: Error | boolean): void;
}

/**
 * Transacciones con RLS: BEGIN → SET LOCAL del contexto → trabajo → COMMIT.
 * SET LOCAL muere con la transacción, así que una conexión reciclada del pool
 * nunca arrastra el contexto de otro laboratorio.
 */
export class PgTenantDatabase implements TenantDatabase {
  constructor(private readonly pool: PgPoolLike) {}

  async transaction<T>(settings: SessionSettings, work: (tx: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let broken = false;
    try {
      await client.query('BEGIN');
      const ctx = contextStatement(settings);
      await client.query(ctx.text, ctx.params);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        broken = true; // conexión en mal estado: el pool la descarta
      }
      throw error;
    } finally {
      client.release(broken);
    }
  }
}
