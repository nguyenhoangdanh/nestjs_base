import { Provider } from '@nestjs/common';
import { EVENT_PUBLISHER } from '../../share/di-token';
import { REDIS_PUBLISHER } from './redis.constants';
import { RedisEventPublisherAdapter } from './redis.interfaces';

/**
 * Provider cho EventPublisher sử dụng RedisEventPublisherAdapter
 * Điều này cho phép tương thích với code cũ mà không cần sửa chữa lớn
 */
export const eventPublisherProvider: Provider = {
  provide: EVENT_PUBLISHER,
  useFactory: (redisPublisher) => {
    return new RedisEventPublisherAdapter(redisPublisher);
  },
  inject: [REDIS_PUBLISHER],
};

/**
 * Các provider liên quan đến Redis
 */
export const RedisProviders = [eventPublisherProvider];
