import { Injectable, Logger } from '@nestjs/common';
import { AppError, Paginated, Requester } from '../../../share';
import {
  ICrudRepository,
  ICrudService,
  PagingDTO,
} from '../interfaces/crud.interface';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';

/**
 * Lớp Service cơ sở triển khai các thao tác CRUD chung
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 */
@Injectable()
export abstract class BaseCrudService<T, C, U>
  implements ICrudService<T, C, U>
{
  protected readonly logger: Logger;

  /**
   * Constructor
   * @param entityName Tên của entity
   * @param repository Repository tương ứng
   * @param options Tùy chọn controller
   */
  constructor(
    protected readonly entityName: string,
    protected readonly repository: ICrudRepository<T, C, U>,
    protected readonly options?: CrudControllerOptions<T, C, U>,
  ) {
    this.logger = new Logger(`${entityName}Service`);
  }

  /**
   * Lấy entity theo ID
   */
  async getEntity(id: string): Promise<T> {
    const entity = await this.repository.get(id);
    if (!entity) {
      throw AppError.from(new Error(`${this.entityName} not found`), 404);
    }
    return entity;
  }

  /**
   * Tìm entity theo điều kiện
   */
  async findEntity(conditions: any): Promise<T | null> {
    return this.repository.findByCond(conditions);
  }

  /**
   * Lấy danh sách entity với phân trang
   */
  async listEntities(
    requester: Requester,
    conditions: any,
    pagination: PagingDTO,
  ): Promise<Paginated<T>> {
    try {
      // Apply default pagination values if not provided
      const paging = {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        sortBy: pagination.sortBy || 'createdAt',
        sortOrder: pagination.sortOrder || 'desc',
      };

      // Check permissions if needed
      await this.checkPermission(requester, 'read');

      // Apply hooks if available
      if (this.options?.hooks?.beforeList) {
        const hookResult = await this.options.hooks.beforeList(
          conditions,
          paging,
          requester,
        );
        conditions = hookResult.conditions;
        paging.page = hookResult.pagination.page || paging.page;
        paging.limit = hookResult.pagination.limit || paging.limit;
        paging.sortBy = hookResult.pagination.sortBy || paging.sortBy;
        paging.sortOrder = hookResult.pagination.sortOrder || paging.sortOrder;
      }

      // Get data from repository
      let result = await this.repository.list(conditions, paging);

      // Apply after hook if available
      if (this.options?.hooks?.afterList) {
        result = await this.options.hooks.afterList(result, requester);
      }

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error listing ${this.entityName}`,
        error instanceof AppError ? error.getStatusCode() : 400,
      );
      throw error; // This line is unreachable but needed for TypeScript
    }
  }

  /**
   * Tạo mới entity
   */
  async createEntity(requester: Requester, dto: C): Promise<string> {
    try {
      // Validate user permissions
      await this.validateCreate(requester, dto);

      // Apply before create hook if available
      let processedDto = dto;
      if (this.options?.hooks?.beforeCreate) {
        processedDto = await this.options.hooks.beforeCreate(dto, requester);
      }

      // Create entity in repository
      const id = await this.repository.insert(processedDto);

      // Apply after create hook if available
      if (this.options?.hooks?.afterCreate) {
        const entity = await this.repository.get(id);
        if (entity) {
          await this.options.hooks.afterCreate(entity, id, requester);
        }
      }

      // Log the event
      this.logEvent('Created', id, requester);

      return id;
    } catch (error) {
      this.handleError(
        error,
        `Error creating ${this.entityName}`,
        error instanceof AppError ? error.getStatusCode() : 400,
      );
      throw error; // This line is unreachable but needed for TypeScript
    }
  }

  /**
   * Cập nhật entity
   */
  async updateEntity(requester: Requester, id: string, dto: U): Promise<void> {
    try {
      // Get existing entity
      const entity = await this.getEntity(id);

      // Validate permissions
      await this.validateUpdate(requester, entity, dto);

      // Apply before update hook if available
      let processedDto = dto;
      if (this.options?.hooks?.beforeUpdate) {
        processedDto = await this.options.hooks.beforeUpdate(
          id,
          dto,
          requester,
        );
      }

      // Update entity
      await this.repository.update(id, processedDto as unknown as Partial<T>);

      // Apply after update hook if available
      if (this.options?.hooks?.afterUpdate) {
        const updatedEntity = await this.repository.get(id);
        if (updatedEntity) {
          await this.options.hooks.afterUpdate(updatedEntity, requester);
        }
      }

      // Log event
      this.logEvent('Updated', id, requester);
    } catch (error) {
      this.handleError(
        error,
        `Error updating ${this.entityName} ${id}`,
        error instanceof AppError ? error.getStatusCode() : 400,
      );
    }
  }

  /**
   * Xóa entity
   */
  async deleteEntity(requester: Requester, id: string): Promise<void> {
    try {
      // Get existing entity
      const entity = await this.getEntity(id);

      // Validate permissions
      await this.validateDelete(requester, entity);

      // Apply before delete hook if available
      if (this.options?.hooks?.beforeDelete) {
        const shouldProceed = await this.options.hooks.beforeDelete(
          id,
          requester,
        );
        if (!shouldProceed) {
          throw AppError.from(
            new Error(`Delete operation cancelled by hook`),
            400,
          );
        }
      }

      // Delete entity
      await this.repository.delete(id);

      // Apply after delete hook if available
      if (this.options?.hooks?.afterDelete) {
        await this.options.hooks.afterDelete(id, requester);
      }

      // Log event
      this.logEvent('Deleted', id, requester);
    } catch (error) {
      this.handleError(
        error,
        `Error deleting ${this.entityName} ${id}`,
        error instanceof AppError ? error.getStatusCode() : 400,
      );
    }
  }

  /**
   * Đếm số lượng entity
   */
  async countEntities(requester: Requester, conditions: any): Promise<number> {
    try {
      // Check permissions if needed
      await this.checkPermission(requester, 'read');

      // Get count from repository
      return await this.repository.count(conditions);
    } catch (error) {
      this.handleError(
        error,
        `Error counting ${this.entityName}`,
        error instanceof AppError ? error.getStatusCode() : 400,
      );
      throw error; // This line is unreachable but needed for TypeScript
    }
  }

  // Hook methods to be overridden by implementing services
  /**
   * Xác thực quyền tạo entity
   */
  protected async validateCreate(requester: Requester, dto: C): Promise<void> {
    // By default, check if user has permission to create
    await this.checkPermission(requester, 'create');
  }

  /**
   * Xác thực quyền cập nhật entity
   */
  protected async validateUpdate(
    requester: Requester,
    entity: T,
    dto: U,
  ): Promise<void> {
    // By default, check if user has permission to update
    await this.checkPermission(requester, 'update', (entity as any).id);
  }

  /**
   * Xác thực quyền xóa entity
   */
  protected async validateDelete(
    requester: Requester,
    entity: T,
  ): Promise<void> {
    // By default, check if user has permission to delete
    await this.checkPermission(requester, 'delete', (entity as any).id);
  }

  /**
   * Kiểm tra quyền truy cập
   */
  protected async checkPermission(
    requester: Requester,
    action: 'create' | 'read' | 'update' | 'delete',
    entityId?: string,
  ): Promise<void> {
    // Override this method to implement permission checks
    return;
  }

  /**
   * Ghi log sự kiện
   */
  protected logEvent(
    action: string,
    entityId: string,
    requester: Requester,
    details?: any,
  ): void {
    this.logger.log(
      `${action} ${this.entityName} ${entityId} by ${requester.sub}`,
      details,
    );
  }

  /**
   * Xử lý lỗi thống nhất
   */
  protected handleError(
    error: any,
    message: string,
    statusCode: number = 400,
  ): never {
    this.logger.error(`${message}: ${error.message}`, error.stack);

    if (error instanceof AppError) {
      throw error;
    }

    throw AppError.from(new Error(`${message}: ${error.message}`), statusCode);
  }
}
