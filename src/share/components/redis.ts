import { Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { EventHandler } from '..';
import { AppEvent } from '../data-model';
import { IEventPublisher } from '../interface';

const globalMockCache = new Map<
  string,
  { value: string; expiry: number | null }
>();
// Simple mock Redis client implementation
const createSimpleMockRedisClient = () => {
  const logger = new Logger('MockRedisClient');
  const mockCache = new Map<string, string>();

  return {
    connect: async () => {
      logger.log('Mock Redis Client connected');
      return Promise.resolve();
    },
    disconnect: async () => Promise.resolve(),
    on: (event: string, callback: any) => {},
    publish: async (channel: string, message: string) => {
      logger.debug(`Mock Redis PUBLISH: ${channel} ${message}`);
      return 0;
    },
    subscribe: async (channel: string, callback: any) => {
      logger.debug(`Mock Redis SUBSCRIBE: ${channel}`);
      return;
    },
    duplicate: () => {
      return createSimpleMockRedisClient();
    },
    et: async (
      key: string,
      value: string,
      mode?: string,
      duration?: number,
    ) => {
      logger.debug(
        `Mock Redis SET: ${key}, value: ${value}, mode: ${mode}, duration: ${duration}`,
      );

      const expiry =
        mode === 'EX' && duration ? Date.now() + duration * 1000 : null;

      globalMockCache.set(key, { value, expiry });
      return 'OK';
    },

    exists: async (key: string) => {
      logger.debug(`Mock Redis EXISTS: ${key}`);

      const entry = globalMockCache.get(key);

      if (entry) {
        // Kiểm tra xem key có hết hạn không
        if (entry.expiry !== null && entry.expiry < Date.now()) {
          logger.debug(`Mock Redis: Key ${key} expired, returning 0`);
          globalMockCache.delete(key); // Cleanup expired key
          return 0;
        }

        logger.debug(`Mock Redis: Key ${key} exists, returning 1`);
        return 1;
      }

      logger.debug(`Mock Redis: Key ${key} not found, returning 0`);
      return 0;
    },

    get: async (key: string) => {
      logger.debug(`Mock Redis GET: ${key}`);

      const entry = globalMockCache.get(key);

      if (entry) {
        // Kiểm tra xem key có hết hạn không
        if (entry.expiry !== null && entry.expiry < Date.now()) {
          logger.debug(`Mock Redis: Key ${key} expired, returning null`);
          globalMockCache.delete(key); // Cleanup expired key
          return null;
        }

        logger.debug(
          `Mock Redis: Key ${key} exists, returning value: ${entry.value}`,
        );
        return entry.value;
      }

      logger.debug(`Mock Redis: Key ${key} not found, returning null`);
      return null;
    },

    del: async (key: string) => {
      logger.debug(`Mock Redis DEL: ${key}`);
      const existed = mockCache.has(key);
      mockCache.delete(key);
      return existed ? 1 : 0;
    },
  };
};

export class RedisClient implements IEventPublisher {
  private static instance: RedisClient;

  redisClient: RedisClientType;
  private subscriberMap: Record<string, RedisClientType[]> = {};
  private logger = new Logger('RedisClient');
  private useMock = process.env.USE_MOCK_REDIS === 'true';

  private constructor(connectionUrl: string) {
    if (this.useMock) {
      this.logger.log('Using mock Redis client for Node.js Redis');
      this.redisClient =
        createSimpleMockRedisClient() as unknown as RedisClientType;
    } else {
      const url = connectionUrl;
      this.logger.log(`Connecting to Redis using URL: ${connectionUrl}`);
      this.redisClient = createClient({ url });

      this.redisClient.on('error', (err) => {
        this.logger.error('Redis Client Error:', err);
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Connected to Redis server');
      });
    }
  }

  public static async init(connectionUrl: string) {
    if (!this.instance) {
      this.instance = new RedisClient(connectionUrl);
      await this.instance._connect();
    }
  }

  public static getInstance(): RedisClient {
    if (!this.instance) {
      throw new Error('RedisClient instance not initialized');
    }

    return this.instance;
  }

  private async _connect(): Promise<void> {
    if (this.useMock) {
      this.logger.log('Mock Redis client is ready');
      return;
    }

    try {
      await this.redisClient.connect();
      this.logger.log('Connected to redis server');
    } catch (error) {
      this.logger.error((error as Error).message);
    }
  }

  public async publish<T>(event: AppEvent<T>): Promise<void> {
    try {
      if (this.useMock) {
        this.logger.debug(`Mock publish: ${event.eventName}`);
        return;
      }

      await this.redisClient.publish(
        event.eventName,
        JSON.stringify(event.plainObject()),
      );
    } catch (err) {
      this.logger.error((err as Error).message);
    }
  }

  public async subscribe(topic: string, fn: EventHandler): Promise<void> {
    try {
      if (this.useMock) {
        this.logger.debug(`Mock subscribe: ${topic}`);
        return;
      }

      const subscriber = this.redisClient.duplicate();
      await subscriber.connect();
      await subscriber.subscribe(topic, fn);

      const subs = this.subscriberMap[topic] || [];
      this.subscriberMap[topic] = [...subs, subscriber];
    } catch (error) {
      this.logger.error((error as Error).message);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.useMock) {
      await this.redisClient.disconnect();
      this.logger.log('Disconnected redis server');
    }
  }
}

// Export a function that gets the client safely after initialization
export const getRedisClient = () => {
  try {
    return RedisClient.getInstance().redisClient;
  } catch (error) {
    const logger = new Logger('getRedisClient');
    logger.error(
      'Attempted to access Redis client before initialization',
      error,
    );
    return null;
  }
};
