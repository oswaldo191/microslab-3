/**
 * Errores de dominio con un código estable. El borde HTTP los traduce a respuestas
 * con el formato único { code, message, field?, requestId }.
 */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'MODULE_DISABLED'
  | 'REASON_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_MISMATCH'
  | 'TENANT_REQUIRED';

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  PERMISSION_DENIED: 403,
  MODULE_DISABLED: 403,
  REASON_REQUIRED: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_MISMATCH: 409,
  TENANT_REQUIRED: 400,
};

export interface FieldIssue {
  readonly field: string;
  readonly message: string;
}

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly issues: readonly FieldIssue[];

  constructor(code: ErrorCode, message: string, issues: readonly FieldIssue[] = []) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.issues = issues;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;
