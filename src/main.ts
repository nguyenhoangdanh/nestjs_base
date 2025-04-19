// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ZodExceptionFilter } from './lib/zod-exception.filter';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Sử dụng middleware
  app.use(cookieParser());
  
  // CORS configuration
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://nmtxts-daily-performance.vercel.app',
    ],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
      'Accept',
    ],
    exposedHeaders: ['Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  });
  
  // API prefix
  app.setGlobalPrefix('api/v1');
  
  // Global filters
  app.useGlobalFilters(new ZodExceptionFilter());
  
  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Bento NestJS API')
    .setDescription('API documentation for Bento NestJS Backend')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('roles', 'Role management endpoints')
    .addTag('permissions', 'Permission management endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in the controller!
    )
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  
  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`API documentation available at: http://localhost:${port}/api-docs`);
}

bootstrap();












// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import cookieParser from 'cookie-parser';
// import { ZodExceptionFilter } from './lib/zod-exception.filter';
// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   app.use(cookieParser());
//   app.enableCors({
//     origin: [
//       'http://localhost:3000',
//       'https://nmtxts-daily-performance.vercel.app',
//     ],
//     credentials: true, // Cho phép gửi cookies hoặc token qua request
//     allowedHeaders: [
//       'Content-Type',
//       'Authorization',
//       'X-CSRF-Token',
//       'X-Requested-With',
//       'Accept',
//     ],
//     exposedHeaders: ['Authorization'], // ⚠️ Phải thêm dòng này để client đọc được
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
//   });
//   app.setGlobalPrefix('api/v1');
//   // Global filter cho ZodError
//   app.useGlobalFilters(new ZodExceptionFilter());
//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();
