// src/common/swagger/swagger.module.ts

import { Module, Global } from '@nestjs/common';
import { SwaggerExplorer } from '@nestjs/swagger/dist/swagger-explorer';
import { SwaggerModelInterceptor } from '../interceptors/swagger-model.interceptor';

@Global()
@Module({
  providers: [SwaggerExplorer, SwaggerModelInterceptor],
  exports: [SwaggerExplorer, SwaggerModelInterceptor],
})
export class SwaggerModule {}
