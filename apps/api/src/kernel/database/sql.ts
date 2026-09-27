import type { SessionSettings } from '../context/request-context.js';

/** Resultado mínimo de una consulta. Compatible con `pg`. */
export interface QueryResult<R> {
  readonly rows: R[];
  readonly rowCount: number | null;
}

/** Cliente dentro de una transacción. Los parámetros van posicionales ($1, $2...). */
export interface SqlClient {
  query<R = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<QueryResult<R>>;
}

/**
 * Abre transacciones con el contexto del laboratorio ya fijado.
 * Es la única forma de tocar datos de laboratorio: no existe una conexión "sin contexto".
 */
export interface TenantDatabase {
  transaction<T>(settings: SessionSettings, work: (tx: SqlClient) => Promise<T>): Promise<T>;
}

/** Sentencia que fija el contexto: un solo viaje a la base, con parámetros (sin interpolar texto). */
export function contextStatement(settings: SessionSettings): { text: string; params: string[] } {
  const keys = Object.keys(settings) as (keyof SessionSettings)[];
  const calls = keys.map((_, i) => `set_config($${i * 2 + 1}, $${i * 2 + 2}, true)`);
  const params = keys.flatMap((k) => [k, settings[k]]);
  return { text: `SELECT ${calls.join(', ')}`, params };
}
