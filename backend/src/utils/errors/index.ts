import { AppError } from "./AppError";

export { AppError };

export class AuthError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "AuthError";
  }
}

export class UserError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "UserError";
  }
}

export class StudentError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "StudentError";
  }
}

export class SchoolError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "SchoolError";
  }
}

export class TeacherError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "TeacherError";
  }
}

export class ActivityError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "ActivityError";
  }
}

export class ChallengeError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "ChallengeError";
  }
}

export class AuditLogError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "AuditLogError";
  }
}

export class ArticleError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "ArticleError";
  }
}

export class LevelError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "LevelError";
  }
}

export class NotificationError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: unknown) {
    super(message, statusCode, data);
    this.name = "NotificationError";
  }
}

export class JobTitleError extends AppError {
  constructor(message: string, statusCode: number = 400, data?: any) {
    super(message, statusCode, data);
    this.name = "JobTitleError";
  }
}
