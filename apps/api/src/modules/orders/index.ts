import { defineModule } from '../../kernel/index.js';

/** Órdenes y cotizaciones. Estructura registrada desde F0; su funcionalidad se construye en F4. */
export const ordersModule = defineModule({
  key: 'orders',
  commands: [],
  events: [],
});
