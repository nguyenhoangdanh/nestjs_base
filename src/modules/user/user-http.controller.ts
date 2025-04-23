// src/modules/user/user-http.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserFilterDto,
  PaginationDto,
  createUserDtoSchema,
  updateUserDtoSchema,
} from './user.dto';
import { RemoteAuthGuard, RolesGuard } from '../../share/guard';
import { Roles } from '../../share/guard/roles.decorator';
import { ReqWithRequester, UserRole } from '../../share';
import { ZodValidationPipe } from '../../share/pipes/zod-validation.pipe';
import { UuidZodValidationPipe } from '../../share/pipes/uuid-validation.pipe';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
@UseGuards(RemoteAuthGuard, RolesGuard)
export class UserHttpController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  async createUser(
    @Body(new ZodValidationPipe(createUserDtoSchema)) dto: CreateUserDto,
  ) {
    const id = await this.userService.createUser(dto);
    return { success: true, data: { id } };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or email',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  async getUsers(
    @Request() req: ReqWithRequester,
    @Query() filter: UserFilterDto,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const pagination: PaginationDto = { page, limit, sortBy, sortOrder };
    const result = await this.userService.listUsers(
      req.requester,
      filter,
      pagination,
    );
    return { success: true, ...result };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async getUser(
    @Request() req: ReqWithRequester,
    @Param('id', UuidZodValidationPipe) id: string,
  ) {
    // Only allow users to access their own profile unless admin
    if (
      req.requester.sub !== id &&
      req.requester.role !== UserRole.ADMIN &&
      req.requester.role !== UserRole.SUPER_ADMIN
    ) {
      throw AppError.from(
        new Error('You do not have permission to access this user'),
        403,
      );
    }

    const user = await this.userService.getUserProfile(id);
    return { success: true, data: user };
  }

  @Get('me/profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async getProfile(@Request() req: ReqWithRequester) {
    const user = await this.userService.getUserProfile(req.requester.sub);
    const roles = await this.userService.getUserRoles(req.requester.sub);
    return {
      success: true,
      data: {
        ...user,
        roles: roles.map((r) => r.role),
      },
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  async updateUser(
    @Request() req: ReqWithRequester,
    @Param('id', UuidZodValidationPipe) id: string,
    @Body(new ZodValidationPipe(updateUserDtoSchema)) dto: UpdateUserDto,
  ) {
    await this.userService.updateUser(req.requester, id, dto);
    return { success: true, message: 'User updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiQuery({
    name: 'hardDelete',
    required: false,
    type: Boolean,
    description: 'Perform hard delete instead of soft delete',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  async deleteUser(
    @Request() req: ReqWithRequester,
    @Param('id', UuidZodValidationPipe) id: string,
    @Query('hardDelete') hardDelete = false,
  ) {
    await this.userService.deleteUser(req.requester, id, hardDelete);
    return { success: true, message: 'User deleted successfully' };
  }

  // 2FA Endpoints
  @Post('me/2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setup 2FA for the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA setup initiated successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async setup2FA(@Request() req: ReqWithRequester) {
    const { secret, qrCodeUrl } = await this.userService.setup2FA(
      req.requester.sub,
    );
    return { success: true, data: { secret, qrCodeUrl } };
  }

  @Post('me/2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { token: { type: 'string' } },
      required: ['token'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA token verified successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid 2FA token',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async verify2FA(
    @Request() req: ReqWithRequester,
    @Body() body: { token: string },
  ) {
    const isValid = await this.userService.verify2FA(
      req.requester.sub,
      body.token,
    );
    return {
      success: isValid,
      message: isValid
        ? '2FA token verified successfully'
        : 'Invalid 2FA token',
    };
  }

  @Post('me/2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable 2FA' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { enabled: { type: 'boolean' } },
      required: ['enabled'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA status updated successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async enable2FA(
    @Request() req: ReqWithRequester,
    @Body() body: { enabled: boolean },
  ) {
    await this.userService.enable2FA(req.requester.sub, body.enabled);
    return {
      success: true,
      message: body.enabled
        ? '2FA enabled successfully'
        : '2FA disabled successfully',
    };
  }

  @Post('me/2fa/backup-codes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate new 2FA backup codes' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Backup codes generated successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async generateBackupCodes(@Request() req: ReqWithRequester) {
    const backupCodes = await this.userService.generate2FABackupCodes(
      req.requester.sub,
    );
    return { success: true, data: { backupCodes } };
  }
}
