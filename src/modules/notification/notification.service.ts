// src/modules/notification/notification.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../share/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationType } from '@prisma/client';
import { REDIS_PUBLISHER } from '../../common/redis/redis.constants';
import { IRedisPublisher } from '../../common/redis/redis.interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
    @Inject(REDIS_PUBLISHER) private readonly redisPublisher: IRedisPublisher,
  ) {
    // Subscribe to notification events
    this.subscribeToNotificationEvents();
  }

  private async subscribeToNotificationEvents() {
    await this.redisPublisher.subscribe(
      'app:notifications',
      async (message) => {
        try {
          const data = JSON.parse(message);
          if (data.event === 'notification:created') {
            // Process notification event
            const notification = data.notification;
            await this.processNotification(notification);
          }
        } catch (error) {
          this.logger.error(
            `Error processing notification event: ${error.message}`,
          );
        }
      },
    );
  }

  async getUserNotifications(userId: string, page = 1, limit = 10) {
    try {
      const [notifications, totalCount] = await Promise.all([
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.notification.count({
          where: { userId },
        }),
      ]);

      return {
        data: notifications,
        total: totalCount,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Error getting user notifications: ${error.message}`);
      throw error;
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const count = await this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });
      return count;
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`);
      throw error;
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    try {
      await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId,
        },
        data: {
          isRead: true,
        },
      });
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking notification as read: ${error.message}`);
      throw error;
    }
  }

  async markAllAsRead(userId: string) {
    try {
      await this.prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error marking all notifications as read: ${error.message}`,
      );
      throw error;
    }
  }

  async createNotification(
    userId: string,
    title: string,
    content: string,
    type: NotificationType,
    data?: any,
  ) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          id: uuidv4(),
          userId,
          title,
          content,
          type,
          data: data || {},
          isRead: false,
        },
      });

      // Send real-time notification
      this.notificationGateway.sendToUser(
        userId,
        'notification:new',
        notification,
      );

      return notification;
    } catch (error) {
      this.logger.error(`Error creating notification: ${error.message}`);
      throw error;
    }
  }

  async processNotification(notification: any) {
    try {
      // Check if notification has already been processed
      const existing = await this.prisma.notification.findFirst({
        where: {
          id: notification.id,
        },
      });

      if (existing) {
        this.logger.debug(
          `Notification ${notification.id} already exists, skipping`,
        );
        return;
      }

      // Create the notification in the database
      const newNotification = await this.prisma.notification.create({
        data: {
          id: notification.id || uuidv4(),
          userId: notification.userId,
          title: notification.title,
          content: notification.content,
          type: notification.type,
          data: notification.data || {},
          isRead: false,
        },
      });

      // Send real-time notification
      this.notificationGateway.sendToUser(
        notification.userId,
        'notification:new',
        newNotification,
      );
    } catch (error) {
      this.logger.error(`Error processing notification: ${error.message}`);
    }
  }

  async deleteNotification(userId: string, notificationId: string) {
    try {
      await this.prisma.notification.deleteMany({
        where: {
          id: notificationId,
          userId,
        },
      });
      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting notification: ${error.message}`);
      throw error;
    }
  }
}
