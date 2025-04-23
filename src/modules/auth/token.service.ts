import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ITokenService } from './auth.port';
import { TokenPayload } from './auth.types';
import { PrismaService } from '../../share/prisma.service';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import Redis from 'ioredis';
import { AppError } from '../../share';

@Injectable()
export class TokenService implements ITokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly ACCESS_TOKEN_EXPIRY = '1h'; // 1 hour
  private readonly REFRESH_TOKEN_EXPIRY = '30d'; // 30 days
  private readonly BLACKLIST_PREFIX = 'token:blacklist:';

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async generateTokens(
    payload: TokenPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Generate access token
      const accessToken = await this.jwtService.signAsync(
        { ...payload },
        { expiresIn: this.ACCESS_TOKEN_EXPIRY },
      );

      // Generate refresh token
      const refreshToken = await this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        { expiresIn: this.REFRESH_TOKEN_EXPIRY },
      );

      // Store refresh token in database for revocation
      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: payload.sub,
          expiresAt: this.getExpiryDate(this.REFRESH_TOKEN_EXPIRY),
        },
      });

      return { accessToken, refreshToken };
    } catch (error) {
      this.logger.error(`Generate tokens error: ${error.message}`, error.stack);
      throw AppError.from(
        new Error(`Failed to generate tokens: ${error.message}`),
        500,
      );
    }
  }

  async verifyAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return null;
      }

      // Verify token
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token);
      return payload;
    } catch (error) {
      this.logger.debug(`Invalid access token: ${error.message}`);
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload | null> {
    try {
      // Check if token exists in database
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          token,
          expiresAt: { gt: new Date() },
          revoked: false,
        },
      });

      if (!storedToken) {
        return null;
      }

      // Verify token
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token);

      // Check if it's a refresh token
      if (payload.type !== 'refresh') {
        return null;
      }

      return payload;
    } catch (error) {
      this.logger.debug(`Invalid refresh token: ${error.message}`);
      return null;
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      // Try to decode token without verification to get expiry
      const decoded = this.jwtService.decode(token);
      let expiryInSeconds = 3600; // Default 1 hour if can't determine

      if (decoded && typeof decoded === 'object' && decoded.exp) {
        const expiryTimestamp = decoded.exp * 1000;
        const currentTime = Date.now();
        expiryInSeconds = Math.max(
          0,
          Math.floor((expiryTimestamp - currentTime) / 1000),
        );
      }

      // Add token to blacklist
      await this.redisClient.set(
        `${this.BLACKLIST_PREFIX}${token}`,
        '1',
        'EX',
        expiryInSeconds,
      );

      // If it's a refresh token, revoke it in the database
      if (
        decoded &&
        typeof decoded === 'object' &&
        decoded.type === 'refresh'
      ) {
        await this.prisma.refreshToken.updateMany({
          where: { token },
          data: { revoked: true },
        });
      }
    } catch (error) {
      this.logger.error(`Revoke token error: ${error.message}`, error.stack);
      // Not critical, just log error
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      // Revoke all refresh tokens
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revoked: false,
        },
        data: { revoked: true },
      });

      // We can't directly revoke all access tokens, as they are stateless
      // We would need to implement token versioning or a system-wide logout mechanism
      // For now, we rely on refresh token revocation and session management
    } catch (error) {
      this.logger.error(
        `Revoke all user tokens error: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to revoke all tokens: ${error.message}`),
        500,
      );
    }
  }

  // Helper methods
  private async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const exists = await this.redisClient.exists(
        `${this.BLACKLIST_PREFIX}${token}`,
      );
      return exists === 1;
    } catch (error) {
      this.logger.error(`Check blacklist error: ${error.message}`, error.stack);
      return false; // If Redis fails, allow token (better UX)
    }
  }

  private getExpiryDate(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([smhdw])$/);

    if (!match) {
      // Default to 1 hour if format is invalid
      now.setHours(now.getHours() + 1);
      return now;
    }

    const [, amount, unit] = match;
    const value = parseInt(amount, 10);

    switch (unit) {
      case 's': // seconds
        now.setSeconds(now.getSeconds() + value);
        break;
      case 'm': // minutes
        now.setMinutes(now.getMinutes() + value);
        break;
      case 'h': // hours
        now.setHours(now.getHours() + value);
        break;
      case 'd': // days
        now.setDate(now.getDate() + value);
        break;
      case 'w': // weeks
        now.setDate(now.getDate() + value * 7);
        break;
      default:
        now.setHours(now.getHours() + 1); // Default to 1 hour
    }

    return now;
  }
}
