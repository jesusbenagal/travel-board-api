export type ErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'TRIP_FORBIDDEN'
  | 'TRIP_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'INVITE_NOT_FOUND'
  | 'INVITE_FORBIDDEN'
  | 'INVITE_ALREADY_ACCEPTED'
  | 'MEMBER_NOT_FOUND'
  | 'TRIP_DELETE_BLOCKED'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_FORBIDDEN'
  | 'VOTE_CONFLICT'
  | 'VOTE_NOT_FOUND'
  | 'SHARE_INVALID'
  | 'SHARE_MAXED'
  | 'SHARE_EXPIRED'
  | 'RATE_LIMITED';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ErrorResponse {
  error: ErrorPayload;
}
