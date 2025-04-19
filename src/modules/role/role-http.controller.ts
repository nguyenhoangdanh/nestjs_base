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
  Req,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ROLE_SERVICE } from './role.di-token';
import { IRoleService } from './role.port';
import { RoleCondDTO, RoleDTO, roleDTOSchema } from './role.dto';
import { PaginationDTO } from '../user/user.dto';
import { RemoteAuthGuard, Roles, RolesGuard } from 'src/share/guard';
import { ReqWithRequester, UserRole } from 'src/share';
import { ZodValidationPipe } from 'src/share/pipes/zod-validation.pipe';

@Controller('roles')
@UseGuards(RemoteAuthGuard, RolesGuard)
export class RoleHttpController {
  constructor(
    @Inject(ROLE_SERVICE) private readonly roleService: IRoleService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async createRole(
    @Body(new ZodValidationPipe(roleDTOSchema)) dto: RoleDTO,
  ): Promise<{ id: string }> {
    const id = await this.roleService.createRole(dto);
    return { id };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async listRoles(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('code') code?: string,
    @Query('name') name?: string,
    @Query('level') level?: number,
    @Query('isSystem') isSystem?: boolean,
  ) {
    const pagination: PaginationDTO = {
      page: +page,
      limit: +limit,
      sortBy,
      sortOrder,
    };

    const conditions: RoleCondDTO = {};
    if (code) conditions.code = code;
    if (name) conditions.name = name;
    if (level !== undefined) conditions.level = +level;
    if (isSystem !== undefined) conditions.isSystem = isSystem === true;

    return this.roleService.listRoles(conditions, pagination);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getRole(@Param('id') id: string) {
    return this.roleService.getRole(id);
  }

  @Get('code/:code')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getRoleByCode(@Param('code') code: string) {
    return this.roleService.getRoleByCode(code);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async updateRole(
    @Param('id') id: string,
    @Request() req: ReqWithRequester,
    @Body(new ZodValidationPipe(roleDTOSchema)) dto: RoleDTO,
  ) {
    await this.roleService.updateRole(id, dto, req.requester.role);
    return { message: 'Vai trò đã được cập nhật thành công' };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async deleteRole(@Param('id') id: string) {
    await this.roleService.deleteRole(id);
    return { message: 'Vai trò đã được xóa thành công' };
  }

  @Get(':id/relations')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getRoleWithRelations(@Param('id') id: string) {
    return this.roleService.getRoleWithRelations(id);
  }
}
