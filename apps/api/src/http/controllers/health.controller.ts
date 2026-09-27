import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../tokens.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async check(): Promise<{ status: 'ok'; database: 'ok' }> {
    await this.pool.query('SELECT 1');
    return { status: 'ok', database: 'ok' };
  }
}
