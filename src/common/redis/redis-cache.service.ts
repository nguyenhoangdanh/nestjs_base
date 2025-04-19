import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.constants';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async debugCache(pattern: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(pattern);
      this.logger.debug(
        `Found ${keys.length} keys matching pattern ${pattern}`,
      );

      for (const key of keys) {
        const value = await this.redisClient.get(key);
        const ttl = await this.redisClient.ttl(key);
        this.logger.debug(
          `Key: ${key}, TTL: ${ttl}s, Size: ${value ? value.length : 0} bytes`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error debugging cache with pattern ${pattern}: ${error.message}`,
      );
    }
  }

  // Enhanced get method with detailed logging
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redisClient.get(key);
      if (!data) {
        this.logger.debug(`Cache MISS for key: ${key}`);
        return null;
      }

      this.logger.debug(`Cache HIT for key: ${key}`);
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}: ${error.message}`);
      return null;
    }
  }

  // Enhanced set method with detailed logging
  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
      this.logger.debug(
        `Cache SET for key: ${key}, TTL: ${ttlSeconds}s, Size: ${serialized.length} bytes`,
      );
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}: ${error.message}`);
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.log(`Deleted ${keys.length} keys with pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(
        `Error deleting by pattern ${pattern}: ${error.message}`,
      );
    }
  }

  /**
   * Tạo chuỗi JSON ổn định từ một đối tượng bằng cách sắp xếp các thuộc tính
   * theo thứ tự từ điển để đảm bảo các đối tượng giống nhau luôn tạo ra cùng chuỗi
   */
  private stableStringify(obj: any): string {
    if (obj === null || obj === undefined) {
      return JSON.stringify(obj);
    }

    if (typeof obj !== 'object') {
      // Handle primitive types
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return (
        '[' + obj.map((item) => this.stableStringify(item)).join(',') + ']'
      );
    }

    // For objects, sort keys alphabetically to ensure consistent output
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map((key) => {
      const keyStr = JSON.stringify(key); // Properly encode the key
      const valStr = this.stableStringify(obj[key]);
      return keyStr + ':' + valStr;
    });

    return '{' + pairs.join(',') + '}';
  }

  /**
   * Phương thức cải tiến để tạo khóa cache, sử dụng cách tiếp cận đơn giản hóa
   * cho các trường hợp phổ biến
   */
  generateCacheKey(prefix: string, params: Record<string, any>): string {
    // Filter out undefined and null values
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(
        ([_, value]) => value !== undefined && value !== null,
      ),
    );

    // Tạo chuỗi ổn định từ params đã lọc
    const paramsString = this.stableStringify(filteredParams);

    // Sử dụng hàm hash để tạo một khóa ngắn hơn (tùy chọn)
    // const hash = createHash('md5').update(paramsString).digest('hex');
    // return `${prefix}:${hash}`;

    // Hoặc đơn giản chỉ trả về chuỗi đầy đủ
    return `${prefix}:${paramsString}`;
  }

  /**
   * Phương thức đơn giản hóa để tạo khóa cache cho các trường hợp cơ bản
   * mà không cần sử dụng JSON.stringify
   */
  generateSimpleKey(
    prefix: string,
    ...parts: (string | number | boolean | null | undefined)[]
  ): string {
    const validParts = parts.map((part) =>
      part === undefined || part === null ? 'null' : String(part),
    );
    return `${prefix}:${validParts.join(':')}`;
  }
}
