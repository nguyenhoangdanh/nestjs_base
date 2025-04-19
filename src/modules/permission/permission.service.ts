import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';
import { AppError, Requester, UserRole } from 'src/share';
import { PaginationDTO } from '../user/user.dto';
import { IUserRepository } from '../user/user.port';
import { USER_REPOSITORY } from '../user/user.di-token';
import { PERMISSION_REPOSITORY } from './permission.di-token';
import {
  AssignPermissionsDTO,
  CreatePermissionDTO,
  PermissionCondDTO,
  UpdatePermissionDTO,
  UserPermissionsQueryDTO,
} from './permission.dto';
import {
  ErrPermissionCodeExists,
  ErrPermissionInUse,
  ErrPermissionNotFound,
  Permission,
  PermissionType,
} from './permission.model';
import { IPermissionRepository, IPermissionService } from './permission.port';
import { REDIS_CACHE_SERVICE, RedisCacheService } from 'src/common/redis';

@Injectable()
export class PermissionService implements IPermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private readonly PERMISSIONS_CACHE_PREFIX = 'app:permissions';
  private readonly USER_PERMISSIONS_CACHE_PREFIX = 'app:user:permissions';
  private readonly CACHE_TTL = 600; // 10 phút

  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepo: IPermissionRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(REDIS_CACHE_SERVICE)
    private readonly cacheService: RedisCacheService,
  ) {}

  // CRUD Permission

  async createPermission(dto: CreatePermissionDTO): Promise<string> {
    try {
      // Kiểm tra code đã tồn tại chưa
      const existingPermission = await this.permissionRepo.getByCode(dto.code);
      if (existingPermission) {
        throw AppError.from(ErrPermissionCodeExists, 400);
      }

      // Tạo ID mới
      const newId = v4();

      // Tạo đối tượng permission mới
      const newPermission: Permission = {
        id: newId,
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
        type: dto.type || PermissionType.PAGE_ACCESS,
        module: dto.module || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Lưu vào database
      await this.permissionRepo.create(newPermission);

      // Xóa cache
      await this.invalidatePermissionsCache();

      return newId;
    } catch (error) {
      this.logger.error(
        `Error creating permission: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi tạo quyền: ${error.message}`),
        500,
      );
    }
  }

  async updatePermission(id: string, dto: UpdatePermissionDTO): Promise<void> {
    try {
      // Kiểm tra permission tồn tại
      const existingPermission = await this.permissionRepo.get(id);
      if (!existingPermission) {
        throw AppError.from(ErrPermissionNotFound, 404);
      }

      // Kiểm tra code mới có trùng với code khác không
      if (dto.code && dto.code !== existingPermission.code) {
        const permissionWithSameCode = await this.permissionRepo.getByCode(
          dto.code,
        );
        if (permissionWithSameCode && permissionWithSameCode.id !== id) {
          throw AppError.from(ErrPermissionCodeExists, 400);
        }
      }

      // Cập nhật permission
      await this.permissionRepo.update(id, {
        ...dto,
        updatedAt: new Date(),
      });

      // Xóa cache
      await this.invalidatePermissionsCache();
      await this.invalidateUserPermissionsCache();

      this.logger.log(`Permission updated: ${id}`);
    } catch (error) {
      this.logger.error(
        `Error updating permission: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi cập nhật quyền: ${error.message}`),
        500,
      );
    }
  }

  async deletePermission(id: string): Promise<void> {
    try {
      // Kiểm tra permission tồn tại
      const existingPermission = await this.permissionRepo.get(id);
      if (!existingPermission) {
        throw AppError.from(ErrPermissionNotFound, 404);
      }

      // Kiểm tra permission đang được sử dụng không
      const isInUse = await this.permissionRepo.checkPermissionIsInUse(id);
      if (isInUse) {
        throw AppError.from(ErrPermissionInUse, 400);
      }

      // Xóa permission
      await this.permissionRepo.delete(id);

      // Xóa cache
      await this.invalidatePermissionsCache();

      this.logger.log(`Permission deleted: ${id}`);
    } catch (error) {
      this.logger.error(
        `Error deleting permission: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi xóa quyền: ${error.message}`),
        500,
      );
    }
  }

  async getPermission(id: string): Promise<Permission> {
    try {
      const permission = await this.permissionRepo.get(id);
      if (!permission) {
        throw AppError.from(ErrPermissionNotFound, 404);
      }
      return permission;
    } catch (error) {
      this.logger.error(
        `Error getting permission: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi lấy thông tin quyền: ${error.message}`),
        500,
      );
    }
  }

  async getPermissionByCode(code: string): Promise<Permission> {
    try {
      const permission = await this.permissionRepo.getByCode(code);
      if (!permission) {
        throw AppError.from(ErrPermissionNotFound, 404);
      }
      return permission;
    } catch (error) {
      this.logger.error(
        `Error getting permission by code: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi lấy thông tin quyền theo mã: ${error.message}`),
        500,
      );
    }
  }

  async listPermissions(
    conditions: PermissionCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: Permission[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Tạo cache key
      const cacheKey = this.generatePermissionsListCacheKey(
        conditions,
        pagination,
      );

      // Kiểm tra cache
      const cachedResult = await this.cacheService.get<{
        data: Permission[];
        total: number;
        page: number;
        limit: number;
      }>(cacheKey);

      if (cachedResult) {
        this.logger.debug(
          `Cache hit for permissions list with key: ${cacheKey}`,
        );
        return cachedResult;
      }

      // Nếu không có cache, truy vấn database
      const { data, total } = await this.permissionRepo.list(
        conditions,
        pagination,
      );

      const result = {
        data,
        total,
        page: pagination.page,
        limit: pagination.limit,
      };

      // Lưu kết quả vào cache
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(
        `Error listing permissions: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi lấy danh sách quyền: ${error.message}`),
        500,
      );
    }
  }

  // Quản lý Role Permissions

  async assignPermissionsToRole(
    requester: Requester,
    roleId: string,
    dto: AssignPermissionsDTO,
  ): Promise<void> {
    try {
      // Kiểm tra quyền hạn
      if (
        requester.role !== UserRole.ADMIN &&
        requester.role !== UserRole.SUPER_ADMIN
      ) {
        throw AppError.from(
          new Error('Bạn không có quyền thực hiện hành động này'),
          403,
        );
      }

      // Gán quyền cho vai trò
      await this.permissionRepo.assignPermissionsToRole(
        roleId,
        dto.permissionIds,
      );

      // Xóa cache
      await this.invalidateUserPermissionsCache();

      this.logger.log(
        `Permissions assigned to role ${roleId} by ${requester.sub}`,
      );
    } catch (error) {
      this.logger.error(
        `Error assigning permissions to role: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi gán quyền cho vai trò: ${error.message}`),
        500,
      );
    }
  }

  async removePermissionsFromRole(
    requester: Requester,
    roleId: string,
    dto: AssignPermissionsDTO,
  ): Promise<void> {
    try {
      // Kiểm tra quyền hạn
      if (
        requester.role !== UserRole.ADMIN &&
        requester.role !== UserRole.SUPER_ADMIN
      ) {
        throw AppError.from(
          new Error('Bạn không có quyền thực hiện hành động này'),
          403,
        );
      }

      // Xóa quyền khỏi vai trò
      await this.permissionRepo.removePermissionsFromRole(
        roleId,
        dto.permissionIds,
      );

      // Xóa cache
      await this.invalidateUserPermissionsCache();

      this.logger.log(
        `Permissions removed from role ${roleId} by ${requester.sub}`,
      );
    } catch (error) {
      this.logger.error(
        `Error removing permissions from role: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi xóa quyền khỏi vai trò: ${error.message}`),
        500,
      );
    }
  }

  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    try {
      // Tạo cache key
      const cacheKey = `${this.PERMISSIONS_CACHE_PREFIX}:role:${roleId}`;

      // Kiểm tra cache
      const cachedResult = await this.cacheService.get<Permission[]>(cacheKey);

      if (cachedResult) {
        this.logger.debug(
          `Cache hit for role permissions with key: ${cacheKey}`,
        );
        return cachedResult;
      }

      // Nếu không có cache, truy vấn database
      const permissions =
        await this.permissionRepo.getPermissionsByRole(roleId);

      // Lưu kết quả vào cache
      await this.cacheService.set(cacheKey, permissions, this.CACHE_TTL);

      return permissions;
    } catch (error) {
      this.logger.error(
        `Error getting permissions by role: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi lấy danh sách quyền theo vai trò: ${error.message}`),
        500,
      );
    }
  }

  // User Permissions

  async getUserPermissions(
    query: UserPermissionsQueryDTO,
    requester: Requester,
  ): Promise<{
    permissions: Permission[];
    pageAccess: string[];
    featureAccess: string[];
    dataAccess: string[];
  }> {
    try {
      // Xác định userId (từ query hoặc từ requester)
      const userId = query.userId || requester.sub;

      // Kiểm tra quyền truy cập
      if (
        userId !== requester.sub &&
        requester.role !== UserRole.ADMIN &&
        requester.role !== UserRole.SUPER_ADMIN
      ) {
        throw AppError.from(
          new Error('Bạn không có quyền xem thông tin này'),
          403,
        );
      }

      // Tạo cache key
      const cacheKey = this.generateUserPermissionsCacheKey(userId, query);

      // Kiểm tra cache
      const cachedResult = await this.cacheService.get<{
        permissions: Permission[];
        pageAccess: string[];
        featureAccess: string[];
        dataAccess: string[];
      }>(cacheKey);

      if (cachedResult) {
        this.logger.debug(
          `Cache hit for user permissions with key: ${cacheKey}`,
        );
        return cachedResult;
      }

      // Lấy tất cả vai trò của user
      const userRoles = await this.userRepo.getUserRoles(userId);
      const roleIds = userRoles.map((r) => r.roleId);

      // Nếu không có vai trò nào, trả về mảng rỗng
      if (roleIds.length === 0) {
        const emptyResult = {
          permissions: [],
          pageAccess: [],
          featureAccess: [],
          dataAccess: [],
        };
        await this.cacheService.set(cacheKey, emptyResult, this.CACHE_TTL);
        return emptyResult;
      }

      // Lấy tất cả quyền từ các vai trò
      const permissions =
        await this.permissionRepo.getPermissionsByRoles(roleIds);

      // Lọc theo các điều kiện (nếu có)
      let filteredPermissions = permissions;

      // Lọc theo type
      if (query.type) {
        filteredPermissions = filteredPermissions.filter(
          (p) => p.type === query.type,
        );
      }

      // Lọc theo module
      if (query.module) {
        filteredPermissions = filteredPermissions.filter(
          (p) => p.module === query.module,
        );
      }

      // Lọc theo trạng thái active
      if (!query.includeInactive) {
        filteredPermissions = filteredPermissions.filter((p) => p.isActive);
      }

      // Phân loại các quyền theo type
      const pageAccess = filteredPermissions
        .filter((p) => p.type === PermissionType.PAGE_ACCESS && p.isActive)
        .map((p) => p.code);

      const featureAccess = filteredPermissions
        .filter((p) => p.type === PermissionType.FEATURE_ACCESS && p.isActive)
        .map((p) => p.code);

      const dataAccess = filteredPermissions
        .filter((p) => p.type === PermissionType.DATA_ACCESS && p.isActive)
        .map((p) => p.code);

      const result = {
        permissions: filteredPermissions,
        pageAccess,
        featureAccess,
        dataAccess,
      };

      // Lưu kết quả vào cache
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(
        `Error getting user permissions: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(
          `Lỗi khi lấy danh sách quyền của người dùng: ${error.message}`,
        ),
        500,
      );
    }
  }

  async checkUserHasPermission(
    userId: string,
    permissionCode: string,
  ): Promise<boolean> {
    try {
      // Tạo cache key
      const cacheKey = `${this.USER_PERMISSIONS_CACHE_PREFIX}:${userId}:has:${permissionCode}`;

      // Kiểm tra cache
      const cachedResult = await this.cacheService.get<boolean>(cacheKey);

      if (cachedResult !== undefined) {
        this.logger.debug(
          `Cache hit for user permission check with key: ${cacheKey}`,
        );
        return cachedResult ?? false;
      }

      // Lấy tất cả vai trò của user
      const userRoles = await this.userRepo.getUserRoles(userId);
      const roleIds = userRoles.map((r) => r.roleId);

      // Nếu không có vai trò nào, trả về false
      if (roleIds.length === 0) {
        await this.cacheService.set(cacheKey, false, this.CACHE_TTL);
        return false;
      }

      // Lấy permission theo code
      const permission = await this.permissionRepo.getByCode(permissionCode);

      if (!permission || !permission.isActive) {
        await this.cacheService.set(cacheKey, false, this.CACHE_TTL);
        return false;
      }

      // Kiểm tra xem permission có thuộc về bất kỳ vai trò nào của user không
      for (const roleId of roleIds) {
        const rolePermission = await this.permissionRepo.getRolePermission(
          roleId,
          permission.id,
        );
        if (rolePermission) {
          await this.cacheService.set(cacheKey, true, this.CACHE_TTL);
          return true;
        }
      }

      // Nếu không tìm thấy, trả về false
      await this.cacheService.set(cacheKey, false, this.CACHE_TTL);
      return false;
    } catch (error) {
      this.logger.error(
        `Error checking user permission: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Lỗi khi kiểm tra quyền của người dùng: ${error.message}`),
        500,
      );
    }
  }

  // Cache helpers

  private generatePermissionsListCacheKey(
    conditions: PermissionCondDTO,
    pagination: PaginationDTO,
  ): string {
    return this.cacheService.generateSimpleKey(
      this.PERMISSIONS_CACHE_PREFIX,
      'list',
      conditions.code || '',
      conditions.name || '',
      conditions.type || '',
      conditions.module || '',
      conditions.isActive === undefined ? '' : String(conditions.isActive),
      pagination.page,
      pagination.limit,
      pagination.sortBy || 'createdAt',
      pagination.sortOrder || 'desc',
    );
  }

  private generateUserPermissionsCacheKey(
    userId: string,
    query: UserPermissionsQueryDTO,
  ): string {
    return this.cacheService.generateSimpleKey(
      this.USER_PERMISSIONS_CACHE_PREFIX,
      userId,
      query.type || '',
      query.module || '',
      query.includeInactive ? '1' : '0',
    );
  }

  private async invalidatePermissionsCache(): Promise<void> {
    try {
      await this.cacheService.deleteByPattern(
        `${this.PERMISSIONS_CACHE_PREFIX}:*`,
      );
      this.logger.log('Invalidated all permissions cache');
    } catch (error) {
      this.logger.error(
        `Error invalidating permissions cache: ${error.message}`,
      );
    }
  }

  private async invalidateUserPermissionsCache(): Promise<void> {
    try {
      await this.cacheService.deleteByPattern(
        `${this.USER_PERMISSIONS_CACHE_PREFIX}:*`,
      );
      this.logger.log('Invalidated all user permissions cache');
    } catch (error) {
      this.logger.error(
        `Error invalidating user permissions cache: ${error.message}`,
      );
    }
  }
}
