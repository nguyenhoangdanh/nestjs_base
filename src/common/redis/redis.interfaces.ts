import { IEventPublisher } from '../../share/interface';
import { AppEvent } from '../../share/data-model';
import { MessageHandler } from './redis-publisher.service';

/**
 * Interface cho Redis subscriber factory
 */
export interface IRedisSubscriberFactory {
  create(): any;
}

/**
 * Interface định nghĩa Service quản lý Redis PubSub
 */
export interface IRedisPublisher {
  publish<T>(channel: string, message: T): Promise<void>;
  subscribe(channel: string, handler: MessageHandler): Promise<void>;
  unsubscribe(channel: string, handler: MessageHandler): void;
}

/**
 * Lớp adapter cho IEventPublisher để sử dụng RedisPublisher
 * Điều này cho phép tương thích ngược với code hiện tại mà không cần thay đổi
 */
export class RedisEventPublisherAdapter implements IEventPublisher {
  constructor(private readonly redisPublisher: IRedisPublisher) {}

  /**
   * Publish một event thông qua Redis
   * @param event Event cần publish
   */
  async publish<T>(event: AppEvent<T>): Promise<void> {
    await this.redisPublisher.publish(event.eventName, event.plainObject());
  }

  /**
   * Subscribe để nhận các event từ một topic
   * @param topic Topic cần subscribe
   * @param fn Hàm xử lý khi nhận được event
   */
  async subscribe(topic: string, fn: (message: string) => void): Promise<void> {
    await this.redisPublisher.subscribe(topic, fn);
  }

  /**
   * Đóng kết nối Redis khi cần
   */
  async disconnect(): Promise<void> {
    // No-op - kết nối sẽ được đóng tự động khi application shutdown
  }
}

/**
 * Interface cho Redis health service
 */
export interface IRedisHealthService {
  check(): Promise<boolean>;
  getHealthDetails(): Promise<{
    status: 'up' | 'down';
    details?: {
      uptime?: number;
      connectedClients?: number;
      usedMemory?: number;
      commandsProcessed?: number;
    };
    error?: string;
  }>;
}
