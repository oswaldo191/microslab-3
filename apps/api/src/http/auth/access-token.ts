import { jwtVerify } from 'jose';
import { DomainError } from '../../kernel/index.js';

/**
 * Verifica el access token y devuelve sus claims para extraer SOLO la identidad
 * (`identityFromClaims`). Desde F1.3 el token no aporta autorización: si trae `perms`,
 * `modules`, `branches` o `allBranches`, se ignoran; tampoco hace falta que los traiga.
 *
 * F1.3 sigue aceptando el HS256 actual solo para identidad. La firma asimétrica con `kid`,
 * `exp` obligatorio y `sid` llegan con las sesiones de F1.5 (F1.2, decisión D y §9).
 */
export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<Readonly<Record<string, unknown>>> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      audience: 'microslab-api',
      issuer: 'microslab',
    });
    return payload;
  } catch (error) {
    if ((error as { code?: unknown })?.code === 'ERR_JWT_EXPIRED') {
      throw new DomainError('TOKEN_EXPIRED', 'La sesión venció; inicie sesión de nuevo');
    }
    throw new DomainError('TOKEN_INVALID', 'Sesión inválida; inicie sesión de nuevo');
  }
}
