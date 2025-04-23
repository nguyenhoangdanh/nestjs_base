import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('Daily Performance API')
    .setDescription('API Documentation for Daily Performance Application')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description: 'Enter your JWT token here to authorize API requests',
      },
      'JWT-auth',
    )
    .addCookieAuth(
      'accessToken',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
      },
      'cookie-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);

  // Tùy chỉnh Swagger UI để lưu token qua các lần refresh
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      displayRequestDuration: true,
      syntaxHighlight: {
        theme: 'monokai',
      },
    },
    jsonDocumentUrl: 'swagger/json',
    customSiteTitle: 'Daily Performance API',
    customfavIcon: 'https://nestjs.com/favicon.ico',
    customCssUrl:
      process.env.NODE_ENV === 'production' ? '/swagger-custom.css' : undefined,
  });
}
