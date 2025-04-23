import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ReqWithRequester } from '../../share';
import { RemoteAuthGuard } from '../../share/guard';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../share/pipes/zod-validation.pipe';
import {
  LoginDto,
  RegisterDto,
  SocialLoginDto,
  TwoFactorLoginDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  ChangePasswordDto,
  RefreshTokenDto,
  loginDtoSchema,
  registerDtoSchema,
  socialLoginDtoSchema,
  twoFactorLoginDtoSchema,
  passwordResetRequestDtoSchema,
  passwordResetConfirmDtoSchema,
  changePasswordDtoSchema,
  refreshTokenDtoSchema,
} from './auth.dto';
import { IAuthService } from './auth.port';
import { Inject } from '@nestjs/common';
import { AUTH_SERVICE } from './auth.di-token';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthHttpController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  async login(
    @Body(new ZodValidationPipe(loginDtoSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // If 2FA is required, don't set cookies
    if (result.requiresTwoFactor) {
      return {
        success: true,
        requiresTwoFactor: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          isTwoFactorEnabled: true,
        },
      };
    }

    // Set cookies for web clients
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: result.expiresIn * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/auth/refresh', // Only sent to refresh endpoint
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: result.user,
      },
    };
  }

  @Public()
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with 2FA' })
  @ApiBody({ type: TwoFactorLoginDto })
  @ApiResponse({ status: HttpStatus.OK, description: '2FA login successful' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or 2FA code',
  })
  async loginWith2FA(
    @Body(new ZodValidationPipe(twoFactorLoginDtoSchema))
    dto: TwoFactorLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWith2FA(dto);

    // Set cookies for web clients
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: result.expiresIn * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/auth/refresh',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: result.user,
      },
    };
  }

  @Public()
  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Social login' })
  @ApiBody({ type: SocialLoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Social login successful',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid token',
  })
  async socialLogin(
    @Body(new ZodValidationPipe(socialLoginDtoSchema)) dto: SocialLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.socialLogin(dto);

    // Set cookies for web clients
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: result.expiresIn * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/auth/refresh',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: result.user,
      },
    };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Registration successful',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or email already exists',
  })
  async register(
    @Body(new ZodValidationPipe(registerDtoSchema)) dto: RegisterDto,
  ) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      message:
        'Registration successful. Please check your email to verify your account.',
      data: { userId: result.userId },
    };
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refresh successful',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Body(new ZodValidationPipe(refreshTokenDtoSchema)) dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
    @Request() req: any,
  ) {
    // Check for refresh token in body or cookie
    const refreshToken = dto.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      return {
        success: false,
        message: 'Refresh token is required',
      };
    }

    const result = await this.authService.refreshToken({ refreshToken });

    // Set new cookies
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: result.expiresIn * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/auth/refresh',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      },
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  @ApiResponse({ status: HttpStatus.OK, description: 'Logout successful' })
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    // Get token from authorization header or cookie
    const token =
      req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken;

    if (token) {
      await this.authService.revokeToken(token);
    }

    // Also revoke refresh token if present
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.revokeToken(refreshToken);
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/auth/refresh' });

    return {
      success: true,
      message: 'Logout successful',
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: PasswordResetRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent',
  })
  async forgotPassword(
    @Body(new ZodValidationPipe(passwordResetRequestDtoSchema))
    dto: PasswordResetRequestDto,
  ) {
    await this.authService.requestPasswordReset(dto);
    return {
      success: true,
      message:
        'If an account with that email exists, we have sent password reset instructions.',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ type: PasswordResetConfirmDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successful',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired token',
  })
  async resetPassword(
    @Body(new ZodValidationPipe(passwordResetConfirmDtoSchema))
    dto: PasswordResetConfirmDto,
  ) {
    await this.authService.resetPassword(dto);
    return {
      success: true,
      message:
        'Password has been reset successfully. You can now log in with your new password.',
    };
  }

  @Post('change-password')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  @ApiBearerAuth()
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid current password',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async changePassword(
    @Request() req: ReqWithRequester,
    @Body(new ZodValidationPipe(changePasswordDtoSchema))
    dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(req.requester.sub, dto);
    return {
      success: true,
      message: 'Password has been changed successfully.',
    };
  }

  @Public()
  @Get('verify-email/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email verification result',
  })
  async verifyEmail(@Param('token') token: string) {
    const success = await this.authService.verifyEmail(token);
    return {
      success,
      message: success
        ? 'Email verified successfully. You can now log in.'
        : 'Invalid or expired verification token.',
    };
  }

  @Post('resend-verification')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiBearerAuth()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification email sent',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email already verified',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async resendVerification(@Request() req: ReqWithRequester) {
    await this.authService.sendVerificationEmail(req.requester.sub);
    return {
      success: true,
      message: 'Verification email has been sent. Please check your inbox.',
    };
  }

  @Get('sessions')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user active sessions' })
  @ApiBearerAuth()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active sessions retrieved',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getSessions(@Request() req: ReqWithRequester) {
    const sessions = await this.authService.getActiveSessions(
      req.requester.sub,
    );
    return {
      success: true,
      data: { sessions },
    };
  }

  @Post('revoke-all-sessions')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all user sessions' })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, description: 'All sessions revoked' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async revokeAllSessions(
    @Request() req: ReqWithRequester,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.revokeAllUserSessions(req.requester.sub);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/auth/refresh' });

    return {
      success: true,
      message: 'All sessions have been revoked successfully.',
    };
  }
}
