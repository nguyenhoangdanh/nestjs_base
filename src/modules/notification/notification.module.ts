// src/modules/notification/notification.module.ts
import { Module } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { PrismaService } from '../../share/prisma.service';
import { UserModule } from '../user/user.module';
import { RedisModule } from '../../common/redis';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    UserModule,
    RedisModule,
  ],
  providers: [
    NotificationService,
    NotificationGateway,
    PrismaService,
  ],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}