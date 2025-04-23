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
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { AppError, ReqWithRequester } from 'src/share';
import { RemoteAuthGuard } from 'src/share/guard';
import { AUTH_SERVICE, TOKEN_SERVICE } from './auth.di-token';
import {
  ChangePasswordDTO,
  LoginDTO,
  RegistrationDTO,
  RequestPasswordResetDTO,
  ResetPasswordDTO,
  changePasswordDTOSchema,
  loginDTOSchema,
  registrationDTOSchema,
  requestPasswordResetDTOSchema,
  resetPasswordDTOSchema,
} from './auth.dto';
import { ErrInvalidToken } from './auth.model';
import { IAuthService, ITokenService } from './auth.port';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ZodValidationPipe } from 'src/share/pipes/zod-validation.pipe';
import { z } from 'zod';
import { createDtoFromZodSchema } from 'src/utils/zod-to-swagger.util';

// Create DTO classes from Zod schemas for Swagger
const RegistrationDTOClass = createDtoFromZodSchema(
  registrationDTOSchema,
  'RegistrationDTO',
  {
    examples: {
      username: 'johndoe',
      password: 'password123',
      fullName: 'John Doe',
      employeeId: 'EMP001',
      cardId: 'CARD001',
      factoryId: '123e4567-e89b-12d3-a456-426614174000',
      lineId: '123e4567-e89b-12d3-a456-426614174001',
      teamId: '123e4567-e89b-12d3-a456-426614174002',
      groupId: '123e4567-e89b-12d3-a456-426614174003',
      positionId: '123e4567-e89b-12d3-a456-426614174004',
      email: 'john.doe@example.com',
      phone: '+84123456789',
      defaultRoleCode: 'WORKER',
    },
  },
);

const LoginDTOClass = createDtoFromZodSchema(loginDTOSchema, 'LoginDTO', {
  examples: {
    username: '552502356',
    password: 'Admin@123',
    rememberMe: true,
  },
});

const ChangePasswordDTOClass = createDtoFromZodSchema(
  changePasswordDTOSchema,
  'ChangePasswordDTO',
  {
    examples: {
      oldPassword: 'oldPassword123',
      newPassword: 'newPassword123',
      confirmPassword: 'newPassword123',
    },
  },
);

const RequestPasswordResetDTOClass = createDtoFromZodSchema(
  requestPasswordResetDTOSchema,
  'RequestPasswordResetDTO',
  {
    examples: {
      username: 'johndoe',
      // Alternative credentials
      cardId: 'CARD001',
      employeeId: 'EMP001',
    },
  },
);

const ResetPasswordDTOClass = createDtoFromZodSchema(
  resetPasswordDTOSchema,
  'ResetPasswordDTO',
  {
    examples: {
      username: 'johndoe',
      resetToken: '123e4567-e89b-12d3-a456-426614174099',
      password: 'newPassword123',
      confirmPassword: 'newPassword123',
    },
  },
);

const TokenRefreshClass = createDtoFromZodSchema(
  z.object({
    token: z.string().optional(),
  }),
  'TokenRefreshDTO',
  {
    examples: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  },
);

