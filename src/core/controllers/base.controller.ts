// src/core/controllers/base.controller.ts
import {
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BaseService } from '../services/base.service';
import { BaseEntity } from '../entities/base.entity';
import { BaseCreateDto, BaseUpdateDto, BaseQueryDto } from '../dtos/base.dto';
import { PaginatedResult } from '../interfaces/paginated-result.interface';
import { Roles, RolesGuard } from 'src/share/guard';

export abstract class BaseController<
  T extends BaseEntity,
  CreateDto extends BaseCreateDto,
  UpdateDto extends BaseUpdateDto,
  QueryDto extends BaseQueryDto,
> {
  constructor(
    protected readonly service: BaseService<T, CreateDto, UpdateDto, QueryDto>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all entities with pagination' })
  @ApiResponse({ status: 200, description: 'Return all entities.' })
  async findAll(@Query() query: QueryDto): Promise<PaginatedResult<T>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get one entity' })
  @ApiResponse({ status: 200, description: 'Return one entity.' })
  @ApiResponse({ status: 404, description: 'Entity not found.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<T> {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN') // Override this in child controllers
  @ApiOperation({ summary: 'Create entity' })
  @ApiResponse({ status: 201, description: 'Entity has been created.' })
  async create(@Body() createDto: CreateDto): Promise<T> {
    return this.service.create(createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin') // Override this in child controllers
  @ApiOperation({ summary: 'Update entity' })
  @ApiResponse({ status: 200, description: 'Entity has been updated.' })
  @ApiResponse({ status: 404, description: 'Entity not found.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDto,
  ): Promise<T> {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin') // Override this in child controllers
  @ApiOperation({ summary: 'Delete entity' })
  @ApiResponse({ status: 200, description: 'Entity has been deleted.' })
  @ApiResponse({ status: 404, description: 'Entity not found.' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const result = await this.service.delete(id);
    return { success: result };
  }
}
