// ==============================================================================
// FGP-Backend Consistent Response Formatter
// Section 8: Standardized JSON payload envelope for all endpoints
// ==============================================================================

import { ApiResponse, ApiErrorResponse } from '../types/index.ts';

export function formatSuccess<T>(data: T, requestId = 'req-unknown'): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

export function formatError(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
  requestId = 'req-unknown'
): ApiErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
