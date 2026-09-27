import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@microslab/contracts';
import { isDomainError } from '../../kernel/index.js';
import type { TenantRequest } from '../tenant/tenant-context.middleware.js';

/** Todas las respuestas de error tienen el mismo formato: { code, message, issues?, requestId }. */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<TenantRequest>();
    const requestId = req.requestId ?? 'sin-id';

    let status = 500;
    let body: ApiError = { code: 'INTERNAL', message: 'Ocurrió un error inesperado', requestId };

    if (isDomainError(error)) {
      status = error.httpStatus;
      body = {
        code: error.code,
        message: error.message,
        ...(error.issues.length ? { issues: error.issues } : {}),
        requestId,
      };
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      body = { code: 'HTTP_ERROR', message: error.message, requestId };
    }
    res.status(status).json(body);
  }
}
