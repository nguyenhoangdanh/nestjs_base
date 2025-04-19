// src/modules/user/user-http.controller.ts
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
  UseGuards,
} from '@nestjs/common';
import {
  AppError,
  ErrNotFound,
  ReqWithRequester,
  UserRole,
} from 'src/share';
import { USER_SERVICE } from './user.di-token';
import {
  ChangePasswordDTO,
  PaginationDTO,
  UserCondDTO,
  UserRoleAssignmentDTO,
  UserUpdateDTO,
  UserUpdateProfileDTO,
  changePasswordDTOSchema,
  userRoleAssignmentDTOSchema,
  userUpdateDTOSchema,
  userUpdateProfileDTOSchema,
} from './user.dto';
import { IUserService } from './user.port';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../share/guard/roles';
import { Roles } from '../../share/guard/roles.decorator';
import { ZodValidationPipe } from '../../share/pipes/zod-validation.pipe';
import { UuidZodValidationPipe } from '../../share/pipes/uuid-validation.pipe';

@Controller()
export class UserHttpController {
  private readonly logger = new Logger(UserHttpController.name);
  
  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
  ) {}

  /**
   * Profile management endpoints
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(@Request() req: ReqWithRequester) {
    const data = await this.userService.profile(req.requester.sub);
    return { success: true, data };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Request() req: ReqWithRequester,
    @Body(new ZodValidationPipe(userUpdateProfileDTOSchema)) dto: UserUpdateProfileDTO,
  ) {
    await this.userService.update(req.requester, req.requester.sub, dto);
    return { success: true, message: 'Hồ sơ đã được cập nhật thành công' };
  }

  @Post('profile/change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: ReqWithRequester,
    @Body(new ZodValidationPipe(changePasswordDTOSchema)) dto: ChangePasswordDTO,
  ) {
    await this.userService.changePassword(req.requester.sub, dto);
    return { success: true, message: 'Mật khẩu đã được thay đổi thành công' };
  }

  /**
   * User management endpoints
   */
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
    // Đảm bảo pagination có giá trị mặc định
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUser(
    @Request() req: ReqWithRequester, 
    @Param('id', UuidZodValidationPipe) id: string
  ) {
    // Kiểm tra người dùng có yêu cầu hồ sơ của chính họ không hoặc có quyền admin
    if (
      req.requester.sub !== id &&
      req.requester.role !== UserRole.ADMIN &&
      req.requester.role !== UserRole.SUPER_ADMIN
    ) {
      // Kiểm tra xem người dùng có quyền truy cập vào người dùng này
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Request() req: ReqWithRequester,
    @Param('id', UuidZodValidationPipe) id: string,
    @Body(new ZodValidationPipe(userUpdateDTOSchema)) dto: UserUpdateDTO,
  ) {
    await this.userService.update(req.requester, id, dto);
    return { success: true, message: 'Người dùng đã được cập nhật thành công' };
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Request() req: ReqWithRequester, 
    @Param('id', UuidZodValidationPipe) id: string
  ) {
    await this.userService.delete(req.requester, id);
    return { success: true, message: 'Người dùng đã được xóa thành công' };
  }

  /**
   * Role management endpoints
   */
  @Get('users/:id/roles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserRoles(@Param('id', UuidZodValidationPipe) id: string) {
    const roles = await this.userService.getUserRoles(id);
    return { success: true, data: roles };
  }

  @Post('users/:id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Request() req: ReqWithRequester,
    @Param('id', UuidZodValidationPipe) id: string,
    @Body(new ZodValidationPipe(userRoleAssignmentDTOSchema)) dto: UserRoleAssignmentDTO,
  ) {
    await this.userService.assignRole(req.requester, id, dto);
    return { success: true, message: 'Vai trò đã được gán thành công' };
  }

  @Delete('users/:id/roles/:roleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeRole(
    @Request() req: ReqWithRequester,
    @Param('id', UuidZodValidationPipe) id: string,
    @Param('roleId', UuidZodValidationPipe) roleId: string,
    @Body() body: { scope?: string },
  ) {
    await this.userService.removeRole(req.requester, id, roleId, body.scope);
    return { success: true, message: 'Vai trò đã được xóa thành công' };
  }

  /**
   * Access control endpoints
   */
  @Get('access/:entityType/:entityId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async checkAccess(
    @Request() req: ReqWithRequester,
    @Param('entityType') entityType: string,
    @Param('entityId', UuidZodValidationPipe) entityId: string,
  ) {
    const hasAccess = await this.userService.canAccessEntity(
      req.requester.sub,
      entityType,
      entityId,
    );
    return { success: true, data: hasAccess };
  }
}