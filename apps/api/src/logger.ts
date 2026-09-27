import { pino } from 'pino';

/** Logs estructurados. Nunca registran datos de pacientes ni secretos. */
export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.cedula',
        '*.document',
        '*.patient',
      ],
      censor: '[protegido]',
    },
  });
}
