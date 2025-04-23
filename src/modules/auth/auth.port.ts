import { TokenPayload } from 'src/share';
import {
  ChangePasswordDTO,
  LoginDTO,
  RegistrationDTO,
  RequestPasswordResetDTO,
  ResetPasswordDTO,
} from './auth.dto';

export interface ITokenService {
  generateToken(payload: TokenPayload, expiresIn?: string): Promise<string>;
  generateResetToken(): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload | null>;
  decodeToken(token: string): TokenPayload | null;
  getExpirationTime(token: string): number; // Seconds until token expiration
  isTokenBlacklisted(token: string): Promise<boolean>;
  blacklistToken(token: string, expiresIn: number): Promise<void>;
}

export interface IAuthService {
  // Authentication
  register(dto: RegistrationDTO): Promise<string>;
  login(dto: LoginDTO): Promise<{
    token: string;
    expiresIn: number;
    requiredResetPassword: boolean;
  }>;
  logout(token: string): Promise<void>;
  introspectToken(token: string): Promise<TokenPayload>;
  refreshToken(token: string): Promise<{ token: string; expiresIn: number }>;

  // Password management
  changePassword(userId: string, dto: ChangePasswordDTO): Promise<void>;
  requestPasswordReset(
    dto: RequestPasswordResetDTO,
  ): Promise<{ resetToken: string; expiryDate: Date; username: string }>;
  resetPassword(dto: ResetPasswordDTO): Promise<void>;
}
