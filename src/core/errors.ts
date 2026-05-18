/**
 * Custom error classes for GOrchestrator
 */

export type ErrorSeverity = 'recoverable' | 'fatal' | 'transient';

export interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
  requestId?: string;
  timestamp: string;
}

export class GOrchestratorError extends Error {
  constructor(
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public statusCode: number = 500,
    public severity: ErrorSeverity = 'fatal'
  ) {
    super(message);
    this.name = 'GOrchestratorError';
  }

  toJSON(): ErrorResponse {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      timestamp: new Date().toISOString(),
    };
  }
}

export class ValidationError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400, 'recoverable');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401, 'recoverable');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'AUTHORIZATION_ERROR', 403, 'fatal');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404, 'recoverable');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409, 'recoverable');
    this.name = 'ConflictError';
  }
}

export class BudgetExceededError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'BUDGET_EXCEEDED', 429, 'fatal');
    this.name = 'BudgetExceededError';
  }
}

export class RateLimitError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT', 429, 'transient');
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'SERVICE_UNAVAILABLE', 503, 'transient');
    this.name = 'ServiceUnavailableError';
  }
}

export class TimeoutError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'TIMEOUT', 504, 'transient');
    this.name = 'TimeoutError';
  }
}

export class DatabaseError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500, 'fatal');
    this.name = 'DatabaseError';
  }
}

export class LLMError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'LLM_ERROR', 502, 'transient');
    this.name = 'LLMError';
  }
}
