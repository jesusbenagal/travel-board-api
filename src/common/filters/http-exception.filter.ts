import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

import type {
  ErrorCode,
  ErrorPayload,
  ErrorResponse,
} from '../errors/error-codes';

interface HttpExceptionResponse {
  code?: ErrorCode;
  message?: string | string[];
  details?: unknown;
  [key: string]: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();

    const hdr = req.headers['x-request-id'];
    const headerId =
      typeof hdr === 'string' ? hdr : Array.isArray(hdr) ? hdr[0] : undefined;
    let requestId =
      req.requestId ??
      headerId ??
      (typeof res.getHeader === 'function'
        ? (res.getHeader('x-request-id') as string | undefined)
        : undefined);
    if (!requestId) {
      requestId = randomUUID();
      res.setHeader('x-request-id', requestId);
    }

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = 'Unexpected error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus() as HttpStatus;
      const response = exception.getResponse() as HttpExceptionResponse;

      if (response?.code) code = response.code;

      if (status === HttpStatus.BAD_REQUEST && response?.message) {
        if (code === 'INTERNAL_ERROR') code = 'VALIDATION_ERROR';
        message = 'Validation Failed';
        details = response.message;
      } else if (typeof response === 'string') {
        message = response;
      } else if (response?.message) {
        message = Array.isArray(response.message)
          ? response.message[0]
          : response.message;
      }

      if (code === 'INTERNAL_ERROR') {
        switch (status) {
          case HttpStatus.NOT_FOUND:
            code = 'NOT_FOUND';
            break;
          case HttpStatus.FORBIDDEN:
          case HttpStatus.UNAUTHORIZED:
            code = 'AUTH_FORBIDDEN';
            break;
          default:
            break;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || 'Unexpected error';
    }

    this.logger.error(
      `[${requestId}] ${req.method} ${req.url} -> ${status} ${code}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const errorBody: ErrorPayload = { code, message, requestId };
    if (typeof details !== 'undefined') errorBody.details = details;

    const payload: ErrorResponse = { error: errorBody };
    res.status(status).json(payload);
  }
}
