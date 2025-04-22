import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Inject,
  Type,
  Logger,
  Request,
  Controller,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppError, ReqWithRequester } from '../../../share';
import { ICrudService, PagingDTO } from '../interfaces/crud.interface';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';
import { RemoteAuthGuard } from '../../../share/guard';
import { ZodValidationPipe } from '../../../share/pipes/zod-validation.pipe';
import { UuidZodValidationPipe } from '../../../share/pipes/uuid-validation.pipe';
import { CrudRolesGuard } from '../guards/crud-roles.guard';

/**
 * Controller cơ sở với các thao tác CRUD
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 * @template F - Filter DTO type
 */
export abstract class BaseCrudController<T, C, U, F> {
  protected readonly logger: Logger;

  constructor(
    protected readonly service: ICrudService<T, C, U>,
    protected readonly options: CrudControllerOptions<T, C, U, F>,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Tạo mới entity
   */
  @Post()
  @UseGuards(RemoteAuthGuard, CrudRolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new entity' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Entity created successfully',
  })
  async create(
    @Body(new ZodValidationPipe(null)) dto: C,
    @Request() req: ReqWithRequester,
  ) {
    if (!this.isEndpointEnabled('create')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      const id = await this.service.createEntity(req.requester, dto);
      return {
        success: true,
        data: { id },
      };
    } catch (error) {
      this.logger.error(`Error creating entity: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Lấy danh sách entity
   */
  @Get()
  @UseGuards(RemoteAuthGuard, CrudRolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List entities' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (starts from 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Field to sort by',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (asc or desc)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of entities' })
  async list(
    @Query() filter: F,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Request() req: ReqWithRequester,
  ) {
    if (!this.isEndpointEnabled('getAll')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      // Cast and validate order to ensure it's 'asc' or 'desc'
      const validOrder =
        sortOrder && ['asc', 'desc'].includes(String(sortOrder).toLowerCase())
          ? (String(sortOrder).toLowerCase() as 'asc' | 'desc')
          : 'desc';

      const pagination: PagingDTO = {
        page: Number(page),
        limit: Number(limit),
        sortBy: String(sortBy),
        sortOrder: validOrder,
      };

      const result = await this.service.listEntities(
        req.requester,
        filter,
        pagination,
      );

      return {
        success: true,
        data: result.data,
        paging: result.paging,
        total: result.total,
        filter,
      };
    } catch (error) {
      this.logger.error(
        `Error listing entities: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Lấy entity theo ID
   */
  @Get(':id')
  @UseGuards(RemoteAuthGuard, CrudRolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get entity by ID' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Entity found' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Entity not found',
  })
  async getById(
    @Param('id', UuidZodValidationPipe) id: string,
    @Request() req: ReqWithRequester,
  ) {
    if (!this.isEndpointEnabled('getOne')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      const entity = await this.service.getEntity(id);
      return { success: true, data: entity };
    } catch (error) {
      this.logger.error(`Error getting entity: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Cập nhật entity
   */
  @Patch(':id')
  @UseGuards(RemoteAuthGuard, CrudRolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update entity' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Entity updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Entity not found',
  })
  async update(
    @Param('id', UuidZodValidationPipe) id: string,
    @Body(new ZodValidationPipe(null)) dto: U,
    @Request() req: ReqWithRequester,
  ) {
    if (!this.isEndpointEnabled('update')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      await this.service.updateEntity(req.requester, id, dto);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error updating entity: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Xóa entity
   */
  @Delete(':id')
  @UseGuards(RemoteAuthGuard, CrudRolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete entity' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Entity deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Entity not found',
  })
  async delete(
    @Param('id', UuidZodValidationPipe) id: string,
    @Request() req: ReqWithRequester,
  ) {
    if (!this.isEndpointEnabled('delete')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      await this.service.deleteEntity(req.requester, id);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting entity: ${error.message}`, error.stack);
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Đếm số lượng entity
   */
  @Get('count')
  @UseGuards(RemoteAuthGuard, CrudRolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Count entities' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Count of entities' })
  async count(@Query() filter: F, @Request() req: ReqWithRequester) {
    if (!this.isEndpointEnabled('count')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      const count = await this.service.countEntities(req.requester, filter);
      return { success: true, data: { count } };
    } catch (error) {
      this.logger.error(
        `Error counting entities: ${error.message}`,
        error.stack,
      );
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.from(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Kiểm tra xem endpoint có được bật không
   */
  protected isEndpointEnabled(endpoint: string): boolean {
    if (!this.options?.endpoints) {
      return true; // Mặc định là bật nếu không có cấu hình
    }

    const endpointConfig = this.options.endpoints[endpoint];
    return endpointConfig?.enabled !== false; // Mặc định là bật trừ khi cấu hình tắt
  }
}

/**
 * Factory function để tạo controller
 */
export function createCrudController<T, C, U, F = any>(options: {
  service: string | symbol;
  controllerOptions: CrudControllerOptions<T, C, U, F>;
}): Type<BaseCrudController<T, C, U, F>> {
  const { service, controllerOptions } = options;

  @Controller() // Adding empty Controller decorator here
  @UseGuards(RemoteAuthGuard) // Add this line to apply the guard
  @ApiTags(controllerOptions.swagger?.tags || [controllerOptions.entityName])
  class CrudControllerHost extends BaseCrudController<T, C, U, F> {
    constructor(
      @Inject(service) crudService: ICrudService<T, C, U>,
      @Inject(CRUD_OPTIONS) options: CrudControllerOptions<T, C, U, F>,
    ) {
      super(crudService, options);
    }
  }

  return CrudControllerHost;
}
