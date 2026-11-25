export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errorCode: string = 'INTERNAL_ERROR',
    public details?: Record<string, any>,
    /** Plain values (names, dates) a screen can put into its own translated sentence. Always sent; never internals. */
    public params?: Record<string, string | number | boolean | null>
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: new Date().toISOString()
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(400, message, 'VALIDATION_ERROR', details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * A refusal with a stable code: the server's sentence (English) is a fallback, the app looks the code up in `serverMessages`
 * and says it in the person's own language, with the values in `params` (a medicine name, a date).
 */
export class CodedError extends AppError {
  constructor(statusCode: number, code: string, message: string, params?: Record<string, string | number | boolean | null>) {
    super(statusCode, message, code, undefined, params);
    Object.setPrototypeOf(this, CodedError.prototype);
  }
}

/** A refusal whose next step is a vet (a young animal that needs a feeding plan made by one); the screen offers to find one. */
export class NeedsVetError extends AppError {
  constructor(message: string) {
    super(400, message, 'NEEDS_VET');
    Object.setPrototypeOf(this, NeedsVetError.prototype);
  }
}

/** Withdrawal warning: the action is allowed once the person confirms (the request is sent again with confirmWithdrawal: true). */
export class WithdrawalConfirmError extends AppError {
  constructor(message: string, params?: Record<string, string | number | boolean | null>) {
    super(409, message, 'WITHDRAWAL_CONFIRM', undefined, params);
    Object.setPrototypeOf(this, WithdrawalConfirmError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(404, message, 'NOT_FOUND', { resource, id });
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(401, message, 'UNAUTHORIZED');
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(403, message, 'FORBIDDEN');
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(409, message, 'CONFLICT', details);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(500, message, 'DATABASE_ERROR', details);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class ServiceError extends AppError {
  constructor(service: string, message: string, details?: Record<string, any>) {
    super(500, `${service} service error: ${message}`, 'SERVICE_ERROR', { service, ...details });
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}
