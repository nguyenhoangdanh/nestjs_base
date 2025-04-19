import { Injectable, Logger, Inject, OnModuleDestroy } from '@nestjs/common';
import { REDIS_CLIENT, REDIS_SUBSCRIBER_FACTORY } from './redis.constants';
import Redis from 'ioredis';

/**
 * Interface định nghĩa hàm xử lý sự kiện
 */
export type MessageHandler = (message: string) => void;

/**
 * Service xử lý việc publish và subscribe qua Redis
 */
@Injectable()
export class RedisPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisher.name);
  private readonly subscribers: Redis[] = [];
  private readonly handlers: Map<string, Set<MessageHandler>> = new Map();
  private readonly useMock = process.env.USE_MOCK_REDIS === 'true';

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @Inject(REDIS_SUBSCRIBER_FACTORY)
    private readonly subscriberFactory: { create: () => Redis },
  ) {
    this.logger.log('RedisPublisher initialized');
  }

  /**
   * Publish một message qua Redis
   * @param channel Kênh publish
   * @param message Message dạng object (sẽ tự động convert sang JSON)
   */
  async publish<T>(channel: string, message: T): Promise<void> {
    try {
      if (this.useMock) {
        this.logger.debug(
          `Mock publish to ${channel}: ${JSON.stringify(message)}`,
        );
        // Gọi trực tiếp các handler nếu là mock
        if (this.handlers.has(channel)) {
          const handlers = this.handlers.get(channel);
          const messageJson = JSON.stringify(message);
          handlers?.forEach((handler) => handler(messageJson));
        }
        return;
      }

      await this.redisClient.publish(channel, JSON.stringify(message));
      this.logger.debug(`Published to ${channel}`);
    } catch (error) {
      this.logger.error(`Error publishing to ${channel}: ${error.message}`);
    }
  }

  /**
   * Subscribe vào một kênh Redis
   * @param channel Kênh cần subscribe
   * @param handler Hàm xử lý khi có message
   */
  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    try {
      // Thêm handler vào danh sách
      if (!this.handlers.has(channel)) {
        this.handlers.set(channel, new Set());

        // Chỉ tạo subscriber mới nếu đây là handler đầu tiên cho channel này
        if (!this.useMock) {
          const subscriber = this.subscriberFactory.create();
          this.subscribers.push(subscriber);

          // Đăng ký event handler để nhận message
          subscriber.on(
            'message',
            (receivedChannel: string, message: string) => {
              if (receivedChannel === channel) {
                const handlers = this.handlers.get(channel);
                if (handlers) {
                  handlers.forEach((h) => {
                    try {
                      h(message);
                    } catch (err) {
                      this.logger.error(
                        `Error handling message from ${channel}: ${err.message}`,
                      );
                    }
                  });
                }
              }
            },
          );

          // Subscribe vào channel
          await subscriber.subscribe(channel);
          this.logger.log(`Subscribed to channel: ${channel}`);
        } else {
          this.logger.debug(`Mock subscribe to channel: ${channel}`);
        }
      }

      // Add handler
      this.handlers.get(channel)?.add(handler);
      this.logger.debug(`Added handler for channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Error subscribing to ${channel}: ${error.message}`);
    }
  }

  /**
   * Hủy đăng ký handler khỏi channel
   * @param channel Kênh cần hủy đăng ký
   * @param handler Handler cần hủy đăng ký
   */
  unsubscribe(channel: string, handler: MessageHandler): void {
    if (this.handlers.has(channel)) {
      const handlers = this.handlers.get(channel);
      handlers?.delete(handler);
      this.logger.debug(`Removed handler for channel: ${channel}`);

      // Nếu là handler cuối cùng, không cần duy trì subscription nữa
      if (handlers?.size === 0) {
        this.handlers.delete(channel);
        this.logger.debug(`No more handlers for channel: ${channel}`);
      }
    }
  }

  /**
   * Đóng tất cả kết nối khi module bị hủy
   */
  async onModuleDestroy() {
    if (!this.useMock) {
      for (const subscriber of this.subscribers) {
        try {
          await subscriber.quit();
        } catch (e) {
          this.logger.error(`Error closing Redis subscriber: ${e.message}`);
        }
      }
      this.logger.log('All Redis subscribers closed');
    }
  }
}
