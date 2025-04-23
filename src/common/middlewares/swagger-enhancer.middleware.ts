import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SwaggerEnhancerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Thêm header cho requests gọi từ Swagger UI
    const referer = (req.headers.referer as string) || '';
    if (referer.includes('/api-docs')) {
      req.headers['x-from-swagger'] = 'true';
      console.log('Swagger request detected:', req.path);
    }

    next();
  }
}
