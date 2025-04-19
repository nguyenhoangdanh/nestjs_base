// src/modules/auth/auth.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest, Response } from 'express';
import { ZodValidationPipe } from '../../share/pipes/zod-validation.pipe';
import { AUTH_SERVICE } from './auth.di-token';
import { IAuthService } from './auth.interface';
import {
  UserLoginDTO,
  UserRegistrationDTO,
  userLoginDTOSchema,
  userRegistrationDTOSchema,
  RequestPasswordResetDTO,
  UserResetPasswordDTO,
  requestPasswordResetDTOSchema,
  userResetPasswordDTOSchema,
} from '../user/user.dto';
import { AppError, ReqWithRequester } from '../../share';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(userRegistrationDTOSchema))
    dto: UserRegistrationDTO,
  ) {
    const { userId } = await this.authService.register(dto);
    return {
      success: true,
      data: { userId },
    };
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(userLoginDTOSchema)) dto: UserLoginDTO,
  ) {
    const result = await this.authService.login(dto, res);
    
    return {
      success: true,
      data: {
        token: result.token,
        expiresIn: result.expiresIn,
        requiredResetPassword: result.requiredResetPassword,
      },
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req: ReqWithRequester,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req, res);
    return { success: true, message: 'Đăng xuất thành công' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Res({ passthrough: true }) res: Response,
    @Request() req: ExpressRequest,
  ) {
    // Lấy token từ request
    const token =
      req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw AppError.from(new Error('Token không hợp lệ hoặc đã hết hạn'), 401);
    }

    // Làm mới token
    const { token: newToken, expiresIn } = await this.authService.refreshToken(token);

    // Thiết lập cookie mới
    res.cookie('accessToken', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: expiresIn * 1000, // Chuyển đổi giây thành mili giây
    });

    return {
      success: true,
      data: {
        token: newToken,
        expiresIn,
      },
    };
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body(new ZodValidationPipe(requestPasswordResetDTOSchema))
    dto: RequestPasswordResetDTO,
  ) {
    const { resetToken, expiryDate, username } =
      await this.authService.requestPasswordReset(dto);

    // Trong môi trường production, token này sẽ được gửi qua email
    // Cho phát triển, trả về trực tiếp
    return {
      success: true,
      data: {
        resetToken,
        expiryDate,
        username,
        // Thông báo hướng dẫn người dùng trong production
        message: 'Một email đặt lại mật khẩu đã được gửi đến địa chỉ email của bạn.',
      },
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(userResetPasswordDTOSchema))
    dto: UserResetPasswordDTO,
  ) {
    await this.authService.resetPassword(dto);
    return { success: true, message: 'Mật khẩu đã được đặt lại thành công' };
  }
}