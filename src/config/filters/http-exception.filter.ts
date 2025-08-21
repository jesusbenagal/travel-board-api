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
  [key: string]: any;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.headers['x-request-id'];

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Unexpected error';
    let code: ErrorResponse['error']['code'] = 'INTERNAL_ERROR';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse() as HttpExceptionResponse;

      if (status === HttpStatus.BAD_REQUEST && response?.message) {
        code = 'VALIDATION_ERROR';
        message = 'Validation Failed';
        details = response.message;
      } else if (typeof response === 'string') {
        message = response;
      } else if (response?.message) {
        message = Array.isArray(response.message)
          ? response.message[0]
          : response.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message || 'Unexpected error';
    }

    // Log con requestId
    const requestIdStr = Array.isArray(requestId)
      ? requestId[0]
      : requestId || 'unknown';
    this.logger.error(
      `[${requestIdStr}] ${req.method} ${req.url} -> ${status} ${code}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const payload: ErrorResponse = {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    };
    res.status(status).json(payload);
  }
}
