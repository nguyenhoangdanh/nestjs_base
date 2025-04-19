import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenIntrospectResult, TokenPayload } from 'src/share';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { ITokenService } from '../../modules/user/user.port';
import {
  REDIS_CACHE_SERVICE,
  REDIS_CLIENT,
} from 'src/common/redis/redis.constants';
import { RedisCacheService } from 'src/common/redis';

@Injectable()
export class TokenService implements ITokenService {
  private readonly TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';
  private readonly DEFAULT_EXPIRY = '1d'; // 1 day default token expiry
  private readonly logger = new Logger(TokenService.name);
  private readonly localTokenCache = new Map<
    string,
    { isBlacklisted: boolean; timestamp: number }
  >();
  private readonly TOKEN_CACHE_TTL_MS = 60000; // 1 minute local cache

  constructor(
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @Inject(REDIS_CACHE_SERVICE)
    private readonly cacheService: RedisCacheService,
  ) {
    this.logger.log('TokenService initialized with Redis client');
  }

  async generateToken(
    payload: TokenPayload,
    expiresIn: string = this.DEFAULT_EXPIRY,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, { expiresIn });
  }

  async generateResetToken(): Promise<string> {
    return randomBytes(32).toString('hex');
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      // Kiểm tra xem token có trong blacklist không
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        this.logger.debug('Token is blacklisted');
        return null;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token);
      return payload;
    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`);
      return null;
    }
  }

  decodeToken(token: string): TokenPayload | null {
    try {
      return this.jwtService.decode(token) as TokenPayload;
    } catch (error) {
      this.logger.error(`Token decoding failed: ${error.message}`);
      return null;
    }
  }

  getExpirationTime(token: string): number {
    try {
      const decoded = this.jwtService.decode(token) as { exp?: number };
      if (!decoded || !decoded.exp) {
        return 0;
      }

      const expiryTimestamp = decoded.exp * 1000;
      const currentTimestamp = Date.now();

      return Math.max(
        0,
        Math.floor((expiryTimestamp - currentTimestamp) / 1000),
      );
    } catch (error) {
      this.logger.error(`Error getting token expiry: ${error.message}`);
      return 0;
    }
  }

  // Helper method to ensure consistent hashing
  private getTokenKey(token: string): string {
    // Use consistent hashing for tokens to avoid storing the full JWT
    const hash = createHash('sha256').update(token).digest('hex');
    return `${this.TOKEN_BLACKLIST_PREFIX}${hash}`;
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      if (!token) {
        this.logger.warn('Attempted to check blacklist for empty token');
        return false;
      }

      const blacklistKey = this.getTokenKey(token);

      // Check local cache first to avoid Redis calls
      const now = Date.now();
      const cachedValue = this.localTokenCache.get(blacklistKey);

      if (
        cachedValue &&
        now - cachedValue.timestamp < this.TOKEN_CACHE_TTL_MS
      ) {
        // Use cached value if it's still fresh
        this.logger.debug(
          `Using cached blacklist status for token: ${cachedValue.isBlacklisted}`,
        );
        return cachedValue.isBlacklisted;
      }

      this.logger.debug(`Checking if token is blacklisted: ${blacklistKey}`);
      const exists = await this.redisClient.exists(blacklistKey);
      const isBlacklisted = exists === 1;

      // Update local cache
      this.localTokenCache.set(blacklistKey, {
        isBlacklisted,
        timestamp: now,
      });

      // Clean up old cache entries periodically
      if (this.localTokenCache.size > 1000) {
        this.cleanupLocalCache();
      }

      return isBlacklisted;
    } catch (error) {
      this.logger.error(
        `Redis error in isTokenBlacklisted: ${error.message}`,
        error.stack,
      );
      return false; // Graceful degradation if Redis is unavailable
    }
  }

  private cleanupLocalCache(): void {
    const now = Date.now();
    for (const [key, value] of this.localTokenCache.entries()) {
      if (now - value.timestamp > this.TOKEN_CACHE_TTL_MS) {
        this.localTokenCache.delete(key);
      }
    }
  }

  async blacklistToken(token: string, expiresIn: number): Promise<void> {
    try {
      if (!token || token.trim() === '') {
        this.logger.warn('Attempted to blacklist empty token');
        return;
      }

      if (expiresIn <= 0) {
        this.logger.debug('Token already expired, no need to blacklist');
        return;
      }

      const blacklistKey = this.getTokenKey(token);

      // Cập nhật cache local trước
      this.localTokenCache.set(blacklistKey, {
        isBlacklisted: true,
        timestamp: Date.now(),
      });

      // Lưu vào Redis
      await this.redisClient.set(blacklistKey, '1', 'EX', expiresIn);
      this.logger.debug(`Token blacklisted successfully: ${blacklistKey}`);
    } catch (error) {
      this.logger.error(
        `Error blacklisting token: ${error.message}`,
        error.stack,
      );
    }
  }

  async introspect(token: string): Promise<TokenIntrospectResult> {
    try {
      // Kiểm tra blacklist
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return {
          payload: null,
          error: new Error('Token đã bị vô hiệu hóa'),
          isOk: false,
        };
      }

      // Verify token
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token);

      return { payload, isOk: true };
    } catch (error) {
      this.logger.error(`Token introspection error: ${error.message}`);
      return {
        payload: null,
        error,
        isOk: false,
      };
    }
  }

  async trackUserSession(userId: string, token: string): Promise<void> {
    const sessionKey = `user:sessions:${userId}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Add this token to the user's active sessions
    await this.redisClient.sadd(sessionKey, tokenHash);

    // Set expiry based on token expiration
    const expiresIn = this.getExpirationTime(token);
    if (expiresIn > 0) {
      await this.redisClient.expire(sessionKey, expiresIn);
    }
  }

  async isValidUserSession(userId: string, token: string): Promise<boolean> {
    const sessionKey = `user:sessions:${userId}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Check if this token is in the user's active sessions
    const isMember = await this.redisClient.sismember(sessionKey, tokenHash);
    return isMember === 1;
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    const sessionKey = `user:sessions:${userId}`;

    // Get all session tokens
    const sessions = await this.redisClient.smembers(sessionKey);

    // Blacklist each token
    for (const tokenHash of sessions) {
      const blacklistKey = `${this.TOKEN_BLACKLIST_PREFIX}${tokenHash}`;
      await this.redisClient.set(blacklistKey, '1', 'EX', 86400); // 24 hours

      // Cập nhật cache local
      this.localTokenCache.set(blacklistKey, {
        isBlacklisted: true,
        timestamp: Date.now(),
      });
    }

    // Remove the session tracking
    await this.redisClient.del(sessionKey);
  }
}
