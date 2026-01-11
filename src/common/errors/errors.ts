// Base error class - all custom errors extend this
export abstract class BaseError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    // Set prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
    // Convert error to JSON format
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
    };
  }
}

// 404 - Resource not found
export class NotFoundError extends BaseError {
  constructor(resource: string, identifier?: string, context?: Record<string, any>) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    super(message, 404, true, context);
  }
}

// 400 - Validation failed
export class ValidationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, true, context);
  }
}

// 503 - External service unavailable
export class ServiceUnavailableError extends BaseError {
  constructor(service: string, message?: string, context?: Record<string, any>) {
    const errorMessage = message 
      ? `${service} is unavailable: ${message}`
      : `${service} is unavailable`;
    
    super(errorMessage, 503, true, context);
  }
}

// 400 - Bad request
export class BadRequestError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, true, context);
  }
}

// 409 - Conflict (resource state conflict)
export class ConflictError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 409, true, context);
  }
}
