import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import pg from 'pg';
import { CommandBus, PgTenantDatabase } from '../kernel/index.js';
import { loadConfig, type AppConfig } from '../config.js';
import { BranchesController } from './controllers/branches.controller.js';
import { HealthController } from './controllers/health.controller.js';
import { TenantContextMiddleware } from './tenant/tenant-context.middleware.js';
import { APP_CONFIG, COMMAND_BUS, PG_POOL } from './tokens.js';

@Module({
  controllers: [HealthController, BranchesController],
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    {
      provide: PG_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new pg.Pool({ connectionString: config.DATABASE_URL, max: 20 }),
    },
    {
      provide: COMMAND_BUS,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) => new CommandBus(new PgTenantDatabase(pool)),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Toda ruta de negocio pasa por el contexto del laboratorio; /health no.
    consumer.apply(TenantContextMiddleware).forRoutes(BranchesController);
  }
}
