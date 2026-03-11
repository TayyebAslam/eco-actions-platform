/**
 * Base application error class
 * All service-specific errors should extend this class
 */
export class AppError extends Error {
  statusCode: number;
  data?: unknown;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
