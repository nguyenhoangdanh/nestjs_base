import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from 'src/share';
import { PrismaService } from 'src/share/prisma.service';
import { PaginationDTO } from '../user/user.dto';
import { PermissionCondDTO } from './permission.dto';
import {
  Permission,
  PermissionType,
  PermissionWithRelations,
  RolePermission,
} from './permission.model';
import { IPermissionRepository } from './permission.port';

@Injectable()
export class PermissionPrismaRepository implements IPermissionRepository {
  private readonly logger = new Logger(PermissionPrismaRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // Chuyển đổi model Prisma sang model domain
  private _toModel(data: any): Permission {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      type: data.type as PermissionType,
      module: data.module,
      isActive: data.isActive,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  // Chuyển đổi RolePermission từ Prisma sang model domain
  private _toRolePermissionModel(data: any): RolePermission {
    return {
      roleId: data.roleId,
      permissionId: data.permissionId,
      canGrant: data.canGrant,
      grantCondition: data.grantCondition,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  // CRUD cơ bản
  async get(id: string): Promise<Permission | null> {
    try {
      const data = await this.prisma.permission.findUnique({
        where: { id },
      });
      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error fetching permission: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi truy vấn quyền: ${error.message}`),
        500,
      );
    }
  }

  async getWithRelations(id: string): Promise<PermissionWithRelations | null> {
    try {
      const data = await this.prisma.permission.findUnique({
        where: { id },
        include: {
          rolePermissions: true,
        },
      });

      if (!data) return null;

      // Chuyển đổi dữ liệu
      const permissionWithRelations: PermissionWithRelations = {
        ...this._toModel(data),
        rolePermissions: data.rolePermissions.map(this._toRolePermissionModel),
      };

      return permissionWithRelations;
    } catch (error) {
      this.logger.error(
        `Error fetching permission with relations: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi truy vấn quyền và quan hệ: ${error.message}`),
        500,
      );
    }
  }

  async getByCode(code: string): Promise<Permission | null> {
    try {
      const data = await this.prisma.permission.findUnique({
        where: { code },
      });
      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error fetching permission by code: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi truy vấn quyền theo mã: ${error.message}`),
        500,
      );
    }
  }

  async list(
    conditions: PermissionCondDTO,
    pagination: PaginationDTO,
  ): Promise<{ data: Permission[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = pagination;
      const skip = (page - 1) * limit;

      const where: Prisma.PermissionWhereInput = {};

      if (conditions.code) where.code = { contains: conditions.code };
      if (conditions.name) where.name = { contains: conditions.name };
      if (conditions.type) where.type = conditions.type as any;
      if (conditions.module) where.module = { contains: conditions.module };
      if (conditions.isActive !== undefined)
        where.isActive = conditions.isActive;

      // Chạy song song các query để tối ưu hiệu suất
      const [data, total] = await Promise.all([
        this.prisma.permission.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.permission.count({ where }),
      ]);

      return {
        data: data.map(this._toModel),
        total,
      };
    } catch (error) {
      this.logger.error(
        `Error listing permissions: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi lấy danh sách quyền: ${error.message}`),
        500,
      );
    }
  }

  async create(permission: Permission): Promise<void> {
    try {
      await this.prisma.permission.create({
        data: {
          id: permission.id,
          code: permission.code,
          name: permission.name,
          description: permission.description || null,
          type: permission.type as any,
          module: permission.module || null,
          isActive: permission.isActive,
          createdAt: permission.createdAt,
          updatedAt: permission.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error creating permission: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi tạo quyền: ${error.message}`),
        500,
      );
    }
  }

  async update(id: string, dto: Partial<Permission>): Promise<void> {
    try {
      const updateData: Prisma.PermissionUpdateInput = {};

      if (dto.code !== undefined) updateData.code = dto.code;
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.type !== undefined) updateData.type = dto.type as any;
      if (dto.module !== undefined) updateData.module = dto.module;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
      if (dto.updatedAt) updateData.updatedAt = dto.updatedAt;

      await this.prisma.permission.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(
        `Error updating permission: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi cập nhật quyền: ${error.message}`),
        500,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.permission.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(
        `Error deleting permission: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi xóa quyền: ${error.message}`),
        500,
      );
    }
  }

  // Quản lý phân quyền
  async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
    canGrant: boolean = false,
    grantCondition?: string,
  ): Promise<void> {
    try {
      // Thực hiện trong transaction để đảm bảo tính nhất quán
      await this.prisma.$transaction(async (tx) => {
        // Tạo các bản ghi mới
        for (const permissionId of permissionIds) {
          // Kiểm tra xem đã tồn tại chưa
          const existing = await tx.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId,
                permissionId,
              },
            },
          });

          if (existing) {
            // Cập nhật nếu đã tồn tại
            await tx.rolePermission.update({
              where: {
                roleId_permissionId: {
                  roleId,
                  permissionId,
                },
              },
              data: {
                canGrant,
                grantCondition,
                updatedAt: new Date(),
              },
            });
          } else {
            // Tạo mới nếu chưa tồn tại
            await tx.rolePermission.create({
              data: {
                roleId,
                permissionId,
                canGrant,
                grantCondition,
              },
            });
          }
        }
      });
    } catch (error) {
      this.logger.error(
        `Error assigning permissions to role: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi gán quyền cho vai trò: ${error.message}`),
        500,
      );
    }
  }

  async removePermissionsFromRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    try {
      await this.prisma.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId: {
            in: permissionIds,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error removing permissions from role: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi xóa quyền khỏi vai trò: ${error.message}`),
        500,
      );
    }
  }

  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    try {
      const rolePermissions = await this.prisma.rolePermission.findMany({
        where: { roleId },
        include: { permission: true },
      });

      return rolePermissions.map((rp) => this._toModel(rp.permission));
    } catch (error) {
      this.logger.error(
        `Error getting permissions by role: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi lấy danh sách quyền theo vai trò: ${error.message}`),
        500,
      );
    }
  }

  async getPermissionsByRoles(roleIds: string[]): Promise<Permission[]> {
    try {
      // Nếu không có roleIds, trả về mảng rỗng
      if (!roleIds.length) return [];

      const rolePermissions = await this.prisma.rolePermission.findMany({
        where: {
          roleId: { in: roleIds },
          permission: { isActive: true }, // Chỉ lấy các quyền đang active
        },
        include: { permission: true },
      });

      // Chuyển đổi và lọc trùng lặp theo id
      const permissionsMap = new Map<string, Permission>();
      rolePermissions.forEach((rp) => {
        permissionsMap.set(rp.permission.id, this._toModel(rp.permission));
      });

      return Array.from(permissionsMap.values());
    } catch (error) {
      this.logger.error(
        `Error getting permissions by roles: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(
          `Lỗi khi lấy danh sách quyền theo nhiều vai trò: ${error.message}`,
        ),
        500,
      );
    }
  }

  async checkPermissionIsInUse(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.rolePermission.count({
        where: { permissionId: id },
      });
      return count > 0;
    } catch (error) {
      this.logger.error(
        `Error checking if permission is in use: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi kiểm tra quyền đang được sử dụng: ${error.message}`),
        500,
      );
    }
  }

  async getRolePermission(
    roleId: string,
    permissionId: string,
  ): Promise<RolePermission | null> {
    try {
      const rolePermission = await this.prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
      });

      return rolePermission
        ? this._toRolePermissionModel(rolePermission)
        : null;
    } catch (error) {
      this.logger.error(
        `Error getting role permission: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Lỗi khi lấy thông tin quyền của vai trò: ${error.message}`),
        500,
      );
    }
  }
}
