// src/modules/cron-job/services/cleanup-job.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../share/prisma.service';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../../common/redis/redis.constants';
import Redis from 'ioredis';

@Injectable()
export class CleanupJobService {
  private readonly logger = new Logger(CleanupJobService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}
  
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupInactiveSessions() {
    this.logger.log('Cleaning up inactive sessions');
    try {
      // Xóa các session không hoạt động trong 30 ngày
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await this.prisma.session.deleteMany({
        where: {
          OR: [
            { lastUsedAt: { lt: thirtyDaysAgo } },
            { expiresAt: { lt: new Date() } },
          ],
        },
      });
      
      this.logger.log(`Deleted ${result.count} inactive sessions`);
    } catch (error) {
      this.logger.error(`Error cleaning up inactive sessions: ${error.message}`, error.stack);
    }
  }
  
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupRedisCache() {
    this.logger.log('Cleaning up expired Redis keys');
    try {
      // Scan and delete expired keys
      let cursor = '0';
      let count = 0;
      
      do {
        // Scan for keys with a pattern
        const [nextCursor, keys] = await this.redisClient.scan(
          cursor, 
          'MATCH', 
          'token:blacklist:*', 
          'COUNT', 
          '1000'
        );
        
        cursor = nextCursor;
        
        // Check each key for expiration
        for (const key of keys) {
          const ttl = await this.redisClient.ttl(key);
          if (ttl <= 0) {
            await this.redisClient.del(key);
            count++;
          }
        }
      } while (cursor !== '0');
      
      this.logger.log(`Cleaned up ${count} expired Redis keys`);
    } catch (error) {
      this.logger.error(`Error cleaning up Redis cache: ${error.message}`, error.stack);
    }
  }
  
  @Cron(CronExpression.EVERY_WEEK)
  async purgeDeletedUsers() {
    this.logger.log('Purging permanently deleted users');
    try {
      // Xóa người dùng đã đánh dấu DELETED quá 90 ngày
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      // Lấy danh sách người dùng đã xóa mềm
      const deletedUsers = await this.prisma.user.findMany({
        where: {
          status: 'DELETED',
          updatedAt: { lt: ninetyDaysAgo },
        },
        select: { id: true },
      });
      
      if (deletedUsers.length === 0) {
        this.logger.log('No users to purge');
        return;
      }
      
      // Xóa hoàn toàn từng người dùng và dữ liệu liên quan
      await this.prisma.$transaction(async (tx) => {
        const userIds = deletedUsers.map(user => user.id);
        
        // Xóa các dữ liệu liên quan
        await tx.biometricData.deleteMany({ where: { userId: { in: userIds } } });
        await tx.device.deleteMany({ where: { userId: { in: userIds } } });
        await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
        await tx.notificationSetting.deleteMany({ where: { userId: { in: userIds } } });
        await tx.session.deleteMany({ where: { userId: { in: userIds } } });
        await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
        await tx.account.deleteMany({ where: { userId: { in: userIds } } });
        
        // Cuối cùng xóa người dùng
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      });
      
      this.logger.log(`Permanently deleted ${deletedUsers.length} users`);
    } catch (error) {
      this.logger.error(`Error purging deleted users: ${error.message}`, error.stack);
    }
  }
}