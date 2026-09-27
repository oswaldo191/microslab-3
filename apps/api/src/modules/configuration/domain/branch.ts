import { z } from 'zod';

/** Datos para crear una sucursal. El código se guarda siempre en mayúsculas. */
export const createBranchSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Use de 2 a 20 letras, números o guiones'),
  name: z.string().trim().min(2, 'Escriba el nombre de la sucursal').max(120),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export interface Branch {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'active' | 'inactive';
}
