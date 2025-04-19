import { PaginationDTO } from '../user/user.dto';
import { Requester } from 'src/share';
import {
  AssignPermissionsDTO,
  CreatePermissionDTO,
  PermissionCondDTO,
  UpdatePermissionDTO,
  UserPermissionsQueryDTO,
} from './permission.dto';
import {
  Permission,
  PermissionWithRelations,
  RolePermission,
} from './permission.model';

// Interface cho permission repository
export interface IPermissionRepository {
  // CRUD cơ bản
  get(id: string): Promise<Permission | null>;
  getWithRelations(id: string): Promise<PermissionWithRelations | null>;
  getByCode(code: string): Promise<Permission | null>;
  list(
    conditions: PermissionCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: Permission[];
    total: number;
  }>;
  create(permission: Permission): Promise<void>;
  update(id: string, dto: Partial<Permission>): Promise<void>;
  delete(id: string): Promise<void>;

  // Quản lý phân quyền
  assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
    canGrant?: boolean,
    grantCondition?: string,
  ): Promise<void>;
  removePermissionsFromRole(
    roleId: string,
    permissionIds: string[],
  ): Promise<void>;
  getPermissionsByRole(roleId: string): Promise<Permission[]>;

  // Lấy permissions của nhiều role
  getPermissionsByRoles(roleIds: string[]): Promise<Permission[]>;

  // Kiểm tra permission đã được gán cho role nào chưa
  checkPermissionIsInUse(id: string): Promise<boolean>;

  // Các helper methods
  getRolePermission(
    roleId: string,
    permissionId: string,
  ): Promise<RolePermission | null>;
}

// Interface cho permission service
export interface IPermissionService {
  // CRUD Permissions
  createPermission(dto: CreatePermissionDTO): Promise<string>;
  updatePermission(id: string, dto: UpdatePermissionDTO): Promise<void>;
  deletePermission(id: string): Promise<void>;
  getPermission(id: string): Promise<Permission>;
  getPermissionByCode(code: string): Promise<Permission>;
  listPermissions(
    conditions: PermissionCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: Permission[];
    total: number;
    page: number;
    limit: number;
  }>;

  // Quản lý Role Permissions
  assignPermissionsToRole(
    requester: Requester,
    roleId: string,
    dto: AssignPermissionsDTO,
  ): Promise<void>;
  removePermissionsFromRole(
    requester: Requester,
    roleId: string,
    dto: AssignPermissionsDTO,
  ): Promise<void>;

  // Lấy danh sách quyền của role
  getPermissionsByRole(roleId: string): Promise<Permission[]>;

  // Lấy danh sách quyền của user (từ tất cả các role của user)
  getUserPermissions(
    query: UserPermissionsQueryDTO,
    requester: Requester,
  ): Promise<{
    permissions: Permission[];
    pageAccess: string[]; // Mã các trang user có quyền truy cập
    featureAccess: string[]; // Mã các tính năng user có quyền sử dụng
    dataAccess: string[]; // Mã các loại dữ liệu user có quyền truy cập
  }>;

  // Kiểm tra user có quyền cụ thể hay không
  checkUserHasPermission(
    userId: string,
    permissionCode: string,
  ): Promise<boolean>;
}
