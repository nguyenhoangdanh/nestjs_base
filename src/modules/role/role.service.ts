import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';
import { AppError, ErrNotFound, UserRole } from 'src/share';
import { PaginationDTO } from '../user/user.dto';
import { IRoleRepository, IRoleService } from './role.port';
import { ROLE_REPOSITORY } from './role.di-token';
import { Role, RoleWithRelations } from './role.model';
import { RoleCondDTO, RoleDTO } from './role.dto';
import { REDIS_CACHE_SERVICE, RedisCacheService } from 'src/common/redis';

@Injectable()
export class RoleService implements IRoleService {
  private readonly logger = new Logger(RoleService.name);
  private readonly ROLES_CACHE_PREFIX = 'app:roles:list';
  private readonly ROLES_CACHE_TTL = 600; // Tăng lên 10 phút

  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: IRoleRepository,
    @Inject(REDIS_CACHE_SERVICE)
    private readonly cacheService: RedisCacheService,
  ) {}

  async createRole(dto: RoleDTO): Promise<string> {
    try {
      // Check if role code exists
      const existingRole = await this.roleRepo.getByCode(dto.code);
      if (existingRole) {
        throw AppError.from(new Error('Mã vai trò đã tồn tại'), 400);
      }

      // Generate new role ID
      const newId = v4();

      // Create new role object
      const newRole: Role = {
        ...dto,
        id: newId,
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
        level: dto.level || 0,
        isSystem: dto.isSystem || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insert new role to repository
      await this.roleRepo.insert(newRole);

      // Xóa tất cả cache liên quan đến roles
      await this.invalidateRolesCache();

      return newId;
    } catch (error) {
      // Log error details
      this.logger.error(
        `Error during role creation: ${error.message}`,
        error.stack,
      );

      // Rethrow error for controller to handle
      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi tạo vai trò: ${error.message}`),
        400,
      );
    }
  }

  async updateRole(id: string, dto: RoleDTO, role?: UserRole): Promise<void> {
    try {
      // Check if role exists
      const existingRole = await this.roleRepo.get(id);
      if (!existingRole) {
        throw AppError.from(ErrNotFound, 404);
      }

      // If code is changed, check if it's unique
      if (dto.code && dto.code !== existingRole.code) {
        const duplicateCode = await this.roleRepo.getByCode(dto.code);
        if (duplicateCode) {
          throw AppError.from(new Error('Mã vai trò đã tồn tại'), 400);
        }
      }
      // System roles have restrictions
      if (existingRole.isSystem) {
        // Cannot change code or isSystem status of system roles
        const updateData: Partial<Role> = {
          name: dto.name,
          description: dto.description,
          level: dto.level,
          code:
            role === UserRole.SUPER_ADMIN &&
            existingRole.code !== UserRole.SUPER_ADMIN
              ? dto.code
              : role === UserRole.ADMIN &&
                  (existingRole.code !== UserRole.SUPER_ADMIN ||
                    role !== UserRole.ADMIN)
                ? dto.code
                : existingRole.code,
          isSystem:
            role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN
              ? dto.isSystem
              : existingRole.isSystem,
          updatedAt: new Date(),
        };

        await this.roleRepo.update(id, updateData);
      } else {
        // For non-system roles, can update all fields
        await this.roleRepo.update(id, {
          ...dto,
          updatedAt: new Date(),
        });
      }

      // Xóa tất cả cache liên quan đến roles
      await this.invalidateRolesCache();

      this.logger.log(`Role updated: ${id}`);
    } catch (error) {
      this.logger.error(`Error updating role: ${error.message}`, error.stack);

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi cập nhật vai trò: ${error.message}`),
        400,
      );
    }
  }

  async deleteRole(id: string): Promise<void> {
    try {
      // Check if role exists
      const existingRole = await this.roleRepo.get(id);
      if (!existingRole) {
        throw AppError.from(ErrNotFound, 404);
      }

      // Cannot delete system roles
      if (existingRole.isSystem) {
        throw AppError.from(new Error('Không thể xóa vai trò hệ thống'), 400);
      }

      // Check if role is in use
      const isInUse = await this.roleRepo.checkRoleIsInUse(id);
      if (isInUse) {
        throw AppError.from(
          new Error('Không thể xóa vai trò đang được sử dụng'),
          400,
        );
      }

      await this.roleRepo.delete(id);

      // Xóa tất cả cache liên quan đến roles
      await this.invalidateRolesCache();

      this.logger.log(`Role deleted: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting role: ${error.message}`, error.stack);

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi xóa vai trò: ${error.message}`),
        400,
      );
    }
  }

  async getRole(id: string): Promise<Role> {
    try {
      const role = await this.roleRepo.get(id);
      if (!role) {
        throw AppError.from(ErrNotFound, 404);
      }
      return role;
    } catch (error) {
      this.logger.error(`Error fetching role: ${error.message}`, error.stack);

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi lấy thông tin vai trò: ${error.message}`),
        400,
      );
    }
  }

  async getRoleWithRelations(id: string): Promise<RoleWithRelations> {
    try {
      const role = await this.roleRepo.getWithRelations(id);
      if (!role) {
        throw AppError.from(ErrNotFound, 404);
      }
      return role;
    } catch (error) {
      this.logger.error(
        `Error fetching role with relations: ${error.message}`,
        error.stack,
      );

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi lấy thông tin vai trò: ${error.message}`),
        400,
      );
    }
  }

  async getRoleByCode(code: UserRole | string): Promise<Role> {
    try {
      const role = await this.roleRepo.getByCode(code);
      if (!role) {
        throw AppError.from(
          new Error(`Không tìm thấy vai trò với mã: ${code}`),
          404,
        );
      }
      return role;
    } catch (error) {
      this.logger.error(
        `Error fetching role by code: ${error.message}`,
        error.stack,
      );

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi lấy thông tin vai trò: ${error.message}`),
        400,
      );
    }
  }

  /**
   * Tạo khóa cache đơn giản và ổn định cho danh sách roles
   */
  private generateRolesListCacheKey(
    conditions: RoleCondDTO,
    pagination: PaginationDTO,
  ): string {
    return this.cacheService.generateSimpleKey(
      this.ROLES_CACHE_PREFIX,
      conditions.code || '',
      conditions.name || '',
      conditions.isSystem === undefined ? '' : String(conditions.isSystem),
      conditions.level || 0,
      pagination.page,
      pagination.limit,
      pagination.sortBy || 'createdAt',
      pagination.sortOrder || 'desc',
    );
  }

  /**
   * Xóa tất cả cache liên quan đến roles
   */
  private async invalidateRolesCache(): Promise<void> {
    try {
      await this.cacheService.deleteByPattern(`${this.ROLES_CACHE_PREFIX}:*`);
      this.logger.log('Invalidated all roles cache');
    } catch (error) {
      this.logger.error(`Error invalidating roles cache: ${error.message}`);
    }
  }

  async listRoles(
    conditions: RoleCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: Role[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Tạo khóa cache đơn giản và ổn định
      const cacheKey = this.generateRolesListCacheKey(conditions, pagination);

      // Log cache key để debug
      this.logger.debug(`Using cache key: ${cacheKey}`);

      // Kiểm tra cache
      const cachedResult = await this.cacheService.get<{
        data: Role[];
        total: number;
        page: number;
        limit: number;
      }>(cacheKey);

      // Nếu có kết quả trong cache, trả về ngay
      if (cachedResult) {
        this.logger.debug(`Cache hit for roles list with key: ${cacheKey}`);
        return cachedResult;
      }

      this.logger.debug(`Cache miss for roles list with key: ${cacheKey}`);

      // Nếu không có cache hoặc đã hết hạn, truy vấn database
      const { data, total } = await this.roleRepo.list(conditions, pagination);

      const result = {
        data,
        total,
        page: pagination.page,
        limit: pagination.limit,
      };

      // Lưu kết quả vào cache
      await this.cacheService.set(cacheKey, result, this.ROLES_CACHE_TTL);
      this.logger.debug(
        `Cached roles list with key: ${cacheKey} for ${this.ROLES_CACHE_TTL} seconds`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Error listing roles: ${error.message}`);

      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi lấy danh sách vai trò: ${error.message}`),
        400,
      );
    }
  }
}
