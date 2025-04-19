import { Module, Global, Provider, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import {
  REDIS_CACHE_SERVICE,
  REDIS_CLIENT,
  REDIS_HEALTH_SERVICE,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER_FACTORY,
} from './redis.constants';
import { RedisHealthService } from './redis-health.service';
import { RedisPublisher } from './redis-publisher.service';
import { RedisCacheService } from './redis-cache.service';

// Mock Redis Client cho môi trường dev
class MockRedisClient {
  private static mockStore = new Map<
    string,
    { value: string; expiry: number | null }
  >();
  private cache = new Map<string, string>();
  private logger = new Logger('MockRedisClient');
  constructor() {
    this.logger.log('MockRedisClient initialized');
  }

  // Các phương thức Redis cơ bản
  async get(key: string): Promise<string | null> {
    return this.cache.get(key) || null;
  }

  // Add a method to debug and clean expired keys
  async cleanExpiredKeys(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    MockRedisClient.mockStore.forEach((value, key) => {
      if (value.expiry !== null && value.expiry < now) {
        MockRedisClient.mockStore.delete(key);
        cleaned++;
      }
    });

    return cleaned;
  }

  // Override the set method to ensure proper storage
  async set(
    key: string,
    value: string,
    mode?: string,
    duration?: number,
  ): Promise<'OK'> {
    // Clean expired keys first
    await this.cleanExpiredKeys();

    // Calculate expiry time if needed
    const expiry =
      mode === 'EX' && duration ? Date.now() + duration * 1000 : null;

    // Store the value
    MockRedisClient.mockStore.set(key, { value, expiry });

    // Debug check
    const entry = MockRedisClient.mockStore.get(key);

    return 'OK';
  }

  // Override exists to ensure blacklist checks work
  async exists(key: string): Promise<number> {
    // Clean expired keys first
    await this.cleanExpiredKeys();

    const entry = MockRedisClient.mockStore.get(key);

    if (entry) {
      this.logger.debug(`Mock Redis: Key ${key} exists and is valid`);
      return 1;
    }

    this.logger.debug(`Mock Redis: Key ${key} does not exist`);
    return 0;
  }

  // Implement a debugging helper method
  static listAllKeys(): void {
    const logger = new Logger('MockRedisClient');
    logger.debug('Current mock Redis store contents:');

    MockRedisClient.mockStore.forEach((value, key) => {
      const status =
        value.expiry && value.expiry < Date.now() ? 'expired' : 'valid';
      logger.debug(`Key: ${key}, Status: ${status}, Value: ${value.value}`);
    });
  }

  async del(key: string): Promise<number> {
    this.logger.debug(`Mock Redis DEL: ${key}`);
    const existed = this.cache.has(key);
    this.cache.delete(key);
    return existed ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.logger.debug(`Mock Redis EXPIRE: ${key} ${seconds}`);
    return this.cache.has(key) ? 1 : 0;
  }

  async publish(channel: string, message: string): Promise<number> {
    this.logger.debug(`Mock Redis PUBLISH: ${channel} ${message}`);
    return 0;
  }

  async subscribe(channel: string): Promise<void> {
    this.logger.debug(`Mock Redis SUBSCRIBE: ${channel}`);
  }

  async psubscribe(pattern: string): Promise<void> {
    this.logger.debug(`Mock Redis PSUBSCRIBE: ${pattern}`);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  // Redis event emitter interface
  on(event: string, callback: any): this {
    this.logger.debug(`Mock Redis ON: ${event}`);
    return this;
  }

  duplicate(): MockRedisClient {
    this.logger.debug(`Creating duplicate MockRedisClient`);
    return new MockRedisClient();
  }
}

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    const logger = new Logger('RedisProvider');

    // Đọc cấu hình
    const redisUrl = configService.get<string>('REDIS_URL');
    const useMock = configService.get<string>('USE_MOCK_REDIS') === 'true';

    // Nếu USE_MOCK_REDIS=true, sử dụng MockRedisClient
    if (useMock) {
      logger.log('Using MockRedisClient instead of real Redis connection');
      return new MockRedisClient();
    }

    let client: Redis;

    try {
      if (redisUrl) {
        // Sử dụng URL kết nối
        logger.log(`Connecting to Redis using URL connection string`);

        client = new Redis(redisUrl, {
          retryStrategy: (times: number) => {
            if (times > 10) {
              logger.error(`Redis connection failed after ${times} retries`);
              return null; // Stop retrying after 10 attempts
            }
            const delay = Math.min(times * 200, 2000);
            logger.warn(
              `Redis connection retry in ${delay}ms (attempt ${times})`,
            );
            return delay; // Increase retry delay gradually, max 2s
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          connectTimeout: 10000, // 10 seconds
          tls: {
            rejectUnauthorized: false,
          },
        });
      } else {
        // Fallback to individual settings
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD');
        const db = configService.get<number>('REDIS_DB', 0);
        const tls = configService.get<boolean>('REDIS_TLS', true);

        // Determine if we have a password
        const hasPassword = password && password.trim() !== '';

        logger.log(
          `Connecting to Redis at ${host}:${port} (DB: ${db}, Auth: ${hasPassword ? 'Yes' : 'No'}, TLS: ${tls ? 'Yes' : 'No'})`,
        );

        // For Redis connections with authentication
        const redisOptions: RedisOptions = {
          host,
          port,
          db,
          tls: tls
            ? {
                // Upstash requires TLS
                rejectUnauthorized: false,
              }
            : undefined,
          // Only include password if it exists
          ...(hasPassword ? { password } : {}),
          // Additional connection options
          retryStrategy: (times: number) => {
            if (times > 10) {
              logger.error(`Redis connection failed after ${times} retries`);
              return null; // Stop retrying after 10 attempts
            }
            const delay = Math.min(times * 200, 2000);
            logger.warn(
              `Redis connection retry in ${delay}ms (attempt ${times})`,
            );
            return delay; // Increase retry delay gradually, max 2s
          },
          connectionName: 'app_connection',
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
          reconnectOnError: (err: Error) => {
            const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNREFUSED'];
            const shouldReconnect = targetErrors.some((e) =>
              err.message.includes(e),
            );
            if (shouldReconnect) {
              logger.warn(`Redis reconnecting due to error: ${err.message}`);
            }
            return shouldReconnect;
          },
        };

        client = new Redis(redisOptions);
      }

      // Add event listeners for better monitoring
      client.on('connect', () => {
        logger.log('Connected to Redis server');
      });

      client.on('error', (error) => {
        logger.error(`Redis error: ${error.message}`);

        // Provide more helpful error messages for authentication issues
        if (
          error.message.includes('NOAUTH') ||
          error.message.includes('WRONGPASS')
        ) {
          logger.error(
            'Redis authentication failed. Please check your Redis credentials.',
          );
        }

        // DNS resolution issues
        if (error.message.includes('ENOTFOUND')) {
          logger.error(
            'Failed to resolve Redis hostname. Consider using USE_MOCK_REDIS=true if developing locally.',
          );
        }
      });

      client.on('ready', () => {
        logger.log('Redis is ready to accept commands');
      });

      client.on('reconnecting', () => {
        logger.warn('Reconnecting to Redis server...');
      });

      return client;
    } catch (error) {
      logger.error(`Failed to create Redis client: ${error.message}`);
      logger.warn('Falling back to MockRedisClient');
      return new MockRedisClient();
    }
  },
  inject: [ConfigService],
};

// Factory Provider cho subscriber kết nối
const redisSubscriberFactoryProvider: Provider = {
  provide: REDIS_SUBSCRIBER_FACTORY,
  useFactory: (configService: ConfigService) => {
    const logger = new Logger('RedisSubscriberFactory');
    const useMock = configService.get<string>('USE_MOCK_REDIS') === 'true';

    return {
      create: () => {
        // Nếu sử dụng mock, trả về MockRedisClient
        if (useMock) {
          logger.log('Creating mock Redis subscriber');
          return new MockRedisClient();
        }

        // Tạo một kết nối riêng cho subscriber
        logger.log('Creating new Redis subscriber connection');
        try {
          const redisUrl = configService.get<string>('REDIS_URL');
          if (redisUrl) {
            return new Redis(redisUrl, {
              connectionName: 'subscriber_connection',
            });
          } else {
            const host = configService.get<string>('REDIS_HOST', 'localhost');
            const port = configService.get<number>('REDIS_PORT', 6379);
            const password = configService.get<string>('REDIS_PASSWORD');
            const db = configService.get<number>('REDIS_DB', 0);
            const tls = configService.get<boolean>('REDIS_TLS', true);

            const hasPassword = password && password.trim() !== '';

            return new Redis({
              host,
              port,
              db,
              ...(hasPassword ? { password } : {}),
              tls: tls ? { rejectUnauthorized: false } : undefined,
              connectionName: 'subscriber_connection',
            });
          }
        } catch (error) {
          logger.error(`Failed to create Redis subscriber: ${error.message}`);
          return new MockRedisClient();
        }
      },
    };
  },
  inject: [ConfigService],
};

// Redis Health Service Provider
const redisHealthProvider: Provider = {
  provide: REDIS_HEALTH_SERVICE,
  useClass: RedisHealthService,
};

// Redis Publisher Service Provider
const redisPublisherProvider: Provider = {
  provide: REDIS_PUBLISHER,
  useClass: RedisPublisher,
};

const services: Provider[] = [
  {
    provide: REDIS_CACHE_SERVICE,
    useClass: RedisCacheService,
  },
];

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ...services,
    redisProvider,
    redisSubscriberFactoryProvider,
    redisHealthProvider,
    redisPublisherProvider,
  ],
  exports: [
    REDIS_CACHE_SERVICE,
    REDIS_CLIENT,
    REDIS_SUBSCRIBER_FACTORY,
    REDIS_HEALTH_SERVICE,
    REDIS_PUBLISHER,
  ],
})
export class RedisModule {}
