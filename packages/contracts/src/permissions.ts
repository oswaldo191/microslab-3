import catalog from './permissions.json' with { type: 'json' };

/**
 * Catálogo global de permisos `módulo.recurso.acción`.
 * El archivo JSON es la fuente: la API lo usa en código y el migrador lo sincroniza con la base.
 * Cada fase agrega los permisos de sus módulos.
 */
export interface PermissionDescriptor {
  readonly key: string;
  readonly module: string;
  readonly description: string;
  /** Si es true, cualquier comando protegido por este permiso exige motivo. */
  readonly requiresReason: boolean;
}

export const PERMISSIONS: readonly PermissionDescriptor[] = catalog;
export const PERMISSION_KEYS: ReadonlySet<string> = new Set(catalog.map((p) => p.key));
