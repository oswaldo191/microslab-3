import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { DomainError, type TenantContext } from '../../kernel/index.js';
import type { TenantRequest } from './tenant-context.middleware.js';

/** Inyecta el contexto del laboratorio en un controlador. Sin contexto, la petición no avanza. */
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<TenantRequest>();
    if (!req.tenant) throw new DomainError('TENANT_REQUIRED', 'Falta el contexto del laboratorio');
    return req.tenant;
  },
);
