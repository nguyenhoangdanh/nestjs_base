import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Interceptor to handle Redis errors and provide graceful degradation
 * This allows the application to continue functioning even when Redis is unavailable
 */
@Injectable()
export class RedisErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RedisErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Check if this is a Redis error
        if (this.isRedisError(error)) {
          return this.handleRedisError(error, context);
        }

        // If not a Redis error, rethrow for handling by filters
        return throwError(() => error);
      }),
    );
  }

  /**
   * Check if an error is from Redis
   */
  private isRedisError(error: any): boolean {
    // Check for specific Redis error types
    if (error.name === 'ReplyError') return true;
    if (error.name === 'AbortError' && error.message.includes('redis'))
      return true;
    if (error.name === 'MaxRetriesPerRequestError') return true;

    // Check error messages
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
   * Handle Redis errors based on context
   */
  private handleRedisError(
    error: any,
    context: ExecutionContext,
  ): Observable<any> {
    this.logger.warn(`Redis error intercepted: ${error.message}`);

    // Get request info to determine handling
    const req = context.switchToHttp().getRequest();
    const path = req.path;

    // Check path to determine handling
    const criticalPaths = [
      '/auth/',
      '/login',
      '/profile',
      '/token',
      '/session',
    ];

    const isCriticalPath = criticalPaths.some((criticalPath) =>
      path.includes(criticalPath),
    );

    if (isCriticalPath) {
      // For authentication endpoints, return an error
      this.logger.error(`Redis error in critical path: ${path}`);
      return throwError(
        () =>
          new ServiceUnavailableException(
            'Service temporarily unavailable, please try again later',
          ),
      );
    }

    // For non-critical endpoints, log error and return a fallback value
    this.logger.warn(`Bypassing Redis error for non-critical path: ${path}`);

    // Determine the appropriate fallback value based on the endpoint
    if (path.includes('/search') || path.includes('/list')) {
      return of({ data: [], total: 0, message: 'Cache unavailable' });
    }

    if (path.includes('/count')) {
      return of({ count: 0, message: 'Cache unavailable' });
    }

    if (path.includes('/check') || path.includes('/validate')) {
      return of({ valid: false, message: 'Cache unavailable' });
    }

    // Default fallback for other endpoints
    return of({ success: false, message: 'Cache unavailable' });
  }
}
