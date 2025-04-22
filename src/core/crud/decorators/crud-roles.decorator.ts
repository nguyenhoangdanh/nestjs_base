import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../share';

/**
 * Metadata key for CRUD roles
 */
export const CRUD_ROLES_KEY = 'crud:roles';

/**
 * Interface định nghĩa vai trò cho từng endpoint
 */
export interface EndpointRoles {
  create?: UserRole[];
  getAll?: UserRole[];
  getOne?: UserRole[];
  update?: UserRole[];
  delete?: UserRole[];
  count?: UserRole[];
}

/**
 * Decorator để cấu hình vai trò cho CRUD controller
 * @param roles Cấu hình vai trò cho từng endpoint
 */
export function CrudRoles(roles: EndpointRoles) {
  return SetMetadata(CRUD_ROLES_KEY, roles);
}

/**
 * Decorator để cấu hình vai trò cho endpoint cụ thể
 * @param endpoint Tên endpoint
 * @param roles Các vai trò được phép
 */
export function EndpointRoles(endpoint: string, roles: UserRole[]) {
  return SetMetadata(`crud:roles:${endpoint}`, roles);
}

/**
 * Decorator cấu hình vai trò cho endpoint create
 */
export function CreateRoles(...roles: UserRole[]) {
  return SetMetadata('crud:roles:create', roles);
}

/**
 * Decorator cấu hình vai trò cho endpoint getAll
 */
export function GetAllRoles(...roles: UserRole[]) {
  return SetMetadata('crud:roles:getAll', roles);
}

/**
 * Decorator cấu hình vai trò cho endpoint getOne
 */
export function GetOneRoles(...roles: UserRole[]) {
  return SetMetadata('crud:roles:getOne', roles);
}

/**
 * Decorator cấu hình vai trò cho endpoint update
 */
export function UpdateRoles(...roles: UserRole[]) {
  return SetMetadata('crud:roles:update', roles);
}

/**
 * Decorator cấu hình vai trò cho endpoint delete
 */
export function DeleteRoles(...roles: UserRole[]) {
  return SetMetadata('crud:roles:delete', roles);
}

/**
 * Decorator cấu hình vai trò cho endpoint count
 */
export function CountRoles(...roles: UserRole[]) {
  return SetMetadata('crud:roles:count', roles);
}
