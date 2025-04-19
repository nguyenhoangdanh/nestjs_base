import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '../../share/app-error';

/**
 * Filter xử lý các exception trong ứng dụng
 * Bao gồm các lỗi từ hệ thống, Redis, và lỗi tùy chỉnh
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppErrorFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Log full exception cho debug
    this.logger.error(`Exception: ${exception.message}`, exception.stack);

    if (
      exception instanceof UnauthorizedException ||
      exception.status === 401 ||
      (exception.response && exception.response.statusCode === 401) ||
      exception.message.includes('Unauthorized') ||
      exception.message.includes('đăng nhập')
    ) {
      return response.status(401).json({
        statusCode: 401,
        success: false,
        message: exception.message || 'Unauthorized',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // 1. Xử lý lỗi Redis - phân loại và trả về error phù hợp
      if (exception instanceof Error && this.isRedisError(exception)) {
        return this.handleRedisError(exception, response);
      }

      // 2. Xử lý lỗi từ AppError
      if (exception instanceof AppError) {
        return this.handleAppError(exception, response);
      }

      // 3. Xử lý HttpException từ NestJS
      if (exception instanceof HttpException) {
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        return response.status(status).json({
          success: false,
          statusCode: status,
          message:
            typeof exceptionResponse === 'object'
              ? (exceptionResponse as any).message || exception.message
              : exceptionResponse,
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      // 4. Xử lý các lỗi khác
      const status = HttpStatus.INTERNAL_SERVER_ERROR;
      return response.status(status).json({
        success: false,
        statusCode: status,
        message: 'Lỗi hệ thống, vui lòng thử lại sau',
        error:
          process.env.NODE_ENV !== 'production' ? exception.message : undefined,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    } catch (error) {
      // Fallback nếu có lỗi trong khi xử lý exception
      this.logger.error(
        `Error in exception filter: ${error.message}`,
        error.stack,
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
      });
    }
  }

  /**
   * Xử lý lỗi AppError
   */
  private handleAppError(exception: AppError, response: Response) {
    // Get the JSON representation first
    const errorJson =
      process.env.NODE_ENV !== 'production'
        ? exception.toJSON(false)
        : exception.toJSON(true);

    // Remove both message and statusCode properties from the JSON if they exist
    // to avoid the "property is specified more than once" errors
    const { message: _, statusCode: __, ...errorDetails } = errorJson;

    return response.status(exception.getStatusCode()).json({
      success: false,
      statusCode: exception.getStatusCode(),
      message: exception.message,
      ...errorDetails, // Spread the remaining properties
    });
  }

  /**
   * Kiểm tra lỗi Redis
   */
  private isRedisError(error: Error): boolean {
    // Kiểm tra lỗi từ Redis error types
    if (error.name === 'ReplyError') return true;

    // Kiểm tra lỗi từ ioredis
    if (error.name === 'AbortError' && error.message.includes('redis'))
      return true;
    if (error.name === 'MaxRetriesPerRequestError') return true;
    if (
      error.message.includes('ECONNREFUSED') &&
      error.stack?.includes('redis')
    )
      return true;
    if (error.message.includes('Connection is closed')) return true;

    // Kiểm tra thêm các từ khóa liên quan đến Redis
    const redisKeywords = [
      'redis',
      'Redis',
      'connection',
      'timeout',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
    ];
    return redisKeywords.some(
      (keyword) =>
        error.message.includes(keyword) || error.stack?.includes(keyword),
    );
  }

  /**
   * Xử lý lỗi Redis một cách graceful
   */
  private handleRedisError(exception: Error, response: Response) {
    this.logger.warn(`Redis error handled: ${exception.message}`);

    // Tùy thuộc vào môi trường, có thể trả về lỗi chung hoặc chi tiết
    return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      success: false,
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau',
      error:
        process.env.NODE_ENV !== 'production' ? exception.message : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
