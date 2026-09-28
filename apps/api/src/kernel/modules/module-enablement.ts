import { MODULES } from '@microslab/contracts';

/**
 * Habilitación de producto: "¿tiene este laboratorio este módulo?".
 * Es un control distinto de la autorización ("¿puede este usuario?"): `permissions != enabledModules`
 * (F1.2, decisión L; ADR 0031 §2). El CommandBus exige ambos.
 */
export interface ModuleEnablementProvider {
  /** Módulos de plan habilitados para el laboratorio. Los módulos con `planGated: false` no dependen de esto. */
  enabledModules(laboratoryId: string): Promise<ReadonlySet<string>>;
}

const NONE: ReadonlySet<string> = new Set<string>();

/**
 * Proveedor de F1: estático y explícito. No habilita ningún módulo de plan, porque F1 no ejecuta
 * comandos de módulos de plan. Los módulos fundamentales (`planGated: false`, entre ellos
 * `security`, `configuration` y `audit`) siguen habilitados por `isModuleEnabled`.
 * En F2 la suscripción implementa esta misma interfaz, sin cambiar el CommandBus.
 */
export const staticModuleEnablement: ModuleEnablementProvider = {
  enabledModules: async () => NONE,
};

/** Módulos que no dependen del plan: siempre habilitados. */
export const FOUNDATIONAL_MODULES: ReadonlySet<string> = new Set(
  MODULES.filter((m) => !m.planGated).map((m) => m.key),
);
