import {
  Injectable,
  ExecutionContext,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ITokenIntrospect } from '../interface';
import { TOKEN_INTROSPECTOR } from '../di-token';
import { RemoteAuthGuard } from './auth';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { extractTokenFromRequest } from '../../common/utils/token-extractor';

@Injectable()
export class SwaggerAuthGuard extends RemoteAuthGuard {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TOKEN_INTROSPECTOR) introspector: ITokenIntrospect,
  ) {
    super(introspector);
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Check if the endpoint is marked as public
      const isPublic = this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (isPublic) {
        return true;
      }

      const req = context.switchToHttp().getRequest();

      // Allow Swagger UI access
      if (req.originalUrl?.includes('/api-docs')) {
        return true;
      }

      // Allow OPTIONS requests for CORS preflight
      if (req.method === 'OPTIONS') {
        return true;
      }

      // Check for token
      const token = extractTokenFromRequest(req);
      if (!token) {
        // If we're in development, we could be more lenient
        if (process.env.NODE_ENV !== 'production') {
          console.log(
            'Non-authenticated request in development mode - allowing access',
          );
          req['requester'] = {
            sub: 'test-user',
            role: 'SUPER_ADMIN',
          };
          return true;
        }
        throw new UnauthorizedException(
          'Authentication required for API access',
        );
      }

      // Normal auth flow for authenticated requests
      return await super.canActivate(context);
    } catch (error) {
      console.error('Error in SwaggerAuthGuard:', error);
      throw error;
    }
  }

  // async canActivate(context: ExecutionContext): Promise<boolean> {
  //   try {
  //     // Check if the endpoint is marked as public
  //     const isPublic = this.reflector.getAllAndOverride<boolean>(
  //       IS_PUBLIC_KEY,
  //       [context.getHandler(), context.getClass()],
  //     );

  //     if (isPublic) {
  //       return true;
  //     }

  //     const req = context.switchToHttp().getRequest();

  //     // Allow access to Swagger UI documentation
  //     if (req.originalUrl?.includes('/api-docs')) {
  //       return true;
  //     }

  //     // Check if the request is from Swagger UI
  //     const isSwaggerRequest = req.headers['x-from-swagger'] === 'true';
  //     const token = extractTokenFromRequest(req);

  //     // If it's a Swagger-initiated request with a valid Bearer token, proceed with normal auth
  //     const hasAuthHeader =
  //       req.headers.authorization &&
  //       req.headers.authorization.startsWith('Bearer ');

  //     if (isSwaggerRequest && !hasAuthHeader) {
  //       // For testing from Swagger UI without auth during development
  //       // You can make this configurable based on environment
  //       // if (
  //       //   process.env.SWAGGER_REQUIRE_AUTH === 'true' ||
  //       //   process.env.NODE_ENV === 'production'
  //       // ) {
  //       //   throw new UnauthorizedException('Authentication required');
  //       // } else {
  //       //   // Your existing mock user code for development
  //       // }
  //       if (process.env.NODE_ENV !== 'production') {
  //         throw new UnauthorizedException(
  //           'Authentication required for API access',
  //         );
  //       }
  //     }

  //     // Swagger UI request handling
  //     if (isSwaggerRequest) {
  //       if (!token) {
  //         // In development mode, we might want to allow unauthenticated Swagger requests
  //         if (process.env.NODE_ENV !== 'production') {
  //           // Manually set a mock user for development purposes only
  //           req['requester'] = {
  //             sub: 'swagger-test-user',
  //             role: 'ADMIN',
  //           };
  //           return true;
  //         }
  //         // In production, we require authentication
  //         throw new UnauthorizedException(
  //           'Authentication required for API access',
  //         );
  //       }

  //       // If token is provided, validate it normally
  //       return await super.canActivate(context);
  //     }

  //     // For all other requests, delegate to parent auth guard
  //     return await super.canActivate(context);
  //   } catch (error) {
  //     console.error('Error in SwaggerAuthGuard:', error);
  //     throw error;
  //   }
  // }
}
