// src/modules/auth/auth.dto.ts
import { z } from 'zod';
import { AuthProvider } from './auth.types';

// Login DTO
export const loginDtoSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginDto = z.infer<typeof loginDtoSchema>;

// Registration DTO
export const registerDtoSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z
      .string()
      .min(6, 'Confirm password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterDto = z.infer<typeof registerDtoSchema>;

// Social Login DTO
export const socialLoginDtoSchema = z.object({
  provider: z.nativeEnum(AuthProvider),
  token: z.string(),
});

export type SocialLoginDto = z.infer<typeof socialLoginDtoSchema>;

// 2FA login DTO
export const twoFactorLoginDtoSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  twoFactorCode: z
    .string()
    .min(6, 'Two factor code must be at least 6 characters'),
});

export type TwoFactorLoginDto = z.infer<typeof twoFactorLoginDtoSchema>;

// Password reset request DTO
export const passwordResetRequestDtoSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export type PasswordResetRequestDto = z.infer<
  typeof passwordResetRequestDtoSchema
>;

// Password reset confirmation DTO
export const passwordResetConfirmDtoSchema = z
  .object({
    token: z.string(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z
      .string()
      .min(6, 'Confirm password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type PasswordResetConfirmDto = z.infer<
  typeof passwordResetConfirmDtoSchema
>;

// Change password DTO
export const changePasswordDtoSchema = z
  .object({
    currentPassword: z
      .string()
      .min(6, 'Current password must be at least 6 characters'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters'),
    confirmPassword: z
      .string()
      .min(6, 'Confirm password must be at least 6 characters'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type ChangePasswordDto = z.infer<typeof changePasswordDtoSchema>;

// Refresh token DTO
export const refreshTokenDtoSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenDtoSchema>;