const TokenIntrospectClass = createDtoFromZodSchema(
  z.object({
    token: z.string(),
  }),
  'TokenIntrospectDTO',
  {
    examples: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  },
);

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegistrationDTOClass })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or username already exists',
  })
  async register(
    @Body(new ZodValidationPipe(registrationDTOSchema)) dto: RegistrationDTO,
  ) {
    const userId = await this.authService.register(dto);
    return {
      success: true,
      data: { userId },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDTOClass })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged in',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            expiresIn: { type: 'number', example: 86400 },
            requiredResetPassword: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid username or password',
  })
  async login(
    @Res({ passthrough: true }) res: ExpressResponse,
    @Body(new ZodValidationPipe(loginDTOSchema)) dto: LoginDTO,
  ) {
    const { token, expiresIn, requiredResetPassword } =
      await this.authService.login(dto);

    // Set HTTP-only cookie with the token
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: expiresIn * 1000, // Convert seconds to milliseconds
    });

    // Also send token in response for mobile/SPA clients
    return {
      success: true,
      data: {
        token,
        expiresIn,
        requiredResetPassword,
      },
    };
  }

  @Post('logout')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged out',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Đăng xuất thành công' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async logout(
    @Request() req: ReqWithRequester,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    // Extract all possible tokens
    const cookieToken = req.cookies?.accessToken;
    const headerToken = req.headers.authorization?.split(' ')[1];

    this.logger.debug(
      `Logout - Cookie token exists: ${!!cookieToken}, Auth header exists: ${!!headerToken}`,
    );

    // Log out and invalidate all available tokens
    if (cookieToken) {
      await this.authService.logout(cookieToken);
    }

    if (headerToken && headerToken !== cookieToken) {
      await this.authService.logout(headerToken);
    }

    // Clear cookies
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    // For better security, tell browsers to clear Authorization header
    // Note: This doesn't affect existing stored tokens in clients
    res.setHeader('Clear-Site-Data', '"cookies", "storage"');

    return { success: true, message: 'Đăng xuất thành công' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh an authentication token' })
  @ApiBody({ type: TokenRefreshClass, required: false })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token successfully refreshed',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            expiresIn: { type: 'number', example: 86400 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired token',
  })
  async refreshToken(
    @Res({ passthrough: true }) res: ExpressResponse,
    @Request() req: ExpressRequest,
  ) {
    // Get token from request
    const token =
      req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw AppError.from(ErrInvalidToken, 401);
    }

    // Refresh token
    const { token: newToken, expiresIn } =
      await this.authService.refreshToken(token);

    // Set new cookie
    res.cookie('accessToken', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: expiresIn * 1000, // Convert seconds to milliseconds
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
  @ApiOperation({ summary: 'Request a password reset token' })
  @ApiBody({ type: RequestPasswordResetDTOClass })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset token generated successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            resetToken: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174099',
            },
            expiryDate: {
              type: 'string',
              format: 'date-time',
              example: '2023-04-15T12:00:00.000Z',
            },
            username: { type: 'string', example: 'johndoe' },
            message: { type: 'string', example: 'Đã xác thực thành công!' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async requestPasswordReset(
    @Body(new ZodValidationPipe(requestPasswordResetDTOSchema))
    dto: RequestPasswordResetDTO,
  ) {
    const { resetToken, expiryDate, username } =
      await this.authService.requestPasswordReset(dto);

    // In production, you would send this token via email
    // For development, return it directly
    return {
      success: true,
      data: {
        resetToken,
        expiryDate,
        username,
        // Message to guide user in production
        message: 'Đã xác thực thành công!',
      },
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password with a token' })
  @ApiBody({ type: ResetPasswordDTOClass })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully reset',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data or token',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordDTOSchema)) dto: ResetPasswordDTO,
  ) {
    await this.authService.resetPassword(dto);
    return { success: true };
  }

  @Post('change-password')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the password of the authenticated user' })
  @ApiBody({ type: ChangePasswordDTOClass })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data or old password',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async changePassword(
    @Request() req: ReqWithRequester,
    @Body(new ZodValidationPipe(changePasswordDTOSchema))
    dto: ChangePasswordDTO,
  ) {
    await this.authService.changePassword(req.requester.sub, dto);
    return { success: true };
  }
}

/**
 * RPC Controller for internal service communication
 */
@Controller('rpc/auth')
@ApiTags('Authentication RPC')
export class AuthRpcController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
  ) {}

  @Post('introspect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Introspect a token (internal API)' })
  @ApiBody({ type: TokenIntrospectClass })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token successfully introspected',
    schema: {
      properties: {
        data: {
          type: 'object',
          properties: {
            sub: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            roleId: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174001',
            },
            role: { type: 'string', example: 'WORKER' },
            factoryId: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174002',
            },
            lineId: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174003',
            },
            teamId: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174004',
            },
            groupId: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174005',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid token',
  })
  async introspect(@Body() dto: { token: string }) {
    const result = await this.authService.introspectToken(dto.token);
    return { data: result };
  }
}

// import {
//   Body,
//   Controller,
//   HttpCode,
//   HttpStatus,
//   Inject,
//   Logger,
//   Post,
//   Request,
//   Res,
//   UseGuards,
// } from '@nestjs/common';
// import {
//   Request as ExpressRequest,
//   Response as ExpressResponse,
// } from 'express';
// import { AppError, ReqWithRequester } from 'src/share';
// import { RemoteAuthGuard } from 'src/share/guard';
// import { AUTH_SERVICE, TOKEN_SERVICE } from './auth.di-token';
// import {
//   ChangePasswordDTO,
//   LoginDTO,
//   RegistrationDTO,
//   RequestPasswordResetDTO,
//   ResetPasswordDTO,
// } from './auth.dto';
// import { ErrInvalidToken } from './auth.model';
// import { IAuthService, ITokenService } from './auth.port';
// import { ApiTags } from '@nestjs/swagger';

