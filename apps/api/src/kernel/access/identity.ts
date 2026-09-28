import { DomainError } from '../errors/domain-error.js';

/**
 * Identidad de una petición, extraída de un access token cuya firma ya se verificó.
 *
 * El token SOLO identifica (F1.2, decisión D; ADR 0031 §1). Nunca es fuente de autorización:
 * permisos, módulos, sucursales y `allBranches` salen de la base en cada petición, y si el
 * token los trae se ignoran.
 */
export interface RequestIdentity {
  /** `sub`: el usuario. */
  readonly userId: string;
  /** `lab`: solo sirve para comprobar consistencia con el laboratorio resuelto por el host. */
  readonly tokenLaboratoryId: string;
  /** `sid`: la sesión. Llega con las sesiones persistentes de F1.5; hoy es opcional. */
  readonly sessionId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(): DomainError {
  return new DomainError('TOKEN_INVALID', 'Sesión inválida; inicie sesión de nuevo');
}

/**
 * Toma de los claims verificados únicamente `sub`, `lab` y `sid`.
 * Cualquier otro claim (`perms`, `modules`, `branches`, `allBranches`, roles…) se descarta.
 */
export function identityFromClaims(claims: Readonly<Record<string, unknown>>): RequestIdentity {
  const { sub, lab, sid } = claims;
  if (typeof sub !== 'string' || !UUID.test(sub)) throw invalid();
  if (typeof lab !== 'string' || !UUID.test(lab)) throw invalid();
  if (sid !== undefined && (typeof sid !== 'string' || !UUID.test(sid))) throw invalid();
  return {
    userId: sub,
    tokenLaboratoryId: lab,
    ...(typeof sid === 'string' ? { sessionId: sid } : {}),
  };
}

/**
 * El laboratorio efectivo es siempre el del host. El claim `lab` solo se compara con él:
 * si difiere, el token no pertenece a este laboratorio y la petición se rechaza.
 */
export function assertTokenLaboratory(identity: RequestIdentity, laboratoryId: string): void {
  if (identity.tokenLaboratoryId !== laboratoryId) throw invalid();
}
