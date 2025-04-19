import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/di-tokens';
import { AppEvent } from '../data-model';
import { IEventPublisher } from '../interface';
import { EventHandler } from '..';

@Injectable()
export class RedisEventPublisher implements IEventPublisher {
  private logger = new Logger('RedisEventPublisher');
  private subscriberMap: Record<string, Redis[]> = {};
  private useMock = process.env.USE_MOCK_REDIS === 'true';

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {
    this.logger.log('RedisEventPublisher initialized with Redis client');
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
      this.logger.error(`Error publishing event: ${(err as Error).message}`);
    }
  }

  public async subscribe(topic: string, fn: EventHandler): Promise<void> {
    try {
      if (this.useMock) {
        this.logger.debug(`Mock subscribe: ${topic}`);
        return;
      }

      // Tạo một kết nối riêng cho subscriber
      const subscriber = new Redis(this.redisClient.options);
      await subscriber.subscribe(topic);

      subscriber.on('message', (channel, message) => {
        if (channel === topic) {
          fn(message);
        }
      });

      const subs = this.subscriberMap[topic] || [];
      this.subscriberMap[topic] = [...subs, subscriber];
    } catch (error) {
      this.logger.error(
        `Error subscribing to topic: ${(error as Error).message}`,
      );
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.useMock) {
      // Disconnect tất cả các subscriber
      for (const subscribers of Object.values(this.subscriberMap)) {
        for (const subscriber of subscribers) {
          await subscriber.disconnect();
        }
      }
      this.logger.log('Disconnected all Redis subscribers');
    }
  }
}
