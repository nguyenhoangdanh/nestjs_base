import { z } from 'zod';
import { PermissionType } from './permission.model';
import { uuidSchema, uuidArraySchema } from 'src/utils/schema';

// DTO để tạo mới permission
export const createPermissionDTOSchema = z.object({
  code: z.string().min(1, 'Mã quyền không được để trống'),
  name: z.string().min(1, 'Tên quyền không được để trống'),
  description: z.string().optional(),
  type: z.nativeEnum(PermissionType).default(PermissionType.PAGE_ACCESS),
  module: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type CreatePermissionDTO = z.infer<typeof createPermissionDTOSchema>;

// DTO để cập nhật permission
export const updatePermissionDTOSchema = createPermissionDTOSchema.partial();

export type UpdatePermissionDTO = z.infer<typeof updatePermissionDTOSchema>;

// DTO để tìm kiếm permission
export const permissionCondDTOSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  type: z.nativeEnum(PermissionType).optional(),
  module: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type PermissionCondDTO = z.infer<typeof permissionCondDTOSchema>;

// DTO để cập nhật quan hệ giữa role và permission
export const rolePermissionAssignmentDTOSchema = z.object({
  roleId: uuidSchema,
  permissionIds: uuidArraySchema,
  canGrant: z.boolean().default(false),
  grantCondition: z.string().optional(),
});

export type RolePermissionAssignmentDTO = z.infer<
  typeof rolePermissionAssignmentDTOSchema
>;

// DTO đơn giản hơn để gán permission cho vai trò
export const assignPermissionsDTOSchema = z.object({
  permissionIds: uuidArraySchema,
});

export type AssignPermissionsDTO = z.infer<typeof assignPermissionsDTOSchema>;

// DTO để lấy các quyền của user
export const userPermissionsQueryDTOSchema = z.object({
  userId: uuidSchema.optional(),
  includeInactive: z.boolean().default(false),
  type: z.nativeEnum(PermissionType).optional(),
  module: z.string().optional(),
});

export type UserPermissionsQueryDTO = z.infer<
  typeof userPermissionsQueryDTOSchema
>;
