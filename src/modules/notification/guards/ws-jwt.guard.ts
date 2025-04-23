// src/modules/notification/guards/ws-jwt.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { TOKEN_SERVICE } from '../../auth/auth.di-token';
import { ITokenService } from '../../auth/auth.interface';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth.token;

      if (!token) {
        throw new WsException('Missing token');
      }

      const payload = await this.tokenService.verifyToken(token);
      if (!payload) {
        throw new WsException('Invalid token');
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.tokenService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new WsException('Token has been invalidated');
      }

      return true;
    } catch (error) {
      throw new WsException(error.message);
    }
  }
}
