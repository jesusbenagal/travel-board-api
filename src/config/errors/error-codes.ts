export type ErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'TRIP_FORBIDDEN'
  | 'TRIP_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ErrorResponse {
  error: ErrorPayload;
}
