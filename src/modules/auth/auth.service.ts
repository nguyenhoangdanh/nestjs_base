import { Inject, Injectable, Logger } from '@nestjs/common';
import { IAuthService, ITokenService, Session, AuthResult } from './auth.port';
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
import { TokenPayload, UserRole, AuthProvider } from './auth.types';
import { AppError } from '../../share';
import { IUserService } from '../user/user.port';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { TOKEN_SERVICE } from './auth.di-token';
import { USER_SERVICE } from '../user/user.di-token';
import { PrismaService } from '../../share/prisma.service';
import { CreateUserDto } from '../user/user.dto';
import { IEmailService } from '../email/email.port';
import { EMAIL_SERVICE } from '../email/email.di-token';

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResult> {
    try {
      // Find the user
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user) {
        throw AppError.from(new Error('Invalid email or password'), 401);
      }

      // Verify password
      if (!user.password) {
        throw AppError.from(new Error('Account requires social login'), 400);
      }

      const isPasswordValid = await bcrypt.compare(dto.password, user.password);
      if (!isPasswordValid) {
        throw AppError.from(new Error('Invalid email or password'), 401);
      }

      // Check if user is active
      if (!user.isActive) {
        throw AppError.from(new Error('Account is disabled'), 403);
      }

      // Check if 2FA is enabled
      if (user.isTwoFactorEnabled) {
        return {
          accessToken: '',
          refreshToken: '',
          expiresIn: 0,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified,
            isTwoFactorEnabled: user.isTwoFactorEnabled,
            role: this.getUserRole(user),
          },
          requiresTwoFactor: true,
        };
      }

      // Generate tokens
      const payload: TokenPayload = {
        sub: user.id,
        email: user.email,
        role: this.getUserRole(user),
      };

      const { accessToken, refreshToken } =
        await this.tokenService.generateTokens(payload);

      // Create or update session
      await this.createSession(user.id, dto.rememberMe);

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          role: this.getUserRole(user),
        },
      };
    } catch (error) {
      this.logger.error(`Login error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(new Error(`Login failed: ${error.message}`), 500);
    }
  }

  async loginWith2FA(dto: TwoFactorLoginDto): Promise<AuthResult> {
    try {
      // First validate regular credentials
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user) {
        throw AppError.from(new Error('Invalid email or password'), 401);
      }

      const isPasswordValid = await bcrypt.compare(dto.password, user.password);
      if (!isPasswordValid) {
        throw AppError.from(new Error('Invalid email or password'), 401);
      }

      // Check if user is active
      if (!user.isActive) {
        throw AppError.from(new Error('Account is disabled'), 403);
      }

      // Verify 2FA code
      const isValid = await this.userService.verify2FA(
        user.id,
        dto.twoFactorCode,
      );
      if (!isValid) {
        throw AppError.from(new Error('Invalid 2FA code'), 401);
      }

      // Generate tokens
      const payload: TokenPayload = {
        sub: user.id,
        email: user.email,
        role: this.getUserRole(user),
      };

      const { accessToken, refreshToken } =
        await this.tokenService.generateTokens(payload);

      // Create or update session
      await this.createSession(user.id, true);

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          role: this.getUserRole(user),
        },
      };
    } catch (error) {
      this.logger.error(`2FA login error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(new Error(`2FA login failed: ${error.message}`), 500);
    }
  }

  async socialLogin(dto: SocialLoginDto): Promise<AuthResult> {
    try {
      // Validate the social token (this would typically call the provider's API)
      // This is a simplified example - in a real app, you'd verify with the actual provider
      const socialUserInfo = await this.validateSocialToken(
        dto.provider,
        dto.token,
      );

      if (!socialUserInfo) {
        throw AppError.from(new Error('Invalid social token'), 401);
      }

      // Find or create user
      let user = await this.prisma.user.findFirst({
        where: {
          accounts: {
            some: {
              provider: dto.provider,
              providerAccountId: socialUserInfo.id,
            },
          },
        },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      // If no user found, check if the email exists
      if (!user && socialUserInfo.email) {
        user = await this.prisma.user.findUnique({
          where: { email: socialUserInfo.email },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });

        // If user exists, link the account
        if (user) {
          await this.prisma.account.create({
            data: {
              userId: user.id,
              type: 'oauth',
              provider: dto.provider,
              providerAccountId: socialUserInfo.id,
              accessToken: dto.token,
            },
          });
        }
      }

      // If still no user, create a new one
      if (!user) {
        const userId = await this.userService.createUser({
          name: socialUserInfo.name,
          email: socialUserInfo.email,
          image: socialUserInfo.image,
          password: null, // Social login doesn't need a password
        });

        await this.prisma.account.create({
          data: {
            userId,
            type: 'oauth',
            provider: dto.provider,
            providerAccountId: socialUserInfo.id,
            accessToken: dto.token,
          },
        });

        user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });
      }

      // Check if user is active
      if (!user.isActive) {
        throw AppError.from(new Error('Account is disabled'), 403);
      }

      // Generate tokens
      const payload: TokenPayload = {
        sub: user.id,
        email: user.email,
        role: this.getUserRole(user),
      };

      const { accessToken, refreshToken } =
        await this.tokenService.generateTokens(payload);

      // Create or update session
      await this.createSession(user.id, true);

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isVerified: true, // Social logins are considered verified
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          role: this.getUserRole(user),
        },
      };
    } catch (error) {
      this.logger.error(`Social login error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Social login failed: ${error.message}`),
        500,
      );
    }
  }

  async register(dto: RegisterDto): Promise<{ userId: string }> {
    try {
      // Check if email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser) {
        throw AppError.from(new Error('Email already in use'), 400);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      // Create user
      const createUserDto: CreateUserDto = {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      };

      const userId = await this.userService.createUser(createUserDto);

      // Generate verification code
      const verifyCode = await this.userService.generateVerifyCode(userId);

      // Send verification email
      await this.emailService.sendVerificationEmail(
        dto.email,
        dto.name,
        verifyCode,
      );

      return { userId };
    } catch (error) {
      this.logger.error(`Registration error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Registration failed: ${error.message}`),
        500,
      );
    }
  }

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      // Always return success even if user not found (security best practice)
      if (!user) {
        return;
      }

      // Generate reset token
      const resetToken = randomBytes(32).toString('hex');
      const resetTokenExpires = new Date();
      resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour validity

      // Update user with reset token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpires,
        },
      });

      // Send password reset email
      await this.emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken,
      );
    } catch (error) {
      this.logger.error(
        `Password reset request error: ${error.message}`,
        error.stack,
      );
      // Don't expose error details for security
      throw AppError.from(
        new Error('An error occurred processing your request'),
        500,
      );
    }
  }

  async resetPassword(dto: PasswordResetConfirmDto): Promise<void> {
    try {
      // Find user by reset token
      const user = await this.prisma.user.findFirst({
        where: {
          resetToken: dto.token,
          resetTokenExpires: { gt: new Date() },
        },
      });

      if (!user) {
        throw AppError.from(new Error('Invalid or expired token'), 400);
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      // Update user with new password and clear reset token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
        },
      });

      // Revoke all existing sessions for security
      await this.revokeAllUserSessions(user.id);
    } catch (error) {
      this.logger.error(`Password reset error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Password reset failed: ${error.message}`),
        500,
      );
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    try {
      // Get the user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw AppError.from(new Error('User not found'), 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        throw AppError.from(new Error('Current password is incorrect'), 400);
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // For security, revoke all other sessions
      await this.revokeAllUserSessions(userId);
    } catch (error) {
      this.logger.error(`Change password error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Change password failed: ${error.message}`),
        500,
      );
    }
  }

  async sendVerificationEmail(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw AppError.from(new Error('User not found'), 404);
      }

      if (user.isVerified) {
        throw AppError.from(new Error('Email already verified'), 400);
      }

      // Generate verification code
      const verifyCode = await this.userService.generateVerifyCode(userId);

      // Send verification email
      await this.emailService.sendVerificationEmail(
        user.email,
        user.name,
        verifyCode,
      );
    } catch (error) {
      this.logger.error(
        `Send verification email error: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Failed to send verification email: ${error.message}`),
        500,
      );
    }
  }

  async verifyEmail(token: string): Promise<boolean> {
    try {
      return await this.userService.verifyEmail(token);
    } catch (error) {
      this.logger.error(
        `Email verification error: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Email verification failed: ${error.message}`),
        500,
      );
    }
  }

  async refreshToken(dto: RefreshTokenDto): Promise<AuthResult> {
    try {
      // Verify the refresh token
      const payload = await this.tokenService.verifyRefreshToken(
        dto.refreshToken,
      );
      if (!payload) {
        throw AppError.from(new Error('Invalid refresh token'), 401);
      }

      // Get the user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user || !user.isActive) {
        throw AppError.from(new Error('User not found or inactive'), 401);
      }

      // Generate new tokens
      const newPayload: TokenPayload = {
        sub: user.id,
        email: user.email,
        role: this.getUserRole(user),
      };

      const { accessToken, refreshToken } =
        await this.tokenService.generateTokens(newPayload);

      // Revoke the old refresh token
      await this.tokenService.revokeToken(dto.refreshToken);

      return {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          role: this.getUserRole(user),
        },
      };
    } catch (error) {
      this.logger.error(`Refresh token error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Token refresh failed: ${error.message}`),
        401,
      );
    }
  }

  async validateToken(token: string): Promise<TokenPayload | null> {
    return this.tokenService.verifyAccessToken(token);
  }

  async revokeToken(token: string): Promise<void> {
    await this.tokenService.revokeToken(token);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      // Delete all sessions for this user
      await this.prisma.session.deleteMany({
        where: { userId },
      });

      // Revoke all tokens
      await this.tokenService.revokeAllUserTokens(userId);
    } catch (error) {
      this.logger.error(
        `Revoke all sessions error: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Failed to revoke sessions: ${error.message}`),
        500,
      );
    }
  }

  async getActiveSessions(userId: string): Promise<Session[]> {
    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        include: {
          device: true,
        },
      });

      return sessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        deviceInfo: session.device
          ? `${session.device.deviceName} (${session.device.deviceType})`
          : 'Unknown device',
        ipAddress: session.ipAddress || 'Unknown',
        lastActive: session.lastUsedAt,
        expiresAt: session.expiresAt,
      }));
    } catch (error) {
      this.logger.error(
        `Get active sessions error: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Failed to get active sessions: ${error.message}`),
        500,
      );
    }
  }

  async assignRole(userId: string, role: UserRole): Promise<void> {
    try {
      // Find the role in database
      const dbRole = await this.prisma.role.findFirst({
        where: { name: role },
      });

      if (!dbRole) {
        throw AppError.from(new Error('Role not found'), 404);
      }

      // Check if user already has this role
      const existingRole = await this.prisma.userRole.findFirst({
        where: {
          userId,
          roleId: dbRole.id,
        },
      });

      if (existingRole) {
        throw AppError.from(new Error('User already has this role'), 400);
      }

      // Assign role
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId: dbRole.id,
        },
      });
    } catch (error) {
      this.logger.error(`Assign role error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Failed to assign role: ${error.message}`),
        500,
      );
    }
  }

  async removeRole(userId: string, role: UserRole): Promise<void> {
    try {
      // Find the role in database
      const dbRole = await this.prisma.role.findFirst({
        where: { name: role },
      });

      if (!dbRole) {
        throw AppError.from(new Error('Role not found'), 404);
      }

      // Remove role
      await this.prisma.userRole.deleteMany({
        where: {
          userId,
          roleId: dbRole.id,
        },
      });
    } catch (error) {
      this.logger.error(`Remove role error: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(
        new Error(`Failed to remove role: ${error.message}`),
        500,
      );
    }
  }

  // Helper methods
  private getUserRole(user: any): UserRole {
    if (!user.userRoles || user.userRoles.length === 0) {
      return UserRole.USER; // Default role
    }

    // Find the highest priority role (SUPER_ADMIN > ADMIN > USER)
    const roles = user.userRoles.map((ur) => ur.role.name);

    if (roles.includes(UserRole.SUPER_ADMIN)) {
      return UserRole.SUPER_ADMIN;
    }

    if (roles.includes(UserRole.ADMIN)) {
      return UserRole.ADMIN;
    }

    return UserRole.USER;
  }

  private async createSession(
    userId: string,
    rememberMe: boolean,
  ): Promise<void> {
    try {
      // Generate expiry date (24 hours or 30 days if remember me)
      const expiresAt = new Date();
      if (rememberMe) {
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
      } else {
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
      }

      // Create session
      await this.prisma.session.create({
        data: {
          userId,
          token: randomBytes(32).toString('hex'),
          expiresAt,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Create session error: ${error.message}`, error.stack);
      // Non-critical error, just log it
    }
  }

  private async validateSocialToken(
    provider: AuthProvider,
    token: string,
  ): Promise<any> {
    // This is a simplified example - in a real app, you would verify with the actual provider
    // For now, we'll just return a mock user based on the provider
    switch (provider) {
      case AuthProvider.GOOGLE:
        // In a real app, you would call Google's API to validate the token
        return {
          id: 'google-user-id',
          name: 'Google User',
          email: 'google.user@example.com',
          image: 'https://example.com/google-avatar.jpg',
        };
      case AuthProvider.FACEBOOK:
        return {
          id: 'facebook-user-id',
          name: 'Facebook User',
          email: 'facebook.user@example.com',
          image: 'https://example.com/facebook-avatar.jpg',
        };
      case AuthProvider.APPLE:
        return {
          id: 'apple-user-id',
          name: 'Apple User',
          email: 'apple.user@example.com',
          image: null,
        };
      case AuthProvider.GITHUB:
        return {
          id: 'github-user-id',
          name: 'GitHub User',
          email: 'github.user@example.com',
          image: 'https://example.com/github-avatar.jpg',
        };
      default:
        return null;
    }
  }
}
