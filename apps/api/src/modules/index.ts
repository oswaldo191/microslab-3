// Archivo generado por tools/scaffold-modules.mjs — no editar a mano.
import type { ModuleManifest } from '../kernel/index.js';
import { platformModule } from './platform/index.js';
import { billingModule } from './billing/index.js';
import { commissionsModule } from './commissions/index.js';
import { securityModule } from './security/index.js';
import { auditModule } from './audit/index.js';
import { configurationModule } from './configuration/index.js';
import { approvalsModule } from './approvals/index.js';
import { catalogModule } from './catalog/index.js';
import { rulesEngineModule } from './rules-engine/index.js';
import { patientsModule } from './patients/index.js';
import { ordersModule } from './orders/index.js';
import { workcenterModule } from './workcenter/index.js';
import { samplesModule } from './samples/index.js';
import { resultsModule } from './results/index.js';
import { validationModule } from './validation/index.js';
import { documentsModule } from './documents/index.js';
import { imagingModule } from './imaging/index.js';
import { schedulingModule } from './scheduling/index.js';
import { homeCollectionModule } from './home-collection/index.js';
import { qualityModule } from './quality/index.js';
import { inventoryModule } from './inventory/index.js';
import { suppliersModule } from './suppliers/index.js';
import { purchasingModule } from './purchasing/index.js';
import { payablesModule } from './payables/index.js';
import { expensesModule } from './expenses/index.js';
import { budgetsModule } from './budgets/index.js';
import { costingModule } from './costing/index.js';
import { cashierModule } from './cashier/index.js';
import { insuranceModule } from './insurance/index.js';
import { receivablesModule } from './receivables/index.js';
import { aiModule } from './ai/index.js';
import { voiceModule } from './voice/index.js';
import { reportsModule } from './reports/index.js';
import { analyticsModule } from './analytics/index.js';
import { notificationsModule } from './notifications/index.js';
import { formsModule } from './forms/index.js';
import { integrationsModule } from './integrations/index.js';
import { portalsModule } from './portals/index.js';

/** Los 38 módulos de MICROSLAB, en el orden del registro oficial. */
export const ALL_MODULES: readonly ModuleManifest[] = [
  platformModule,
  billingModule,
  commissionsModule,
  securityModule,
  auditModule,
  configurationModule,
  approvalsModule,
  catalogModule,
  rulesEngineModule,
  patientsModule,
  ordersModule,
  workcenterModule,
  samplesModule,
  resultsModule,
  validationModule,
  documentsModule,
  imagingModule,
  schedulingModule,
  homeCollectionModule,
  qualityModule,
  inventoryModule,
  suppliersModule,
  purchasingModule,
  payablesModule,
  expensesModule,
  budgetsModule,
  costingModule,
  cashierModule,
  insuranceModule,
  receivablesModule,
  aiModule,
  voiceModule,
  reportsModule,
  analyticsModule,
  notificationsModule,
  formsModule,
  integrationsModule,
  portalsModule,
];
