import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { CommandBus, type TenantContext } from '../../kernel/index.js';
import { createBranch, type Branch } from '../../modules/configuration/index.js';
import { Tenant } from '../tenant/tenant.decorator.js';
import { COMMAND_BUS } from '../tokens.js';

/** El controlador solo traduce HTTP ↔ comando. Toda la lógica y la seguridad viven en la tubería. */
@Controller('branches')
export class BranchesController {
  constructor(@Inject(COMMAND_BUS) private readonly bus: CommandBus) {}

  @Post()
  @HttpCode(201)
  create(
    @Tenant() ctx: TenantContext,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<Branch> {
    return this.bus.execute(createBranch, body, ctx, idempotencyKey ? { idempotencyKey } : {});
  }
}
