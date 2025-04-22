// src/core/repositories/base.repository.ts
import { Repository, FindOptionsWhere, FindManyOptions, Entity } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginatedResult } from '../interfaces/paginated-result.interface';
import { BaseEntity } from '../entities/base.entity';
import { BaseQueryDto } from '../dtos/base.dto';

@Injectable()
export abstract class BaseRepository<T extends BaseEntity> {
  constructor(
    @InjectRepository(Entity) protected readonly repository: Repository<T>,
  ) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findOneBy({ id } as FindOptionsWhere<T>);
  }

  async findAll(query: BaseQueryDto): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const skip = (page - 1) * limit;

    const [items, total] = await this.repository.findAndCount({
      skip,
      take: limit,
      order: { [sortBy]: sortOrder },
    } as FindManyOptions<T>);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: Partial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected > 0;
  }

  // Add custom query methods here that all repositories would benefit from
  async exists(id: string): Promise<boolean> {
    return (await this.repository.countBy({ id } as FindOptionsWhere<T>)) > 0;
  }

  // Trong BaseRepository
  async runInTransaction<T>(
    callback: (repo: Repository<T>) => Promise<any>,
  ): Promise<any> {
    return this.repository.manager.transaction(async (transactionManager) => {
      const transactionalRepository = transactionManager.getRepository(
        this.entity,
      );
      return callback(transactionalRepository);
    });
  }
}
