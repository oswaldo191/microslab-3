import type { ZodType } from 'zod';
import { DomainError } from '../errors/domain-error.js';

/**
 * Valida con un esquema Zod y convierte los errores al formato de dominio.
 * Los mismos esquemas (en packages/contracts) validan en el navegador y en la API.
 */
export function parseWith<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new DomainError(
    'VALIDATION_FAILED',
    'Los datos enviados no son válidos',
    result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(entrada)',
      message: issue.message,
    })),
  );
}
