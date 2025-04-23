import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { extractTokenFromRequest } from '../utils/token-extractor';

@Catch(UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Check if this is a Swagger UI request
    const isSwaggerRequest = request.headers['x-from-swagger'] === 'true';

    // Use the utility function to extract token
    const token = extractTokenFromRequest(request);

    // Customize message based on context
    const message = !token
      ? 'Authentication required'
      : 'Invalid or expired token';

    // For Swagger requests, we might want a more detailed response
    const additionalInfo = isSwaggerRequest
      ? {
          docs: 'Please authenticate using the Authorize button in Swagger UI',
          tokenFound: !!token,
        }
      : undefined;

    console.error('Auth exception details:', {
      url: request.url,
      method: request.method,
      headers: request.headers,
      message: exception.message,
    });

    response.status(401).json({
      statusCode: 401,
      success: false,
      message: message,
      ...additionalInfo,
      timestamp: new Date().toISOString(),
    });
  }
}
