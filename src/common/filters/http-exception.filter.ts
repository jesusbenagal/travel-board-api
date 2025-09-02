import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorResponse } from '../errors/error-codes';

interface HttpExceptionResponse {
  message?: string | string[];
  code?: string;
  [key: string]: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = (req.headers['x-request-id'] as string) ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorResponse['error']['code'] = 'INTERNAL_ERROR';
    let message = 'Unexpected error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse() as HttpExceptionResponse;

      // ⬇️ MANTÉN el code si viene explícito en la excepción
      if (typeof response?.code === 'string') {
        code = response.code as ErrorResponse['error']['code'];
      }

      if (status === HttpStatus.BAD_REQUEST && response?.message) {
        code = code === 'INTERNAL_ERROR' ? 'VALIDATION_ERROR' : code;
        message = 'Validation Failed';
        details = response.message;
      } else if (typeof response === 'string') {
        message = response;
      } else if (response?.message) {
        message = Array.isArray(response.message)
          ? response.message[0]
          : response.message;
      }

      // Si sigue en INTERNAL_ERROR, mapear por status como fallback
      if (code === 'INTERNAL_ERROR') {
        if (status === HttpStatus.NOT_FOUND) code = 'NOT_FOUND';
        else if (
          status === HttpStatus.FORBIDDEN ||
          status === HttpStatus.UNAUTHORIZED
        )
          code = 'AUTH_FORBIDDEN';
      }
    } else if (exception instanceof Error) {
      message = exception.message || 'Unexpected error';
    }

    this.logger.error(
      `[${requestId}] ${req.method} ${req.url} -> ${status} ${code}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const payload: ErrorResponse = {
      error: { code, message, ...(details ? { details } : {}), requestId },
    };
    res.status(status).json(payload);
  }
}
