import type { SessionSettings, TenantContext } from '../context/request-context.js';
import type { TenantDatabase } from '../database/sql.js';
import { DomainError } from '../errors/domain-error.js';
import type { RequestIdentity } from './identity.js';

/** Laboratorio resuelto por el host (`platform.laboratory_directory`). */
export interface ResolvedLaboratory {
  readonly id: string;
  /** Estado operativo de la plataforma: onboarding, active, suspended o closed (decisión M). */
  readonly status: string;
}

/** Autorización efectiva del usuario, leída de la base en esta petición. */
export interface ResolvedAccess {
  readonly permissions: ReadonlySet<string>;
  /** Sucursales asignadas en `app.user_branches`. */
  readonly branchIds: readonly string[];
  /** true si algún rol ACTIVO del usuario abarca todas las sucursales. */
  readonly allBranches: boolean;
}

export interface ResolveAccessInput {
  readonly laboratory: ResolvedLaboratory;
  readonly identity: RequestIdentity;
  readonly requestId: string;
}

/** Estados en que el laboratorio opera. Cualquier otro valor se trata como no disponible (falla cerrado). */
const OPERATIONAL_STATUSES: ReadonlySet<string> = new Set(['onboarding', 'active']);

/** Solo un usuario `active` puede usar una sesión. `invited`, `locked` e `inactive` no. */
const ACTIVE_USER = 'active';

interface AccessRow {
  readonly user_status: string;
  readonly permissions: string[] | null;
  readonly all_branches: boolean | null;
  readonly branch_ids: string[] | null;
}

/**
 * Consulta 1 de F1.2 (AUTHZ §5), parametrizada y dentro del RLS del laboratorio del host:
 * usuario, permisos de los roles activos, `bool_or(all_branches)` de los roles activos
 * y sucursales asignadas. Un rol inactivo no aporta nada.
 */
const ACCESS_QUERY = `
  WITH active_roles AS (
    SELECT r.laboratory_id, r.id, r.all_branches
      FROM app.user_roles ur
      JOIN app.roles r ON r.laboratory_id = ur.laboratory_id AND r.id = ur.role_id
     WHERE ur.laboratory_id = $2 AND ur.user_id = $1 AND r.status = 'active'
  )
  SELECT u.status AS user_status,
         (SELECT array_agg(DISTINCT rp.permission_key ORDER BY rp.permission_key)
            FROM active_roles ar
            JOIN app.role_permissions rp
              ON rp.laboratory_id = ar.laboratory_id AND rp.role_id = ar.id) AS permissions,
         (SELECT bool_or(ar.all_branches) FROM active_roles ar) AS all_branches,
         (SELECT array_agg(ub.branch_id::text ORDER BY ub.branch_id::text)
            FROM app.user_branches ub
           WHERE ub.laboratory_id = $2 AND ub.user_id = $1) AS branch_ids
    FROM app.users u
   WHERE u.laboratory_id = $2 AND u.id = $1`;

/**
 * Resuelve la autorización de cada petición desde la base (F1.3; ADR 0031 §1).
 * La base es la única fuente de verdad: no hay caché ni se usa nada del token salvo `sub`.
 *
 * La lectura va en su propia transacción de solo lectura, con `app.laboratory_id` del host y
 * sin sucursales: las tablas consultadas solo tienen aislamiento por laboratorio, así que la
 * resolución nunca ve más de lo que corresponde a ese laboratorio.
 */
export class AccessResolver {
  constructor(private readonly db: TenantDatabase) {}

  async resolve(input: ResolveAccessInput): Promise<ResolvedAccess> {
    const { laboratory, identity, requestId } = input;
    const settings: SessionSettings = {
      'app.laboratory_id': laboratory.id,
      'app.branch_ids': '',
      'app.all_branches': 'false',
      'app.actor_type': 'user',
      'app.actor_id': identity.userId,
      'app.request_id': requestId,
    };

    const row = await this.db.transaction(settings, async (tx) => {
      await tx.query('SET TRANSACTION READ ONLY');
      const { rows } = await tx.query<AccessRow>(ACCESS_QUERY, [identity.userId, laboratory.id]);
      return rows[0];
    });

    // Usuario inexistente o no activo: mismo código para no revelar el estado de la cuenta.
    if (!row || row.user_status !== ACTIVE_USER) {
      throw new DomainError('SESSION_REVOKED', 'La sesión ya no es válida; inicie sesión de nuevo');
    }
    assertLaboratoryAvailable(laboratory);

    return {
      permissions: new Set(row.permissions ?? []),
      branchIds: row.branch_ids ?? [],
      allBranches: row.all_branches === true,
    };
  }
}

/**
 * `suspended` y `closed` responden 403 LABORATORY_UNAVAILABLE. Es estado operativo de la
 * plataforma, nunca de billing (decisión M). Las sesiones no se revocan por esto.
 */
export function assertLaboratoryAvailable(laboratory: ResolvedLaboratory): void {
  if (!OPERATIONAL_STATUSES.has(laboratory.status)) {
    throw new DomainError(
      'LABORATORY_UNAVAILABLE',
      'El laboratorio no está disponible en este momento',
    );
  }
}

export interface BuildTenantContextInput {
  readonly laboratoryId: string;
  readonly identity: RequestIdentity;
  readonly access: ResolvedAccess;
  readonly enabledModules: ReadonlySet<string>;
  readonly requestId: string;
  readonly activeBranchId?: string;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly deviceId?: string;
}

/**
 * Arma el TenantContext. Laboratorio: del host. Actor: `sub`. Permisos y sucursales: de la base.
 * Módulos: del proveedor de habilitación. Ningún dato de autorización sale del token.
 */
export function buildTenantContext(input: BuildTenantContextInput): TenantContext {
  return {
    laboratoryId: input.laboratoryId,
    ...(input.activeBranchId ? { activeBranchId: input.activeBranchId } : {}),
    branchIds: input.access.branchIds,
    allBranches: input.access.allBranches,
    actor: { type: 'user', id: input.identity.userId },
    permissions: input.access.permissions,
    enabledModules: input.enabledModules,
    requestId: input.requestId,
    ...(input.ip ? { ip: input.ip } : {}),
    ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
  };
}
