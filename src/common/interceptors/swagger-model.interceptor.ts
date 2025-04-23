// src/common/interceptors/swagger-model.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiExtraModels } from '@nestjs/swagger';
import { DECORATORS } from '@nestjs/swagger/dist/constants';

@Injectable()
export class SwaggerModelInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get models registered from controller
    const models: Type<any>[] =
      Reflect.getMetadata(DECORATORS.API_EXTRA_MODELS, controller) || [];

    // Register them to handler
    models.forEach((model: Type<any>) => {
      ApiExtraModels(model)(handler);
    });

    return next.handle();
  }
}
