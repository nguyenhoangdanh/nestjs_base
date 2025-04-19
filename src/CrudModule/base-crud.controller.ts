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
import { AppError, ReqWithRequester } from 'src/share';
import { ICrudService, PagingDTO } from './crud.interface';
import { CRUD_OPTIONS } from './crud.decorator';
import { RemoteAuthGuard } from 'src/share/guard';

/**
 * Base controller with CRUD operations
 */
export abstract class BaseCrudController<T, C, U, F> {
  protected readonly logger: Logger;

  constructor(
    protected readonly service: ICrudService<T, C, U>,
    protected readonly options: any,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: C, @Request() req: ReqWithRequester) {
    if (!this.options.endpoints.create) {
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

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query() filter: F,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sort') sort = 'createdAt',
    @Query('order') order = 'desc',
    @Request() req: ReqWithRequester,
  ) {
    if (!this.options.endpoints.getAll) {
      throw AppError.from(new Error('Endpoint not available'), 404);
    }

    try {
      // Cast and validate order to ensure it's 'asc' or 'desc'
      const validOrder =
        order && ['asc', 'desc'].includes(String(order).toLowerCase())
          ? (String(order).toLowerCase() as 'asc' | 'desc')
          : 'desc';

      const pagination: PagingDTO = {
        page: Number(page),
        limit: Number(limit),
        sort: String(sort),
        order: validOrder,
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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id') id: string) {
    if (!this.options.endpoints.getOne) {
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

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: U,
    @Request() req: ReqWithRequester,
  ) {
    if (!this.options.endpoints.update) {
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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Request() req: ReqWithRequester) {
    if (!this.options.endpoints.delete) {
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
}

/**
 * Factory function to create a CRUD controller class
 */
export function createCrudController<T, C, U, F = any>(options: {
  service: string | symbol;
  modelName: string;
}): Type<BaseCrudController<T, C, U, F>> {
  const { service, modelName } = options;

  @Controller() // Adding empty Controller decorator here
  @UseGuards(RemoteAuthGuard) // Add this line to apply the guard
  class CrudControllerHost extends BaseCrudController<T, C, U, F> {
    constructor(
      @Inject(service) crudService: ICrudService<T, C, U>,
      @Inject(CRUD_OPTIONS) options: any,
    ) {
      super(crudService, options);
    }
  }

  return CrudControllerHost;
}
