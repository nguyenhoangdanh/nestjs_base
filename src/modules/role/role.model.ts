import { z } from 'zod';

// Role model
export const roleSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1, 'Mã vai trò không được để trống'),
  name: z.string().min(1, 'Tên vai trò không được để trống'),
  description: z.string().nullable().optional(),
  level: z.number().int().optional().default(0),
  isSystem: z.boolean().optional().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Các mối quan hệ được định nghĩa trong Prisma, nhưng không cần thiết trong model Zod
  // vì chúng được xử lý ở lớp repository
});

export type Role = z.infer<typeof roleSchema>;

// Trong file role.model.ts
export interface RoleWithRelations extends Role {
  userRoles?: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    roleId: string;
    scope: string | null;
  }[];

  userDepartmentRoles?: {
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    roleId: string;
    departmentId: string;
  }[];

  approvalWorkflowSteps?: {
    id: string;
    workflowId: string;
    roleId: string;
    order: number;
    reviewType: string;
  }[];

  User?: {
    id: string;
    username: string;
    fullName: string;
    defaultRoleId: string;
  }[];
}
