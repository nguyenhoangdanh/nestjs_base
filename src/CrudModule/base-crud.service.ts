import { Injectable, Logger } from '@nestjs/common';
import { AppError, Paginated, Requester } from 'src/share';
import { ICrudRepository, ICrudService, PagingDTO } from './crud.interface';

/**
 * Base service class implementing common CRUD operations
 */
@Injectable()
export abstract class BaseCrudService<T, C, U>
  implements ICrudService<T, C, U>
{
  protected readonly logger: Logger;

  constructor(
    protected readonly entityName: string,
    protected readonly repository: ICrudRepository<T, C, U>,
  ) {
    this.logger = new Logger(`${entityName}Service`);
  }

  async getEntity(id: string): Promise<T> {
    const entity = await this.repository.get(id);
    if (!entity) {
      throw AppError.from(new Error('Entity not found'), 404);
    }
    return entity;
  }

  async findEntity(conditions: any): Promise<T | null> {
    return this.repository.findByCond(conditions);
  }

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
        sort: pagination.sort || 'createdAt',
        order: pagination.order || 'desc',
      };

      // Validate user permissions if needed
      await this.checkPermission(requester, 'read');

      // Get data from repository
      const result = await this.repository.list(conditions, paging);
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

  async createEntity(requester: Requester, dto: C): Promise<string> {
    try {
      // Validate user permissions
      await this.validateCreate(requester, dto);

      // Custom validation can be added in subclasses

      // Create entity in repository
      const id = await this.repository.insert(dto);

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

  async updateEntity(requester: Requester, id: string, dto: U): Promise<void> {
    try {
      // Get existing entity
      const entity = await this.getEntity(id);

      // Validate permissions
      await this.validateUpdate(requester, entity, dto);

      // Update entity
      await this.repository.update(id, dto as unknown as Partial<T>);

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

  async deleteEntity(requester: Requester, id: string): Promise<void> {
    try {
      // Get existing entity
      const entity = await this.getEntity(id);

      // Validate permissions
      await this.validateDelete(requester, entity);

      // Delete entity
      await this.repository.delete(id);

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

  // Hook methods to be overridden by implementing services
  protected async validateCreate(requester: Requester, dto: C): Promise<void> {
    // By default, check if user has permission to create
    await this.checkPermission(requester, 'create');
  }

  protected async validateUpdate(
    requester: Requester,
    entity: T,
    dto: U,
  ): Promise<void> {
    // By default, check if user has permission to update
    await this.checkPermission(requester, 'update', (entity as any).id);
  }

  protected async validateDelete(
    requester: Requester,
    entity: T,
  ): Promise<void> {
    // By default, check if user has permission to delete
    await this.checkPermission(requester, 'delete', (entity as any).id);
  }

  protected async checkPermission(
    requester: Requester,
    action: 'create' | 'read' | 'update' | 'delete',
    entityId?: string,
  ): Promise<void> {
    // Override this method to implement permission checks
    return;
  }

  /**
   * Make an event log entry
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
   * Handle errors uniformly
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
