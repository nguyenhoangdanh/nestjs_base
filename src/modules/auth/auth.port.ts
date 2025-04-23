// src/modules/auth/auth.port.ts
import {
  LoginDto,
  RegisterDto,
  SocialLoginDto,
  TwoFactorLoginDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  ChangePasswordDto,
  RefreshTokenDto,
} from './auth.dto';
import { TokenPayload, UserRole } from './auth.types';

export interface IAuthService {
  // Login methods
  login(dto: LoginDto): Promise<AuthResult>;
  loginWith2FA(dto: TwoFactorLoginDto): Promise<AuthResult>;
  socialLogin(dto: SocialLoginDto): Promise<AuthResult>;

  // Registration
  register(dto: RegisterDto): Promise<{ userId: string }>;

  // Password management
  requestPasswordReset(dto: PasswordResetRequestDto): Promise<void>;
  resetPassword(dto: PasswordResetConfirmDto): Promise<void>;
  changePassword(userId: string, dto: ChangePasswordDto): Promise<void>;

  // Email verification
  sendVerificationEmail(userId: string): Promise<void>;
  verifyEmail(token: string): Promise<boolean>;

  // Token management
  refreshToken(dto: RefreshTokenDto): Promise<AuthResult>;
  validateToken(token: string): Promise<TokenPayload | null>;
  revokeToken(token: string): Promise<void>;

  // Session management
  revokeAllUserSessions(userId: string): Promise<void>;
  getActiveSessions(userId: string): Promise<Session[]>;

  // Role management
  assignRole(userId: string, role: UserRole): Promise<void>;
  removeRole(userId: string, role: UserRole): Promise<void>;
}

export interface ITokenService {
  generateTokens(
    payload: TokenPayload,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  verifyAccessToken(token: string): Promise<TokenPayload | null>;
  verifyRefreshToken(token: string): Promise<TokenPayload | null>;
  revokeToken(token: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
}

export interface Session {
  id: string;
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  lastActive: Date;
  expiresAt: Date;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string | null;
    email: string;
    isVerified: boolean;
    isTwoFactorEnabled: boolean;
    role: UserRole;
  };
  requiresTwoFactor?: boolean;
}
