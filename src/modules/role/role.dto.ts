import { z } from 'zod';

// DTO cho role
export const roleDTOSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, 'Mã vai trò không được để trống'),
  name: z.string().min(1, 'Tên vai trò không được để trống'),
  description: z.string().optional().nullable(),
  level: z.number().int().optional().default(0),
  isSystem: z.boolean().optional().default(false),
});

export type RoleDTO = z.infer<typeof roleDTOSchema>;

// DTO để tìm kiếm role
export const roleCondDTOSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  level: z.number().int().optional(),
  isSystem: z.boolean().optional(),
});

export type RoleCondDTO = z.infer<typeof roleCondDTOSchema>;
