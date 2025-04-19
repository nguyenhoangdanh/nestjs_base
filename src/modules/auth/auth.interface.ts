// src/modules/auth/auth.interface.ts
import { Response } from 'express';
import { TokenPayload } from '../../share/interface';
import { ReqWithRequester } from '../../share';
import {
  UserLoginDTO,
  UserRegistrationDTO,
  RequestPasswordResetDTO,
  UserResetPasswordDTO,
} from '../user/user.dto';

export interface IAuthService {
  register(dto: UserRegistrationDTO): Promise<{ userId: string }>;
  login(
    dto: UserLoginDTO,
    res: Response,
  ): Promise<{
    token: string;
    expiresIn: number;
    requiredResetPassword: boolean;
  }>;
  logout(req: ReqWithRequester, res: Response): Promise<void>;
  refreshToken(
    token: string,
  ): Promise<{ token: string; expiresIn: number }>;
  requestPasswordReset(
    dto: RequestPasswordResetDTO,
  ): Promise<{ resetToken: string; expiryDate: Date; username: string }>;
  resetPassword(dto: UserResetPasswordDTO): Promise<void>;
  validateUser(username: string, password: string): Promise<any>;
}

export interface ITokenService {
  generateToken(payload: TokenPayload, expiresIn?: string): Promise<string>;
  generateResetToken(): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload | null>;
  decodeToken(token: string): TokenPayload | null;
  getExpirationTime(token: string): number;
  isTokenBlacklisted(token: string): Promise<boolean>;
  blacklistToken(token: string, expiresIn: number): Promise<void>;
  introspect(token: string): Promise<{
    payload: TokenPayload | null;
    error?: Error;
    isOk: boolean;
  }>;
}