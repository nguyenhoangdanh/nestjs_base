// src/modules/cron-job/cron-job.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AttendanceJobService } from './services/attendance-job.service';
import { PartitionJobService } from './services/partition-job.service';
import { CleanupJobService } from './services/cleanup-job.service';
import { PrismaService } from '../../share/prisma.service';
import { RedisModule } from '../../common/redis';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ScheduleModule.forRoot(), RedisModule, ConfigModule],
  providers: [
    PrismaService,
    AttendanceJobService,
    PartitionJobService,
    CleanupJobService,
  ],
})
export class CronJobModule {}
