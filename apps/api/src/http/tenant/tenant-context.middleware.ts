import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { DomainError, type TenantContext } from '../../kernel/index.js';
import type { AppConfig } from '../../config.js';
import { verifyAccessToken } from '../auth/access-token.js';
import { APP_CONFIG, PG_POOL } from '../tokens.js';

export interface TenantRequest extends Request {
  tenant?: TenantContext;
  requestId?: string;
}

/**
 * Construye el contexto de cada petición:
 *   1. El subdominio identifica el laboratorio.
 *   2. El token debe pertenecer a ESE laboratorio; si no coincide, se rechaza.
 *   3. Las sucursales del token se validan después por RLS en cada consulta.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
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
      if (!token) throw new DomainError('PERMISSION_DENIED', 'Inicie sesión');
      const claims = await verifyAccessToken(token, this.config.JWT_SECRET).catch(() => {
        throw new DomainError('PERMISSION_DENIED', 'Sesión inválida o vencida');
      });
      if (claims.lab !== lab.id) {
        throw new DomainError('PERMISSION_DENIED', 'La sesión no pertenece a este laboratorio');
      }

      const activeBranch = req.header('x-branch-id');
      req.tenant = {
        laboratoryId: lab.id,
        ...(activeBranch ? { activeBranchId: activeBranch } : {}),
        branchIds: claims.branches,
        allBranches: claims.allBranches,
        actor: { type: 'user', id: claims.sub },
        permissions: new Set(claims.perms),
        enabledModules: new Set(claims.modules),
        requestId: req.requestId,
        ...(req.ip ? { ip: req.ip } : {}),
        ...(req.header('user-agent') ? { userAgent: req.header('user-agent')! } : {}),
        ...(req.header('x-device-id') ? { deviceId: req.header('x-device-id')! } : {}),
      };
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
