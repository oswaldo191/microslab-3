/**
 * Solo para pruebas: un "pool" con la misma forma que `pg.Pool`, implementado sobre el cliente psql.
 * Permite probar PgTenantDatabase y la tubería de comandos contra un PostgreSQL real
 * sin instalar librerías. Cada connect() abre una sesión psql propia.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { PgPoolClientLike, PgPoolLike, QueryResult } from '../../src/kernel/index.js';

const MARK = '__MS_END__';

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${text.replaceAll("'", "''")}'`;
}

export function inline(text: string, params: readonly unknown[] = []): string {
  return text.replace(/\$(\d+)/g, (_, n: string) => literal(params[Number(n) - 1]));
}

class PsqlSession implements PgPoolClientLike {
  private stdout = '';
  private stderr = '';
  private readonly proc: ChildProcessWithoutNullStreams;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(url: string) {
    this.proc = spawn('psql', [url, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=0'], {
      stdio: 'pipe',
    });
    this.proc.stdout.setEncoding('utf8').on('data', (d: string) => (this.stdout += d));
    this.proc.stderr.setEncoding('utf8').on('data', (d: string) => (this.stderr += d));
  }

  query<R = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<R>> {
    const run = this.queue.then(() => this.run<R>(text, params));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run<R>(text: string, params: readonly unknown[]): Promise<QueryResult<R>> {
    const sql = inline(text, params).trim().replace(/;\s*$/, '');
    const returnsRows = /^(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql);
    const statement = returnsRows
      ? `WITH __q AS (${sql}) SELECT coalesce(json_agg(__q), '[]'::json) FROM __q;`
      : `${sql};`;
    this.stdout = '';
    this.stderr = '';
    this.proc.stdin.write(`${statement}\n\\echo ${MARK} :ERROR :SQLSTATE\n`);

    const line = await this.waitFor(() => this.stdout.split('\n').find((l) => l.startsWith(MARK)));
    const [, failed, sqlstate] = line.split(' ');
    if (failed === 'true') {
      await this.waitFor(() => (this.stderr.includes('ERROR') ? true : undefined), 1000).catch(
        () => undefined,
      );
      const message = this.stderr.split('\n').find((l) => l.includes('ERROR')) ?? 'error de psql';
      throw Object.assign(new Error(message.replace(/^.*ERROR:\s*/, '')), { code: sqlstate });
    }
    if (!returnsRows) return { rows: [], rowCount: null };
    const body = this.stdout.slice(0, this.stdout.indexOf(MARK)).trim();
    const rows = JSON.parse(body || '[]') as R[];
    return { rows, rowCount: rows.length };
  }

  private waitFor<T>(probe: () => T | undefined, timeoutMs = 10_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const value = probe();
        if (value !== undefined) return resolve(value);
        if (Date.now() - started > timeoutMs)
          return reject(new Error(`psql no respondió: ${this.stderr}`));
        setTimeout(tick, 2);
      };
      tick();
    });
  }

  release(): void {
    this.proc.stdin.end('\\q\n');
  }
}

export class PsqlPool implements PgPoolLike {
  constructor(private readonly url: string) {}
  async connect(): Promise<PgPoolClientLike> {
    return new PsqlSession(this.url);
  }
}
