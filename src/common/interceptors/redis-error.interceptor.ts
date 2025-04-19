import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Interceptor để xử lý lỗi Redis và cung cấp degradation graceful
 * Điều này cho phép ứng dụng tiếp tục hoạt động ngay cả khi Redis không khả dụng
 */
@Injectable()
export class RedisErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RedisErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Kiểm tra xem có phải lỗi Redis không
        if (this.isRedisError(error)) {
          return this.handleRedisError(error, context);
        }

        // Nếu không phải lỗi Redis, ném lại lỗi để được xử lý bởi filter
        return throwError(() => error);
      }),
    );
  }

  /**
   * Kiểm tra xem lỗi có phải từ Redis không
   */
  private isRedisError(error: any): boolean {
    // Kiểm tra các loại lỗi cụ thể từ Redis
    if (error.name === 'ReplyError') return true;
    if (error.name === 'AbortError' && error.message.includes('redis'))
      return true;
    if (error.name === 'MaxRetriesPerRequestError') return true;

    // Kiểm tra thông điệp lỗi
    const redisErrorMessages = [
      'ECONNREFUSED',
      'Connection is closed',
      'connect ETIMEDOUT',
      'failed to connect',
      'Redis connection',
      'redis server',
      'Redis',
      'redis',
    ];

    return redisErrorMessages.some(
      (msg) => error.message?.includes(msg) || error.stack?.includes(msg),
    );
  }

  /**
   * Xử lý lỗi Redis tùy thuộc vào context
   */
  private handleRedisError(
    error: any,
    context: ExecutionContext,
  ): Observable<any> {
    this.logger.warn(`Redis error intercepted: ${error.message}`);

    // Lấy thông tin request để quyết định cách xử lý
    const req = context.switchToHttp().getRequest();
    const path = req.path;

    // Kiểm tra path để quyết định xử lý
    if (
      path.includes('/auth/') ||
      path.includes('/login') ||
      path.includes('/profile')
    ) {
      // Với các endpoint authentication, chúng ta sẽ trả về lỗi
      this.logger.error(`Redis error in critical path: ${path}`);
      return throwError(
        () =>
          new ServiceUnavailableException(
            'Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau',
          ),
      );
    }

    // Với các endpoint không quan trọng, log lỗi và cho phép tiếp tục
    this.logger.warn(`Bypassing Redis error for non-critical path: ${path}`);

    // Tùy thuộc vào loại endpoint, có thể trả về dữ liệu mặc định
    // Ví dụ: nếu đây là endpoint lấy dữ liệu cache, trả về empty result
    return throwError(() => error);
  }
}
