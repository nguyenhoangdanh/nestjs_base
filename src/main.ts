import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ZodExceptionFilter } from './lib/zod-exception.filter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://nmtxts-daily-performance.vercel.app',
    ],
    credentials: true, // Cho phép gửi cookies hoặc token qua request
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
      'Accept',
    ],
    exposedHeaders: ['Authorization'], // ⚠️ Phải thêm dòng này để client đọc được
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  });
  app.setGlobalPrefix('api/v1');
  // Global filter cho ZodError
  app.useGlobalFilters(new ZodExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
