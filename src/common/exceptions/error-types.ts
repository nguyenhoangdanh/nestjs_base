import { AppError } from 'src/share';

// src/common/exceptions/error-types.ts
export enum ErrorType {
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Entity errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Permission errors
  FORBIDDEN = 'FORBIDDEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

// src/common/exceptions/app-error.factory.ts
export class AppErrorFactory {
  // Auth errors
  static unauthorized(
    message = 'Unauthorized',
    // details?: Record<string, any>,
  ): AppError {
    return AppError.from(new Error(message), 401).withDetail(
      'errorType',
      ErrorType.UNAUTHORIZED,
    );
  }

  static invalidCredentials(message = 'Invalid credentials'): AppError {
    return AppError.from(new Error(message), 400).withDetail(
      'errorType',
      ErrorType.INVALID_CREDENTIALS,
    );
  }

  // Thêm các factory method khác cho từng loại lỗi
}
