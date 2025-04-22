// src/core/services/base.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseRepository } from '../repositories/base.repository';
import { BaseEntity } from '../entities/base.entity';
import { BaseQueryDto, BaseCreateDto, BaseUpdateDto } from '../dtos/base.dto';
import { PaginatedResult } from '../interfaces/paginated-result.interface';

@Injectable()
export abstract class BaseService<
  T extends BaseEntity,
  CreateDto extends BaseCreateDto,
  UpdateDto extends BaseUpdateDto,
  QueryDto extends BaseQueryDto,
> {
  constructor(protected readonly repository: BaseRepository<T>) {}

  async findAll(query: QueryDto): Promise<PaginatedResult<T>> {
    return this.repository.findAll(query);
  }

  async findById(id: string): Promise<T> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Entity with ID '${id}' not found`);
    }
    return entity;
  }

  async create(createDto: CreateDto): Promise<T> {
    // Hook for validation before creating
    await this.validateCreate(createDto);

    return this.repository.create(createDto as any);
  }

  async update(id: string, updateDto: UpdateDto): Promise<T> {
    // Ensure entity exists
    await this.findById(id);

    // Hook for validation before updating
    await this.validateUpdate(id, updateDto);

    return this.repository.update(id, updateDto as any);
  }

  async delete(id: string): Promise<boolean> {
    // Ensure entity exists
    await this.findById(id);

    // Hook for validation before deletion
    await this.validateDelete(id);

    return this.repository.delete(id);
  }

  // Override these methods in derived services if needed
  protected async validateCreate(createDto: CreateDto): Promise<void> {
    // Default implementation does nothing
  }

  protected async validateUpdate(
    id: string,
    updateDto: UpdateDto,
  ): Promise<void> {
    // Default implementation does nothing
  }

  protected async validateDelete(id: string): Promise<void> {
    // Default implementation does nothing
  }
}
