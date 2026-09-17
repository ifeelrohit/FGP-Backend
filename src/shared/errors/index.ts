// ==============================================================================
// FGP-Backend Typed Application Errors
// Centralized, structured error hierarchy for domain and HTTP mapping
// ==============================================================================

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown>;

  constructor(
    message: string,
    code = 'INTERNAL_SERVER_ERROR',
    statusCode = 500,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request parameters or payload', details: Record<string, unknown> = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required or invalid credentials', details: Record<string, unknown> = {}) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions to perform this action', details: Record<string, unknown> = {}) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found', details: Record<string, unknown> = {}) {
    super(message, 'NOT_FOUND_ERROR', 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict or state transition not allowed', details: Record<string, unknown> = {}) {
    super(message, 'CONFLICT_ERROR', 409, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request syntax or unprocessable content', details: Record<string, unknown> = {}) {
    super(message, 'BAD_REQUEST_ERROR', 400, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred', details: Record<string, unknown> = {}) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, details);
  }
}
