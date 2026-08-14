export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly code = "INTERNAL_ERROR",
    public readonly expose = statusCode < 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") { super(message, 401, "AUTHENTICATION_REQUIRED"); }
}
export class AuthorizationError extends AppError {
  constructor(message = "Access denied") { super(message, 403, "ACCESS_DENIED"); }
}
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") { super(message, 404, "NOT_FOUND"); }
}
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) { super(message, 400, "VALIDATION_ERROR", true, details); }
}
export class ConflictError extends AppError {
  constructor(message: string) { super(message, 409, "CONFLICT"); }
}
