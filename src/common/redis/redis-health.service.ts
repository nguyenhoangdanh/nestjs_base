import { Injectable, Logger, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthService {
  private readonly logger = new Logger(RedisHealthService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  /**
   * Kiểm tra kết nối Redis có hoạt động không
   * @returns Promise<boolean> true nếu Redis đang hoạt động, false nếu không
   */
  async check(): Promise<boolean> {
    try {
      const pong = await this.redisClient.ping();
      return pong === 'PONG';
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Kiểm tra chi tiết sức khỏe của Redis
   * @returns Promise<object> Thông tin chi tiết về kết nối Redis
   */
  async getHealthDetails(): Promise<{
    status: 'up' | 'down';
    details?: {
      uptime?: number;
      connectedClients?: number;
      usedMemory?: number;
      commandsProcessed?: number;
    };
    error?: string;
  }> {
    try {
      // Kiểm tra kết nối cơ bản
      const isConnected = await this.check();
      if (!isConnected) {
        return { status: 'down', error: 'Cannot ping Redis server' };
      }

      // Lấy thông tin chi tiết từ INFO command
      const info = await this.redisClient.info();
      const infoSections = this.parseRedisInfo(info);

      return {
        status: 'up',
        details: {
          uptime: parseInt(infoSections.server?.uptime_in_seconds ?? '0'),
          connectedClients: parseInt(
            infoSections.clients?.connected_clients ?? '0',
          ),
          usedMemory: parseInt(infoSections.memory?.used_memory ?? '0'),
          commandsProcessed: parseInt(
            infoSections.stats?.total_commands_processed ?? '0',
          ),
        },
      };
    } catch (error) {
      this.logger.error(`Redis health details check failed: ${error.message}`);
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  /**
   * Parse output của Redis INFO command thành object
   * @param info
   * @returns Structured Redis info object
   */
  private parseRedisInfo(info: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    let currentSection = '';

    for (const line of info.split('\n')) {
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;

      // Check for section headers
      if (line.startsWith('# ')) {
        currentSection = line.substring(2).trim().toLowerCase();
        result[currentSection] = {};
        continue;
      }

      // Parse key-value pairs
      const parts = line.split(':');
      if (parts.length === 2 && currentSection) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        result[currentSection][key] = value;
      }
    }

    return result;
  }
}
