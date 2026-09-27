import type { ModuleKey } from '@microslab/contracts';
import type { CommandDefinition } from '../commands/command.js';

/**
 * Lo que cada módulo expone al resto del sistema. Es lo único que otros módulos
 * (y la capa HTTP) pueden importar de él: su `index.ts` exporta este manifiesto.
 */
export interface ModuleManifest {
  readonly key: ModuleKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly commands: readonly CommandDefinition<any, any>[];
  /** Tipos de evento que el módulo publica (`<módulo>.<NombreEnPasado>`). */
  readonly events: readonly string[];
}

export function defineModule(manifest: ModuleManifest): ModuleManifest {
  for (const command of manifest.commands) {
    if (command.module !== manifest.key) {
      throw new Error(
        `El comando ${command.name} declara el módulo ${command.module}, no ${manifest.key}`,
      );
    }
  }
  for (const event of manifest.events) {
    if (!event.startsWith(`${manifest.key}.`)) {
      throw new Error(`El evento ${event} debe empezar con "${manifest.key}."`);
    }
  }
  return manifest;
}
