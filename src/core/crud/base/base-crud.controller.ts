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
  Request,
  UseGuards,
} from '@nestjs/common';
import { AppError, ReqWithRequester } from '../../../share';
import { ICrudService, PagingDTO } from '../interfaces/crud.interface';
import {
  CrudControllerOptions,
  CrudEndpointType,
} from '../interfaces/crud-options.interface';
import { RemoteAuthGuard } from '../../../share/guard';
import { UuidZodValidationPipe } from '../../../share/pipes/uuid-validation.pipe';
import { CrudRolesGuard } from '../guards/crud-roles.guard';
import { CrudValidationPipe } from '../pipes/crud-validation.pipe';

/**
 * Controller cơ sở với các thao tác CRUD
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 * @template F - Filter DTO type
 */
export abstract class BaseCrudController<T, C, U, F> {
  /**
   * Constructor
   * @param service CRUD service
   * @param options Controller options
   */
  constructor(
    protected readonly service: ICrudService<T, C, U>,
    protected readonly options: CrudControllerOptions<T, C, U, F>,
  ) {}

  /**
   * Tạo mới entity
   */
  @Post()
  @UseGuards(RemoteAuthGuard, CrudRolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new CrudValidationPipe()) dto: C,
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
  async getById(
    @Param('id', UuidZodValidationPipe) id: string,
    // @Request() req: ReqWithRequester,
  ) {
    if (!this.isEndpointEnabled('getOne')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      const entity = await this.service.getEntity(id);
      return { success: true, data: entity };
    } catch (error) {
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
  async update(
    @Param('id', UuidZodValidationPipe) id: string,
    @Body(new CrudValidationPipe()) dto: U,
    @Request() req: ReqWithRequester,
  ) {
    if (!this.isEndpointEnabled('update')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      await this.service.updateEntity(req.requester, id, dto);
      return {
        success: true,
        message: `${this.options.entityName} updated successfully`,
      };
    } catch (error) {
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
  async delete(
    @Param('id', UuidZodValidationPipe) id: string,
    @Request() req: ReqWithRequester,
  ) {
    if (!this.isEndpointEnabled('delete')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      await this.service.deleteEntity(req.requester, id);
      return {
        success: true,
        message: `${this.options.entityName} deleted successfully`,
      };
    } catch (error) {
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
  async count(@Query() filter: F, @Request() req: ReqWithRequester) {
    if (!this.isEndpointEnabled('count')) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      const count = await this.service.countEntities(req.requester, filter);
      return { success: true, data: { count } };
    } catch (error) {
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
      return true;
    }

    // Use type assertion with safety check
    const validEndpoints = [
      'getAll',
      'getOne',
      'create',
      'update',
      'delete',
      'count',
    ];
    if (validEndpoints.includes(endpoint)) {
      const endpointConfig =
        this.options.endpoints[endpoint as CrudEndpointType];
      return endpointConfig?.enabled !== false;
    }

    return true;
  }
}
