import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import {
  AppError,
  ErrNotFound,
  ReqWithRequester,
  TokenPayload,
  UserRole,
} from 'src/share';
import { RemoteAuthGuard, Roles, RolesGuard } from 'src/share/guard';
import { TOKEN_SERVICE, USER_REPOSITORY, USER_SERVICE } from './user.di-token';
import {
  ChangePasswordDTO,
  PaginationDTO,
  RequestPasswordResetDTO,
  UserCondDTO,
  UserLoginDTO,
  UserRegistrationDTO,
  UserResetPasswordDTO,
  UserRoleAssignmentDTO,
  UserUpdateDTO,
  UserUpdateProfileDTO,
} from './user.dto';
import { ErrInvalidToken, User } from './user.model';
import { ITokenService, IUserRepository, IUserService } from './user.port';

@Controller()
export class UserHttpController {
  private readonly logger = new Logger(UserHttpController.name);
  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
  ) {}

  /**
   * Auth endpoints
   */
  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: UserRegistrationDTO) {
    const userId = await this.userService.register(dto);
    return {
      success: true,
      data: { userId },
    };
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Res({ passthrough: true }) res: ExpressResponse,
    @Body() dto: UserLoginDTO,
  ) {
    const { token, expiresIn, requiredResetPassword } =
      await this.userService.login(dto);

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

  @Post('auth/logout')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
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
      await this.userService.logout(cookieToken);
    }

    if (headerToken && headerToken !== cookieToken) {
      await this.userService.logout(headerToken);
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
  catch(error: unknown) {
    // Add the explicit 'unknown' type here
    this.logger.error(
      `Error during logout: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { success: true, message: 'Đăng xuất thành công' }; // Still return success
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
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
      await this.userService.refreshToken(token);

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

  /**
   * Password management endpoints
   */
  @Post('auth/request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDTO) {
    const { resetToken, expiryDate, username } =
      await this.userService.requestPasswordReset(dto);

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

  @Post('auth/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: UserResetPasswordDTO) {
    await this.userService.resetPassword(dto);
    return { success: true };
  }

  @Post('auth/change-password')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: ReqWithRequester,
    @Body() dto: ChangePasswordDTO,
  ) {
    await this.userService.changePassword(req.requester.sub, dto);
    return { success: true };
  }

  /**
   * Profile management endpoints
   */
  @Get('profile')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@Request() req: ReqWithRequester) {
    const data = await this.userService.profile(req.requester.sub);
    return { success: true, data };
  }

  @Patch('profile')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Request() req: ReqWithRequester,
    @Body() dto: UserUpdateProfileDTO,
  ) {
    await this.userService.update(req.requester, req.requester.sub, dto);
    return { success: true };
  }

  /**
   * User management endpoints
   */
  @Get('users')
  @UseGuards(RemoteAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.FACTORY_MANAGER,
    UserRole.LINE_MANAGER,
    UserRole.TEAM_LEADER,
  )
  @HttpCode(HttpStatus.OK)
  async listUsers(
    @Request() req: ReqWithRequester,
    @Query() conditions: UserCondDTO,
    @Query() pagination: PaginationDTO,
  ) {
    // Ensure pagination has default values
    const validatedPagination: PaginationDTO = {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      sortBy: pagination.sortBy || 'createdAt',
      sortOrder: pagination.sortOrder || 'desc',
    };
    const result = await this.userService.listUsers(
      req.requester,
      conditions,
      validatedPagination,
    );
    return { success: true, ...result };
  }

  @Get('users/:id')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUser(@Request() req: ReqWithRequester, @Param('id') id: string) {
    // Check if user is requesting their own profile or has admin access
    if (
      req.requester.sub !== id &&
      req.requester.role !== UserRole.ADMIN &&
      req.requester.role !== UserRole.SUPER_ADMIN
    ) {
      // Check if user has access to this user
      const hasAccess = await this.userService.canAccessEntity(
        req.requester.sub,
        'user',
        id,
      );
      if (!hasAccess) {
        throw AppError.from(
          new Error('Bạn không có quyền xem thông tin người dùng này'),
          403,
        );
      }
    }

    const data = await this.userService.profile(id);
    return { success: true, data };
  }

  @Patch('users/:id')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Request() req: ReqWithRequester,
    @Param('id') id: string,
    @Body() dto: UserUpdateDTO,
  ) {
    await this.userService.update(req.requester, id, dto);
    return { success: true };
  }

  @Delete('users/:id')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Request() req: ReqWithRequester, @Param('id') id: string) {
    await this.userService.delete(req.requester, id);
    return { success: true };
  }

  /**
   * Role management endpoints
   */
  @Get('users/:id/roles')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserRoles(@Param('id') id: string) {
    const roles = await this.userService.getUserRoles(id);
    return { success: true, data: roles };
  }

  @Post('users/:id/roles')
  @UseGuards(RemoteAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Request() req: ReqWithRequester,
    @Param('id') id: string,
    @Body() dto: UserRoleAssignmentDTO,
  ) {
    await this.userService.assignRole(req.requester, id, dto);
    return { success: true };
  }

  @Delete('users/:id/roles/:roleId')
  @UseGuards(RemoteAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeRole(
    @Request() req: ReqWithRequester,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Body() body: { scope?: string },
  ) {
    await this.userService.removeRole(req.requester, id, roleId, body.scope);
    return { success: true };
  }

  /**
   * Access control endpoints
   */
  @Get('access/:entityType/:entityId')
  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.OK)
  async checkAccess(
    @Request() req: ReqWithRequester,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const hasAccess = await this.userService.canAccessEntity(
      req.requester.sub,
      entityType,
      entityId,
    );
    return { success: true, data: hasAccess };
  }
}

/**
 * RPC Controller for internal service communication
 */
@Controller('rpc')
export class UserRpcHttpController {
  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  @Post('introspect')
  @HttpCode(HttpStatus.OK)
  async introspect(
    @Body() dto: { token: string },
  ): Promise<{ data: TokenPayload }> {
    const result = await this.userService.introspectToken(dto.token);
    return { data: result };
  }

  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  async getUser(@Param('id') id: string) {
    const user = await this.userRepository.get(id);
    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }
    return { data: this._toResponseModel(user) };
  }

  @Post('users/list-by-ids')
  @HttpCode(HttpStatus.OK)
  async listUsersByIds(@Body('ids') ids: string[]) {
    const users = await this.userRepository.listByIds(ids);
    return { data: users.map(this._toResponseModel) };
  }

  @Post('users/check-access')
  @HttpCode(HttpStatus.OK)
  async checkUserAccess(
    @Body() body: { userId: string; entityType: string; entityId: string },
  ) {
    const hasAccess = await this.userService.canAccessEntity(
      body.userId,
      body.entityType,
      body.entityId,
    );
    return { data: hasAccess };
  }

  private _toResponseModel(user: User): Omit<User, 'password' | 'salt'> {
    const { password, salt, ...rest } = user;
    return rest;
  }
}
