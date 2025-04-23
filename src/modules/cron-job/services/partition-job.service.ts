// src/modules/cron-job/services/partition-job.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../share/prisma.service';

@Injectable()
export class PartitionJobService {
  private readonly logger = new Logger(PartitionJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_WEEK)
  async createNextWeekPartition() {
    this.logger.log('Creating next week partition');
    try {
      // Tính toán ngày bắt đầu và kết thúc cho partition tuần tiếp theo
      const nextWeekStart = this.getNextWeekStart();
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

      // Format dates for PostgreSQL
      const startDateStr = nextWeekStart.toISOString().split('T')[0];
      const endDateStr = nextWeekEnd.toISOString().split('T')[0];

      // Tạo tên partition cho tuần tiếp theo
      const year = nextWeekStart.getFullYear();
      const weekNumber = this.getISOWeek(nextWeekStart);
      const partitionName = `attendances_${year}_w${weekNumber}`;

      // Thực thi SQL để tạo partition
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF attendances
        FOR VALUES FROM ('${startDateStr}') TO ('${endDateStr}');
      `);

      this.logger.log(
        `Created partition ${partitionName} for dates ${startDateStr} to ${endDateStr}`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating next week partition: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron(CronExpression.EVERY_MONTH)
  async cleanupOldPartitions() {
    this.logger.log('Cleaning up old partitions');
    try {
      // Xác định thời điểm cũ hơn 6 tháng
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Lấy danh sách các partition cũ
      const result = await this.prisma.$queryRaw`
        SELECT tablename FROM pg_tables
        WHERE tablename LIKE 'attendances_%'
          AND tableowner = current_user;
      `;

      const partitions = result as { tablename: string }[];

      // Lọc các partition cần xóa (cũ hơn 6 tháng)
      for (const { tablename } of partitions) {
        // Parse year and week from partition name
        const match = tablename.match(/attendances_(\d{4})_w(\d{1,2})/);
        if (!match) continue;

        const [_, yearStr, weekStr] = match;
        const year = parseInt(yearStr, 10);
        const week = parseInt(weekStr, 10);

        // Calculate approximate date for this partition
        const partitionDate = this.getDateFromWeek(year, week);

        if (partitionDate < sixMonthsAgo) {
          // Drop this partition
          await this.prisma.$executeRawUnsafe(
            `DROP TABLE IF EXISTS ${tablename};`,
          );
          this.logger.log(`Dropped old partition ${tablename}`);
        }
      }

      this.logger.log('Partition cleanup completed');
    } catch (error) {
      this.logger.error(
        `Error cleaning up old partitions: ${error.message}`,
        error.stack,
      );
    }
  }

  // Helper methods
  private getNextWeekStart(): Date {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);

    return nextMonday;
  }

  private getISOWeek(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    // January 4 is always in week 1
    const week1 = new Date(d.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week 1
    return (
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      )
    );
  }

  private getDateFromWeek(year: number, week: number): Date {
    const date = new Date(year, 0, 1 + (week - 1) * 7);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday

    return new Date(date.setDate(diff));
  }
}
