import { z } from 'zod';
import { userSchema } from './user.model';

// DTO for creating a user
export const createUserDtoSchema = userSchema
  .pick({
    name: true,
    email: true,
    password: true,
    image: true,
  })
  .required({
    email: true,
    password: true,
  });

export type CreateUserDto = z.infer<typeof createUserDtoSchema>;

// DTO for updating a user
export const updateUserDtoSchema = userSchema
  .pick({
    name: true,
    email: true,
    image: true,
    isActive: true,
  })
  .partial();

export type UpdateUserDto = z.infer<typeof updateUserDtoSchema>;

// DTO for user profile
export const userProfileDtoSchema = userSchema
  .pick({
    id: true,
    name: true,
    email: true,
    image: true,
    isVerified: true,
    isTwoFactorEnabled: true,
    createdAt: true,
  })
  .extend({
    roles: z.array(z.string()),
  });

export type UserProfileDto = z.infer<typeof userProfileDtoSchema>;

// DTO for filtering users
export const userFilterDtoSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  role: z.string().optional(),
});

export type UserFilterDto = z.infer<typeof userFilterDtoSchema>;

// DTO for pagination
export const paginationDtoSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaginationDto = z.infer<typeof paginationDtoSchema>;
