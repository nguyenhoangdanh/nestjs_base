import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReqWithRequester, UserRole } from 'src/share';
import { RemoteAuthGuard, Roles, RolesGuard } from 'src/share/guard';
import { ZodValidationPipe } from 'src/share/pipes/zod-validation.pipe';
import { PaginationDTO } from '../user/user.dto';
import { PERMISSION_SERVICE } from './permission.di-token';
import {
  AssignPermissionsDTO,
  CreatePermissionDTO,
  PermissionCondDTO,
  UpdatePermissionDTO,
  UserPermissionsQueryDTO,
  assignPermissionsDTOSchema,
  createPermissionDTOSchema,
  updatePermissionDTOSchema,
} from './permission.dto';
import { IPermissionService } from './permission.port';
import { UuidZodValidationPipe } from 'src/share/pipes/uuid-validation.pipe';

@Controller('permissions')
@UseGuards(RemoteAuthGuard, RolesGuard)
export class PermissionHttpController {
  constructor(
    @Inject(PERMISSION_SERVICE)
    private readonly permissionService: IPermissionService,
  ) {}

  // CRUD Permissions
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async createPermission(
    @Body(new ZodValidationPipe(createPermissionDTOSchema))
    dto: CreatePermissionDTO,
  ): Promise<{ id: string }> {
    const id = await this.permissionService.createPermission(dto);
    return { id };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async listPermissions(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('code') code?: string,
    @Query('name') name?: string,
    @Query('type') type?: string,
    @Query('module') module?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    const pagination: PaginationDTO = {
      page: +page,
      limit: +limit,
      sortBy,
      sortOrder,
    };

    const conditions: PermissionCondDTO = {};
    if (code) conditions.code = code;
    if (name) conditions.name = name;
    if (type) conditions.type = type as any;
    if (module) conditions.module = module;
    if (isActive !== undefined) conditions.isActive = isActive === true;

    return this.permissionService.listPermissions(conditions, pagination);
  }

  // Client-side permissions API
  @Get('client-access')
  @UseGuards(RemoteAuthGuard)
  async getClientAccessPermissions(@Request() req: ReqWithRequester) {
    const query: UserPermissionsQueryDTO = {
      includeInactive: false,
    };

    const { pageAccess, featureAccess } =
      await this.permissionService.getUserPermissions(query, req.requester);

    return {
      success: true,
      data: {
        pages: pageAccess,
        features: featureAccess,
      },
    };
  }

  // User Permissions
  @Get('user')
  @UseGuards(RemoteAuthGuard)
  async getUserPermissions(
    @Request() req: ReqWithRequester,
    @Query('userId') userId?: string,
    @Query('includeInactive') includeInactive?: boolean,
    @Query('type') type?: string,
    @Query('module') module?: string,
  ) {
    const query: UserPermissionsQueryDTO = {
      userId,
      includeInactive: includeInactive === true,
      type: type as any,
      module,
    };

    const result = await this.permissionService.getUserPermissions(
      query,
      req.requester,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get('user/check/:permissionCode')
  @UseGuards(RemoteAuthGuard)
  async checkUserHasPermission(
    @Request() req: ReqWithRequester,
    @Param('permissionCode') permissionCode: string,
  ) {
    const hasPermission = await this.permissionService.checkUserHasPermission(
      req.requester.sub,
      permissionCode,
    );
    return {
      success: true,
      data: { hasPermission },
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getPermission(@Param('id', UuidZodValidationPipe) id: string) {
    return this.permissionService.getPermission(id);
  }

  @Get('code/:code')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getPermissionByCode(@Param('code') code: string) {
    return this.permissionService.getPermissionByCode(code);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async updatePermission(
    @Param('id', UuidZodValidationPipe) id: string,
    @Body(new ZodValidationPipe(updatePermissionDTOSchema))
    dto: UpdatePermissionDTO,
  ) {
    await this.permissionService.updatePermission(id, dto);
    return { message: 'Quyền đã được cập nhật thành công' };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async deletePermission(@Param('id', UuidZodValidationPipe) id: string) {
    await this.permissionService.deletePermission(id);
    return { message: 'Quyền đã được xóa thành công' };
  }

  // Role Permissions
  @Get('role/:roleId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getPermissionsByRole(
    @Param('roleId', UuidZodValidationPipe) roleId: string,
  ) {
    const permissions =
      await this.permissionService.getPermissionsByRole(roleId);
    return { data: permissions };
  }

  @Post('role/:roleId/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async assignPermissionsToRole(
    @Request() req: ReqWithRequester,
    @Param('roleId', UuidZodValidationPipe) roleId: string,
    @Body(new ZodValidationPipe(assignPermissionsDTOSchema))
    dto: AssignPermissionsDTO,
  ) {
    await this.permissionService.assignPermissionsToRole(
      req.requester,
      roleId,
      dto,
    );
    return { message: 'Đã gán quyền cho vai trò thành công' };
  }

  @Post('role/:roleId/remove')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async removePermissionsFromRole(
    @Request() req: ReqWithRequester,
    @Param('roleId', UuidZodValidationPipe) roleId: string,
    @Body(new ZodValidationPipe(assignPermissionsDTOSchema))
    dto: AssignPermissionsDTO,
  ) {
    await this.permissionService.removePermissionsFromRole(
      req.requester,
      roleId,
      dto,
    );
    return { message: 'Đã xóa quyền khỏi vai trò thành công' };
  }
}
