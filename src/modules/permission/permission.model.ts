import { z } from 'zod';

// Enum định nghĩa loại quyền
export enum PermissionType {
  PAGE_ACCESS = 'PAGE_ACCESS',
  FEATURE_ACCESS = 'FEATURE_ACCESS',
  DATA_ACCESS = 'DATA_ACCESS',
}

// Schema Zod để validate Permission
export const permissionSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1, 'Mã quyền không được để trống'),
  name: z.string().min(1, 'Tên quyền không được để trống'),
  description: z.string().nullable().optional(),
  type: z.nativeEnum(PermissionType).default(PermissionType.PAGE_ACCESS),
  module: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Type từ schema
export type Permission = z.infer<typeof permissionSchema>;

// Schema cho RolePermission
export const rolePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
  canGrant: z.boolean().default(false),
  grantCondition: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RolePermission = z.infer<typeof rolePermissionSchema>;

// Type cho Permission với các thông tin quan hệ
export interface PermissionWithRelations extends Permission {
  rolePermissions?: RolePermission[];
}

// Business errors
export const ErrPermissionCodeExists = new Error('Mã quyền đã tồn tại');
export const ErrPermissionNotFound = new Error('Không tìm thấy quyền');
export const ErrPermissionInUse = new Error(
  'Quyền đang được sử dụng, không thể xóa',
);
