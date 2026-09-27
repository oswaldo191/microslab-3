import { jwtVerify } from 'jose';

/**
 * Reclamaciones del token de acceso. En F0 los permisos viajan en el token para poder probar
 * la tubería; en F1 se resuelven desde la base (roles del usuario) en cada sesión.
 */
export interface AccessClaims {
  readonly sub: string;
  readonly lab: string;
  readonly branches: string[];
  readonly allBranches: boolean;
  readonly perms: string[];
  readonly modules: string[];
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ['HS256'],
    audience: 'microslab-api',
    issuer: 'microslab',
  });
  const p = payload as Partial<AccessClaims>;
  if (!p.sub || !p.lab || !Array.isArray(p.perms)) throw new Error('Token incompleto');
  return {
    sub: p.sub,
    lab: p.lab,
    branches: Array.isArray(p.branches) ? p.branches : [],
    allBranches: p.allBranches === true,
    perms: p.perms,
    modules: Array.isArray(p.modules) ? p.modules : [],
  };
}
