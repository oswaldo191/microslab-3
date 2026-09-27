import { z } from 'zod';

/** Configuración validada al arrancar: si falta algo, el proceso no inicia. */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_DISPATCHER: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  BASE_DOMAIN: z.string().min(3),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${details}`);
  }
  return parsed.data;
}
