import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TOKEN_INTROSPECTOR } from '../di-token';
import { ITokenIntrospect } from '../interface';

@Injectable()
export class RemoteAuthGuard implements CanActivate {
  private readonly logger = new Logger(RemoteAuthGuard.name);
  constructor(
    @Inject(TOKEN_INTROSPECTOR) private readonly introspector: ITokenIntrospect,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const token = extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Bạn cần đăng nhập để truy cập');
    }

    try {
      // Check blacklist first - this is critical
      const isBlacklisted = await this.introspector.isTokenBlacklisted(token);

      if (isBlacklisted) {
        // Help the client by clearing any cookies
        response.clearCookie('accessToken', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });
        throw new UnauthorizedException(
          'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
        );
      }

      // Verify token validity
      const { payload, error, isOk } =
        await this.introspector.introspect(token);

      if (!isOk || !payload) {
        const errorMsg = error?.message || 'Invalid token';
        throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
      }

      // Set user info in request
      request['requester'] = {
        sub: payload.sub,
        role: payload.role,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }
}

function extractTokenFromRequest(request: Request): string | undefined {
  // Check both cookie and Authorization header
  const cookieToken = request.cookies?.accessToken;
  const authHeader = request.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : undefined;

  // Return the first available token
  return cookieToken || headerToken;
}

// // Helper để lấy token từ request
// function extractTokenFromRequest(request: Request): string | undefined {
//   // Ưu tiên lấy token từ cookie
//   if (request.cookies?.accessToken) {
//     return request.cookies.accessToken;
//   }

//   // Nếu không có trong cookie, lấy từ Authorization header
//   const [type, token] = request.headers.authorization?.split(' ') ?? [];
//   return type === 'Bearer' ? token : undefined;
// }

@Injectable()
export class RemoteAuthGuardOptional implements CanActivate {
  constructor(
    @Inject(TOKEN_INTROSPECTOR) private readonly introspector: ITokenIntrospect,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Bạn cần đăng nhập để truy cập');
    }

    try {
      const { payload, error, isOk } =
        await this.introspector.introspect(token);

      if (!isOk) {
        console.error('Token introspect error:', error);
        return true; // Cho phép truy cập nếu token không hợp lệ
      }

      request['requester'] = payload;
    } catch (error) {
      console.error('Token introspect error:', error);
      return true; // Cho phép truy cập nếu có lỗi
    }

    return true;
  }
}
