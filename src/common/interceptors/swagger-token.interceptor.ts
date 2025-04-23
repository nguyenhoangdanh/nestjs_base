import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class SwaggerTokenInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const referer = req.headers.referer || '';

    // Thêm header nhận dạng cho requests từ Swagger UI
    if (referer.includes('/api-docs')) {
      req.headers['x-swagger-ui'] = 'true';
    }

    return next.handle();
  }
}
