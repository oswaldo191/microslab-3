import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  AccessResolver,
  assertTokenLaboratory,
  buildTenantContext,
  DomainError,
  identityFromClaims,
  type ModuleEnablementProvider,
  type TenantContext,
} from '../../kernel/index.js';
import type { AppConfig } from '../../config.js';
import { verifyAccessToken } from '../auth/access-token.js';
import { ACCESS_RESOLVER, APP_CONFIG, MODULE_ENABLEMENT, PG_POOL } from '../tokens.js';

export interface TenantRequest extends Request {
  tenant?: TenantContext;
  requestId?: string;
}

/**
 * Construye el contexto de cada petición (F1.2, AUTHZ §1; ADR 0031 §1):
 *   1. El subdominio identifica el laboratorio. Nunca sale del token.
 *   2. El token solo identifica al usuario; su claim `lab` debe coincidir con el del host.
 *   3. Permisos, sucursales y `allBranches` se leen de la base en cada petición.
 *   4. Los módulos habilitados salen del proveedor de habilitación, no del token.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(ACCESS_RESOLVER) private readonly resolver: AccessResolver,
    @Inject(MODULE_ENABLEMENT) private readonly enablement: ModuleEnablementProvider,
  ) {}

  async use(req: TenantRequest, _res: Response, next: NextFunction): Promise<void> {
    try {
      const incoming = req.header('x-request-id');
      req.requestId = incoming && /^[\w-]{8,100}$/.test(incoming) ? incoming : randomUUID();

      const subdomain = this.subdomainOf(req.hostname);
      if (!subdomain)
        throw new DomainError('TENANT_REQUIRED', 'Use la dirección de su laboratorio');

      const { rows } = await this.pool.query<{ id: string; status: string }>(
        'SELECT id, status FROM platform.laboratory_directory WHERE subdomain = $1',
        [subdomain],
      );
      const lab = rows[0];
      if (!lab) throw new DomainError('NOT_FOUND', 'Laboratorio no encontrado');

      const header = req.header('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!token) throw new DomainError('UNAUTHENTICATED', 'Inicie sesión');

      const identity = identityFromClaims(await verifyAccessToken(token, this.config.JWT_SECRET));
      assertTokenLaboratory(identity, lab.id);

      const access = await this.resolver.resolve({
        laboratory: lab,
        identity,
        requestId: req.requestId,
      });
      const enabledModules = await this.enablement.enabledModules(lab.id);

      // `x-branch-id` se valida en F1.4; aquí se conserva el comportamiento de F0.
      const activeBranch = req.header('x-branch-id');
      req.tenant = buildTenantContext({
        laboratoryId: lab.id,
        identity,
        access,
        enabledModules,
        requestId: req.requestId,
        ...(activeBranch ? { activeBranchId: activeBranch } : {}),
        ...(req.ip ? { ip: req.ip } : {}),
        ...(req.header('user-agent') ? { userAgent: req.header('user-agent')! } : {}),
        ...(req.header('x-device-id') ? { deviceId: req.header('x-device-id')! } : {}),
      });
      next();
    } catch (error) {
      next(error);
    }
  }

  private subdomainOf(hostname: string): string | null {
    const base = `.${this.config.BASE_DOMAIN}`;
    if (!hostname.endsWith(base)) return null;
    const sub = hostname.slice(0, -base.length);
    return /^[a-z0-9-]+$/.test(sub) ? sub : null;
  }
}
