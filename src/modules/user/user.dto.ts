import { z } from 'zod';
import { userSchema } from './user.model';
import { UserRole } from 'src/share';

// DTO cho đăng ký người dùng
export const userRegistrationDTOSchema = userSchema
  .pick({
    username: true,
    password: true,
    fullName: true,
    employeeId: true,
    cardId: true,
    factoryId: true,
    lineId: true,
    teamId: true,
    groupId: true,
    positionId: true,
    email: true,
    phone: true,
    roleId: true,
    status: true,
  })
  .partial({
    factoryId: true,
    lineId: true,
    teamId: true,
    groupId: true,
    positionId: true,
    email: true,
    phone: true,
  })
  .extend({
    defaultRoleCode: z.nativeEnum(UserRole).default(UserRole.WORKER),
  })
  .required({
    username: true,
    password: true,
    fullName: true,
    employeeId: true,
    cardId: true,
  });

// DTO cho đăng nhập
export const userLoginDTOSchema = z.object({
  username: z.string().min(1, 'Tên đăng nhập không được để trống'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
  rememberMe: z.boolean().optional().default(false),
});

export type UserRegistrationDTO = z.infer<typeof userRegistrationDTOSchema>;
export type UserLoginDTO = z.infer<typeof userLoginDTOSchema>;

// DTO cho cập nhật người dùng
export const userUpdateDTOSchema = userSchema
  .pick({
    username: true,
    avatar: true,
    fullName: true,
    email: true,
    phone: true,
    cardId: true,
    employeeId: true,
    status: true,
    factoryId: true,
    lineId: true,
    teamId: true,
    groupId: true,
    positionId: true,
    roleId: true,
  })
  .extend({
    defaultRoleId: z.string().uuid().optional(),
  })
  .partial();

export type UserUpdateDTO = z.infer<typeof userUpdateDTOSchema>;

// DTO cho cập nhật hồ sơ cá nhân - giới hạn các trường mà người dùng có thể tự cập nhật
export const userUpdateProfileDTOSchema = userSchema
  .pick({
    avatar: true,
    fullName: true,
    email: true,
    phone: true,
  })
  .partial();

export type UserUpdateProfileDTO = z.infer<typeof userUpdateProfileDTOSchema>;

// DTO cho đặt lại mật khẩu
export const userResetPasswordDTOSchema = z
  .object({
    username: z.string().optional(),
    cardId: z.string().optional(),
    employeeId: z.string().optional(),
    resetToken: z.string().optional(),
    password: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
    confirmPassword: z
      .string()
      .min(6, 'Xác nhận mật khẩu phải có ít nhất 6 ký tự'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp với mật khẩu mới',
    path: ['confirmPassword'],
  })
  .refine(
    (data) =>
      (data.username && !data.cardId && !data.employeeId) ||
      (!data.username && data.cardId && data.employeeId),
    {
      message: 'Vui lòng cung cấp username hoặc cả cardId và employeeId',
      path: ['username'],
    },
  );

export type UserResetPasswordDTO = z.infer<typeof userResetPasswordDTOSchema>;

// DTO cho điều kiện tìm kiếm người dùng
export const userCondDTOSchema = userSchema
  .pick({
    fullName: true,
    username: true,
    status: true,
    factoryId: true,
    lineId: true,
    teamId: true,
    groupId: true,
    positionId: true,
  })
  .extend({
    roleId: z.string().uuid().optional(),
    roleCode: z.string().optional(),
  })
  .partial();

export type UserCondDTO = z.infer<typeof userCondDTOSchema>;

// DTO cho yêu cầu đặt lại mật khẩu
export const requestPasswordResetDTOSchema = z
  .object({
    username: z.string().optional(),
    cardId: z.string().optional(),
    employeeId: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.username && !data.cardId && !data.employeeId) ||
      (!data.username && data.cardId && data.employeeId),
    {
      message: 'Vui lòng cung cấp username hoặc cả cardId và employeeId',
      path: ['username'],
    },
  );

export type RequestPasswordResetDTO = z.infer<
  typeof requestPasswordResetDTOSchema
>;

// DTO cho gán vai trò
export const userRoleAssignmentDTOSchema = z.object({
  roleId: z.string().uuid(),
  scope: z.string().optional(),
  expiryDate: z.date().optional(), // Ngày hết hạn của vai trò (nếu là tạm thời)
});

export type UserRoleAssignmentDTO = z.infer<typeof userRoleAssignmentDTOSchema>;

// DTO cho tạo mật khẩu mới
export const changePasswordDTOSchema = z
  .object({
    oldPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
    newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
    confirmPassword: z
      .string()
      .min(6, 'Xác nhận mật khẩu phải có ít nhất 6 ký tự'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp với mật khẩu mới',
    path: ['confirmPassword'],
  });

export type ChangePasswordDTO = z.infer<typeof changePasswordDTOSchema>;

// DTO cho phân trang và sắp xếp
export const paginationDTOSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaginationDTO = z.infer<typeof paginationDTOSchema>;