// @Controller('auth')
// @ApiTags('Authentication')
// export class AuthController {
//   private readonly logger = new Logger(AuthController.name);
//   constructor(
//     @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
//     @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
//   ) {}

//   @Post('register')
//   @HttpCode(HttpStatus.CREATED)
//   async register(@Body() dto: RegistrationDTO) {
//     const userId = await this.authService.register(dto);
//     return {
//       success: true,
//       data: { userId },
//     };
//   }

//   @Post('login')
//   @HttpCode(HttpStatus.OK)
//   async login(
//     @Res({ passthrough: true }) res: ExpressResponse,
//     @Body() dto: LoginDTO,
//   ) {
//     const { token, expiresIn, requiredResetPassword } =
//       await this.authService.login(dto);

//     // Set HTTP-only cookie with the token
//     res.cookie('accessToken', token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//       maxAge: expiresIn * 1000, // Convert seconds to milliseconds
//     });

//     // Also send token in response for mobile/SPA clients
//     return {
//       success: true,
//       data: {
//         token,
//         expiresIn,
//         requiredResetPassword,
//       },
//     };
//   }

//   @Post('logout')
//   @UseGuards(RemoteAuthGuard)
//   @HttpCode(HttpStatus.OK)
//   async logout(
//     @Request() req: ReqWithRequester,
//     @Res({ passthrough: true }) res: ExpressResponse,
//   ) {
//     // Extract all possible tokens
//     const cookieToken = req.cookies?.accessToken;
//     const headerToken = req.headers.authorization?.split(' ')[1];

//     this.logger.debug(
//       `Logout - Cookie token exists: ${!!cookieToken}, Auth header exists: ${!!headerToken}`,
//     );

//     // Log out and invalidate all available tokens
//     if (cookieToken) {
//       await this.authService.logout(cookieToken);
//     }

//     if (headerToken && headerToken !== cookieToken) {
//       await this.authService.logout(headerToken);
//     }

//     // Clear cookies
//     res.clearCookie('accessToken', {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//     });

//     // For better security, tell browsers to clear Authorization header
//     // Note: This doesn't affect existing stored tokens in clients
//     res.setHeader('Clear-Site-Data', '"cookies", "storage"');

//     return { success: true, message: 'Đăng xuất thành công' };
//   }

//   @Post('refresh')
//   @HttpCode(HttpStatus.OK)
//   async refreshToken(
//     @Res({ passthrough: true }) res: ExpressResponse,
//     @Request() req: ExpressRequest,
//   ) {
//     // Get token from request
//     const token =
//       req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];

//     if (!token) {
//       throw AppError.from(ErrInvalidToken, 401);
//     }

//     // Refresh token
//     const { token: newToken, expiresIn } =
//       await this.authService.refreshToken(token);

//     // Set new cookie
//     res.cookie('accessToken', newToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//       maxAge: expiresIn * 1000, // Convert seconds to milliseconds
//     });

//     return {
//       success: true,
//       data: {
//         token: newToken,
//         expiresIn,
//       },
//     };
//   }

//   @Post('request-password-reset')
//   @HttpCode(HttpStatus.OK)
//   async requestPasswordReset(@Body() dto: RequestPasswordResetDTO) {
//     const { resetToken, expiryDate, username } =
//       await this.authService.requestPasswordReset(dto);

//     // In production, you would send this token via email
//     // For development, return it directly
//     return {
//       success: true,
//       data: {
//         resetToken,
//         expiryDate,
//         username,
//         // Message to guide user in production
//         message: 'Đã xác thực thành công!',
//       },
//     };
//   }

//   @Post('reset-password')
//   @HttpCode(HttpStatus.OK)
//   async resetPassword(@Body() dto: ResetPasswordDTO) {
//     await this.authService.resetPassword(dto);
//     return { success: true };
//   }

//   @Post('change-password')
//   @UseGuards(RemoteAuthGuard)
//   @HttpCode(HttpStatus.OK)
//   async changePassword(
//     @Request() req: ReqWithRequester,
//     @Body() dto: ChangePasswordDTO,
//   ) {
//     await this.authService.changePassword(req.requester.sub, dto);
//     return { success: true };
//   }
// }

// /**
//  * RPC Controller for internal service communication
//  */
// @Controller('rpc/auth')
// export class AuthRpcController {
//   constructor(
//     @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
//   ) {}

//   @Post('introspect')
//   @HttpCode(HttpStatus.OK)
//   async introspect(@Body() dto: { token: string }) {
//     const result = await this.authService.introspectToken(dto.token);
//     return { data: result };
//   }
// }
