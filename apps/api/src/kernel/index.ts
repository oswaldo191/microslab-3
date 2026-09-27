// API pública del kernel. Los módulos importan desde aquí, nunca desde archivos internos.
export * from './context/request-context.js';
export * from './errors/domain-error.js';
export * from './database/sql.js';
export * from './database/pg-tenant-database.js';
export * from './audit/audit-writer.js';
export * from './events/outbox.js';
export * from './modules/module-registry.js';
export * from './access/permissions.js';
export * from './commands/command.js';
export * from './commands/command-bus.js';
export * from './commands/stable-json.js';
export * from './validation/parse.js';
export * from './modules/module-manifest.js';
export * from './events/outbox-dispatcher.js';
