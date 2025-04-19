import { Injectable, Logger } from '@nestjs/common';
import { IRoleRepository } from './role.port';
import { Role, RoleWithRelations } from './role.model';
import { PaginationDTO } from '../user/user.dto';
import { RoleCondDTO } from './role.dto';
import { AppError } from 'src/share';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/share/prisma.service';

@Injectable()
export class RolePrismaRepository implements IRoleRepository {
  private readonly logger = new Logger(RolePrismaRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(id: string): Promise<Role | null> {
    try {
      return await this.prisma.role.findUnique({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error fetching role: ${error.message}`, error.stack);
      throw AppError.from(
        new Error(`Lỗi khi truy vấn vai trò: ${error.message}`),
        500,
      );
    }
  }

  async getWithRelations(id: string): Promise<RoleWithRelations | null> {
    try {
      const result = await this.prisma.role.findUnique({
        where: { id },
        include: {
          userRoles: true,
          userDepartmentRoles: true,
          approvalWorkflowSteps: true,
          User: true,
        },
      });

      if (!result) return null;

      // Chuyển đổi kiểu dữ liệu
      return result as unknown as RoleWithRelations;
    } catch (error) {
      this.logger.error(
        `Error fetching role with relations: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi truy vấn vai trò: ${error.message}`),
        500,
      );
    }
  }

  async getByCode(code: string): Promise<Role | null> {
    try {
      return await this.prisma.role.findUnique({
        where: { code },
      });
    } catch (error) {
      this.logger.error(
        `Error fetching role by code: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi truy vấn vai trò theo mã: ${error.message}`),
        500,
      );
    }
  }

  async findByCond(cond: RoleCondDTO): Promise<Role | null> {
    try {
      const where: Prisma.RoleWhereInput = {};

      if (cond.code) where.code = cond.code;
      if (cond.name) where.name = { contains: cond.name };
      if (cond.level !== undefined) where.level = cond.level;
      if (cond.isSystem !== undefined) where.isSystem = cond.isSystem;

      return await this.prisma.role.findFirst({
        where,
      });
    } catch (error) {
      this.logger.error(
        `Error finding role by condition: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi tìm kiếm vai trò: ${error.message}`),
        500,
      );
    }
  }

  async list(
    conditions: RoleCondDTO,
    pagination: PaginationDTO,
  ): Promise<{ data: Role[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = pagination;
      const skip = (page - 1) * limit;

      const where: Prisma.RoleWhereInput = {};

      // Sử dụng startsWith thay cho contains để tận dụng index (nếu có)
      if (conditions.code) where.code = { startsWith: conditions.code };
      if (conditions.name) where.name = { contains: conditions.name };
      if (conditions.level !== undefined) where.level = conditions.level;
      if (conditions.isSystem !== undefined)
        where.isSystem = conditions.isSystem;

      // Sử dụng Promise.all thay cho $transaction để chạy song song
      // khi các queries không phụ thuộc vào nhau
      const [data, total] = await Promise.all([
        this.prisma.role.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.role.count({ where }),
      ]);

      return { data, total };
    } catch (error) {
      // Giảm bớt log, chỉ log error message
      this.logger.error(`Error listing roles: ${error.message}`);
      throw AppError.from(
        new Error(`Lỗi khi lấy danh sách vai trò: ${error.message}`),
        500,
      );
    }
  }

  async insert(role: Role): Promise<void> {
    try {
      await this.prisma.role.create({
        data: {
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description || null,
          level: role.level || 0,
          isSystem: role.isSystem || false,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error(`Error inserting role: ${error.message}`, error.stack);
      throw AppError.from(
        new Error(`Lỗi khi thêm vai trò: ${error.message}`),
        500,
      );
    }
  }

  async update(id: string, dto: Partial<Role>): Promise<void> {
    try {
      const updateData: Prisma.RoleUpdateInput = {};

      if (dto.code !== undefined) updateData.code = dto.code;
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.level !== undefined) updateData.level = dto.level;
      if (dto.isSystem !== undefined) updateData.isSystem = dto.isSystem;
      if (dto.updatedAt) updateData.updatedAt = dto.updatedAt;

      await this.prisma.role.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(`Error updating role: ${error.message}`, error.stack);
      throw AppError.from(
        new Error(`Lỗi khi cập nhật vai trò: ${error.message}`),
        500,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.role.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error deleting role: ${error.message}`, error.stack);
      throw AppError.from(
        new Error(`Lỗi khi xóa vai trò: ${error.message}`),
        500,
      );
    }
  }

  async checkRoleIsInUse(id: string): Promise<boolean> {
    try {
      // Sử dụng Promise.all thay cho transaction
      const [userRolesCount, userDepartmentRolesCount, usersCount] =
        await Promise.all([
          this.prisma.userRoleAssignment.count({
            where: { roleId: id },
          }),
          this.prisma.userDepartment.count({
            where: { roleId: id },
          }),
          this.prisma.user.count({
            where: { roleId: id },
          }),
        ]);

      // Kiểm tra ngay khi có kết quả đầu tiên > 0
      return (
        userRolesCount > 0 || userDepartmentRolesCount > 0 || usersCount > 0
      );
    } catch (error) {
      this.logger.error(`Error checking if role is in use: ${error.message}`);
      throw AppError.from(
        new Error(
          `Lỗi khi kiểm tra vai trò đang được sử dụng: ${error.message}`,
        ),
        500,
      );
    }
  }
}
