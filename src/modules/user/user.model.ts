// src/modules/user/user.model.ts
import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, 'Name must be at least 2 characters').nullable(),
  email: z.string().email('Invalid email format'),
  password: z.string().nullable(), // Optional to support social login
  image: z.string().nullable(), // Avatar
  isActive: z.boolean().default(true),

  // Verification
  isVerified: z.boolean().default(false),
  verifyCode: z.string().nullable(),
  verifyExpires: z.date().nullable(),

  // Password reset
  resetToken: z.string().nullable(),
  resetTokenExpires: z.date().nullable(),

  // 2FA
  isTwoFactorEnabled: z.boolean().default(false),
  twoFactorSecret: z.string().nullable(),
  twoFactorBackupCodes: z.array(z.string()),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof userSchema>;
