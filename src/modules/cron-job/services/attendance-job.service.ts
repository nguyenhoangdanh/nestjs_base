// src/modules/cron-job/services/attendance-job.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../share/prisma.service';

@Injectable()
export class AttendanceJobService {
  private readonly logger = new Logger(AttendanceJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processAttendanceData() {
    this.logger.log('Processing daily attendance data');
    try {
      // Đánh dấu những người vắng mặt không có lý do
      await this.prisma.$transaction(async (tx) => {
        // Lấy ngày hiện tại
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Lấy tất cả người dùng hoạt động
        const activeUsers = await tx.user.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true },
        });

        const userIds = activeUsers.map((user) => user.id);

        // Lấy tất cả các bản ghi điểm danh của ngày hôm nay
        const existingAttendances = await tx.attendance.findMany({
          where: {
            date: today,
            userId: {
              in: userIds,
            },
          },
          select: { userId: true },
        });

        const attendedUserIds = new Set(
          existingAttendances.map((a) => a.userId),
        );

        // Tìm những người chưa có bản ghi điểm danh
        const absentUserIds = userIds.filter((id) => !attendedUserIds.has(id));

        // Tạo bản ghi điểm danh "vắng mặt" cho những người này
        if (absentUserIds.length > 0) {
          const absentRecords = absentUserIds.map((userId) => ({
            userId,
            date: today,
            status: 'ABSENT',
            shift: 'FULL_DAY',
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await tx.attendance.createMany({
            data: absentRecords,
          });

          this.logger.log(`Created ${absentRecords.length} absent records`);
        }
      });

      this.logger.log('Daily attendance processing completed successfully');
    } catch (error) {
      this.logger.error(
        `Error processing attendance data: ${error.message}`,
        error.stack,
      );
    }
  }
}
