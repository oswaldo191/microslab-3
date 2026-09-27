import { defineCommand, parseWith } from '../../../../kernel/index.js';
import { createBranchSchema, type Branch, type CreateBranchInput } from '../../domain/branch.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Crear una sucursal. Es el comando de ejemplo de la Fase 0: recorre toda la tubería
 * (permiso → validación → transacción con RLS → auditoría encadenada → outbox).
 */
export const createBranch = defineCommand<CreateBranchInput, Branch>({
  name: 'configuration.branches.create',
  module: 'configuration',
  permission: 'configuration.branches.create',
  parse: (input) => parseWith(createBranchSchema, input),
  async handle(tx, input, ctx) {
    const createdBy = ctx.actor.type === 'user' && UUID.test(ctx.actor.id) ? ctx.actor.id : null;
    const { rows } = await tx.query<Branch>(
      `INSERT INTO app.branches (code, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, code, name, status`,
      [input.code, input.name, createdBy],
    );
    const branch = rows[0];
    if (!branch) throw new Error('La base no devolvió la sucursal creada');

    return {
      result: branch,
      audit: [
        {
          action: 'branches.create',
          entityType: 'branch',
          entityId: branch.id,
          after: { ...branch },
        },
      ],
      events: [
        {
          type: 'configuration.BranchCreated',
          aggregateType: 'branch',
          aggregateId: branch.id,
          payload: { code: branch.code },
        },
      ],
    };
  },
});
