// src/modules/user/user-prisma.repo.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../share/prisma.service';
import { IUserRepository } from './user.port';
import { User } from './user.model';
import { UserFilterDto, PaginationDto } from './user.dto';
import { Paginated } from '../../share';
import { AppError, UserRole } from '../../share';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
  private readonly logger = new Logger(UserPrismaRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(id: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      return user;
    } catch (error) {
      this.logger.error(
        `Error getting user ${id}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to retrieve user: ${error.message}`),
        500,
      );
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      return user;
    } catch (error) {
      this.logger.error(
        `Error finding user by email: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to find user by email: ${error.message}`),
        500,
      );
    }
  }

  async findByResetToken(token: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpires: { gt: new Date() },
        },
      });
      return user;
    } catch (error) {
      this.logger.error(
        `Error finding user by reset token: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to find user by reset token: ${error.message}`),
        500,
      );
    }
  }

  async findByVerifyCode(code: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          verifyCode: code,
          verifyExpires: { gt: new Date() },
        },
      });
      return user;
    } catch (error) {
      this.logger.error(
        `Error finding user by verify code: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to find user by verify code: ${error.message}`),
        500,
      );
    }
  }

  async list(
    filter: UserFilterDto,
    pagination: PaginationDto,
  ): Promise<Paginated<User>> {
    try {
      const { page, limit, sortBy, sortOrder } = pagination;
      const skip = (page - 1) * limit;

      // Build where conditions
      const where: Prisma.UserWhereInput = {};

      if (filter.search) {
        where.OR = [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { email: { contains: filter.search, mode: 'insensitive' } },
        ];
      }

      if (filter.isActive !== undefined) {
        where.isActive = filter.isActive;
      }

      if (filter.isVerified !== undefined) {
        where.isVerified = filter.isVerified;
      }

      if (filter.role) {
        where.userRoles = {
          some: {
            role: {
              name: filter.role,
            },
          },
        };
      }

      // Run count and query in parallel
      const [total, users] = await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
      ]);

      return {
        data: users,
        paging: {
          page,
          limit,
          total,
        },
        total,
      };
    } catch (error) {
      this.logger.error(`Error listing users: ${error.message}`, error.stack);
      throw AppError.from(
        new Error(`Failed to list users: ${error.message}`),
        500,
      );
    }
  }

  async insert(user: User): Promise<string> {
    try {
      const result = await this.prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
          image: user.image,
          isActive: user.isActive,
          isVerified: user.isVerified,
          verifyCode: user.verifyCode,
          verifyExpires: user.verifyExpires,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          twoFactorSecret: user.twoFactorSecret,
          twoFactorBackupCodes: user.twoFactorBackupCodes,
        },
      });
      return result.id;
    } catch (error) {
      this.logger.error(`Error inserting user: ${error.message}`, error.stack);

      // Check for unique constraint violations
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field =
            (error.meta?.target as string[])?.join(', ') || 'unknown field';
          throw AppError.from(
            new Error(`User with this ${field} already exists`),
            400,
          );
        }
      }

      throw AppError.from(
        new Error(`Failed to create user: ${error.message}`),
        500,
      );
    }
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.logger.error(
        `Error updating user ${id}: ${error.message}`,
        error.stack,
      );

      // Check if user exists
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw AppError.from(new Error(`User not found`), 404);
      }

      throw AppError.from(
        new Error(`Failed to update user: ${error.message}`),
        500,
      );
    }
  }

  async delete(id: string, hardDelete: boolean = false): Promise<void> {
    try {
      if (hardDelete) {
        // Hard delete - cascade to related records first
        await this.prisma.$transaction(async (tx) => {
          // Delete related records
          await tx.session.deleteMany({ where: { userId: id } });
          await tx.biometricData.deleteMany({ where: { userId: id } });
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.notification.deleteMany({ where: { userId: id } });
          await tx.notificationSetting.deleteMany({ where: { userId: id } });
          await tx.account.deleteMany({ where: { userId: id } });
          await tx.device.deleteMany({ where: { userId: id } });

          // Finally delete the user
          await tx.user.delete({ where: { id } });
        });
      } else {
        // Soft delete - just mark as inactive
        await this.prisma.user.update({
          where: { id },
          data: { isActive: false },
        });
      }
    } catch (error) {
      this.logger.error(
        `Error deleting user ${id}: ${error.message}`,
        error.stack,
      );

      // Check if user exists
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw AppError.from(new Error(`User not found`), 404);
      }

      throw AppError.from(
        new Error(`Failed to delete user: ${error.message}`),
        500,
      );
    }
  }

  async setResetToken(
    userId: string,
    token: string,
    expiry: Date,
  ): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          resetToken: token,
          resetTokenExpires: expiry,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error setting reset token for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to set reset token: ${error.message}`),
        500,
      );
    }
  }

  async setVerifyCode(
    userId: string,
    code: string,
    expiry: Date,
  ): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          verifyCode: code,
          verifyExpires: expiry,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error setting verify code for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to set verification code: ${error.message}`),
        500,
      );
    }
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error updating password for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to update password: ${error.message}`),
        500,
      );
    }
  }

  async verify(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          verifyCode: null,
          verifyExpires: null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error verifying user ${userId}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to verify user: ${error.message}`),
        500,
      );
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLogin: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Error updating last login for user ${userId}: ${error.message}`,
        error.stack,
      );
      // Non-critical operation, just log error without throwing
    }
  }

  async set2FASecret(userId: string, secret: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret },
      });
    } catch (error) {
      this.logger.error(
        `Error setting 2FA secret for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to set 2FA secret: ${error.message}`),
        500,
      );
    }
  }

  async set2FABackupCodes(userId: string, codes: string[]): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: codes },
      });
    } catch (error) {
      this.logger.error(
        `Error setting 2FA backup codes for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to set 2FA backup codes: ${error.message}`),
        500,
      );
    }
  }

  async enable2FA(userId: string, enabled: boolean): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isTwoFactorEnabled: enabled },
      });
    } catch (error) {
      this.logger.error(
        `Error setting 2FA status for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to update 2FA status: ${error.message}`),
        500,
      );
    }
  }

  async getUserRoles(
    userId: string,
  ): Promise<{ roleId: string; role: UserRole }[]> {
    try {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });

      return userRoles.map((ur) => ({
        roleId: ur.roleId,
        role: ur.role.name as UserRole,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting roles for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to get user roles: ${error.message}`),
        500,
      );
    }
  }
}
