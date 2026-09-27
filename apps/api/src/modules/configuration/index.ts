import { defineModule } from '../../kernel/index.js';
import { createBranch } from './application/commands/create-branch.js';

/** Configuración del laboratorio: laboratorio, sucursales, ubicaciones y personalización. */
export const configurationModule = defineModule({
  key: 'configuration',
  commands: [createBranch],
  events: ['configuration.BranchCreated'],
});

export { createBranch };
export type { Branch, CreateBranchInput } from './domain/branch.js';
