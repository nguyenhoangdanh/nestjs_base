// src/app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionModule } from './modules/permission/permission.module';
import { ShareModule } from './share/module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './common/redis';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppErrorFilter } from './common/exceptions/app-error.filter';
import { SwaggerModule } from './common/swagger/swagger.module';
import { SwaggerAuthGuard } from './share/guard/swagger-auth.guard';
import { SwaggerModelInterceptor } from './common/interceptors/swagger-model.interceptor';
import { SwaggerEnhancerMiddleware } from './common/middlewares/swagger-enhancer.middleware';

@Module({
  imports: [
    // Serve static files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
      exclude: ['/api*'],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
      exclude: ['/api*'],
    }),

    // Config module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? '.env'
          : `.env.${process.env.NODE_ENV || 'development'}`,
    }),

    // Đăng ký module Swagger tùy chỉnh
    SwaggerModule,

    // Core modules
    ShareModule,
    RedisModule,

    // Feature modules
    AuthModule, // Thêm AuthModule mới
    RoleModule,
    PermissionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Authentication guards - Sử dụng guard tùy chỉnh cho Swagger
    {
      provide: APP_GUARD,
      useClass: SwaggerAuthGuard,
    },
    // Global filters and interceptors
    {
      provide: APP_FILTER,
      useClass: AppErrorFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SwaggerModelInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply SwaggerEnhancerMiddleware to all routes
    consumer.apply(SwaggerEnhancerMiddleware).forRoutes('*');
  }
}
