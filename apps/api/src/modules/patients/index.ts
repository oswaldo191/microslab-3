import { defineModule } from '../../kernel/index.js';

/** Pacientes, médicos e historial. Estructura registrada desde F0; su funcionalidad se construye en F3. */
export const patientsModule = defineModule({
  key: 'patients',
  commands: [],
  events: [],
});
