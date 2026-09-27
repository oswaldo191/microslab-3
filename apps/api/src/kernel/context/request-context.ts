/**
 * Contexto de cada petición o trabajo en segundo plano.
 * Lo construye el borde (HTTP, worker, voz, conector) y viaja a todas las capas.
 * La base de datos lo recibe como SET LOCAL y RLS lo hace cumplir.
 */
export type ActorType =
  | 'user'
  | 'system'
  | 'voice'
  | 'ai'
  | 'device'
  | 'api'
  | 'support'
  | 'platform';

export interface Actor {
  readonly type: ActorType;
  /** Identificador del usuario, proceso o dispositivo. */
  readonly id: string;
}

export interface TenantContext {
  readonly laboratoryId: string;
  /** Sucursal activa en la interfaz, si aplica. */
  readonly activeBranchId?: string;
  /** Sucursales que el usuario puede ver. Ignorado si allBranches es true. */
  readonly branchIds: readonly string[];
  readonly allBranches: boolean;
  readonly actor: Actor;
  /** Permisos efectivos del actor (roles + ajustes), ya resueltos. */
  readonly permissions: ReadonlySet<string>;
  /** Módulos habilitados por el plan del laboratorio. */
  readonly enabledModules: ReadonlySet<string>;
  readonly requestId: string;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly deviceId?: string;
}

/** Valores que se fijan con SET LOCAL al abrir cada transacción. Todos son texto. */
export interface SessionSettings {
  readonly 'app.laboratory_id': string;
  readonly 'app.branch_ids': string;
  readonly 'app.all_branches': 'true' | 'false';
  readonly 'app.actor_type': ActorType;
  readonly 'app.actor_id': string;
  readonly 'app.request_id': string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toSessionSettings(ctx: TenantContext): SessionSettings {
  if (!UUID.test(ctx.laboratoryId)) {
    throw new Error('Contexto inválido: laboratoryId debe ser un UUID');
  }
  for (const id of ctx.branchIds) {
    if (!UUID.test(id))
      throw new Error('Contexto inválido: branchIds contiene un valor que no es UUID');
  }
  return {
    'app.laboratory_id': ctx.laboratoryId,
    'app.branch_ids': ctx.branchIds.join(','),
    'app.all_branches': ctx.allBranches ? 'true' : 'false',
    'app.actor_type': ctx.actor.type,
    'app.actor_id': ctx.actor.id,
    'app.request_id': ctx.requestId,
  };
}
