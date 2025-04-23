import { Injectable, Logger } from '@nestjs/common';
import { AppError, Paginated, Requester, UserRole } from '../../../share';
import {
  ICrudRepository,
  ICrudService,
  PagingDTO,
  ICrudHooks,
} from '../interfaces/crud.interface';
import {
  CrudControllerOptions,
  CrudEndpointType,
} from '../interfaces/crud-options.interface';

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
  // Tạo một bản sao có thể thay đổi của options
  private _options?: CrudControllerOptions<T, C, U>;

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
    this._options = options ? { ...options } : undefined;
    this.setupDefaultHooks();
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
      if (this._options?.hooks?.beforeList) {
        const hookResult = await this._options.hooks.beforeList(
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
      if (this._options?.hooks?.afterList) {
        result = await this._options.hooks.afterList(result, requester);
      }

      return result;
    } catch (error) {
      return this.handleError(
        error,
        `Error listing ${this.entityName}`,
        error instanceof AppError ? error.getStatusCode() : 400,
      );
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
      if (this._options?.hooks?.beforeCreate) {
        processedDto = await this._options.hooks.beforeCreate(dto, requester);
      }

      // Create entity in repository
      const id = await this.repository.insert(processedDto);

      // Apply after create hook if available
      if (this._options?.hooks?.afterCreate) {
        const entity = await this.repository.get(id);
        if (entity) {
          await this._options.hooks.afterCreate(entity, id, requester);
        }
      }

      // Log the event
      this.logEvent('Created', id, requester);

      return id;
    } catch (error) {
      return this.handleError(
        error,
        `Error creating ${this.entityName}`,
        error instanceof AppError ? error.getStatusCode() : 400,
      );
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
      if (this._options?.hooks?.beforeUpdate) {
        processedDto = await this._options.hooks.beforeUpdate(
          id,
          dto,
          requester,
        );
      }

      // Update entity
      await this.repository.update(id, processedDto as unknown as Partial<T>);

      // Apply after update hook if available
      if (this._options?.hooks?.afterUpdate) {
        const updatedEntity = await this.repository.get(id);
        if (updatedEntity) {
          await this._options.hooks.afterUpdate(updatedEntity, requester);
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
      if (this._options?.hooks?.beforeDelete) {
        const shouldProceed = await this._options.hooks.beforeDelete(
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
      if (this._options?.hooks?.afterDelete) {
        await this._options.hooks.afterDelete(id, requester);
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

      // Apply before count hook if available
      if (this._options?.hooks?.beforeCount) {
        conditions = await this._options.hooks.beforeCount(
          conditions,
          requester,
        );
      }

      // Get count from repository
      let count = await this.repository.count(conditions);

      // Apply after count hook if available
      if (this._options?.hooks?.afterCount) {
        count = await this._options.hooks.afterCount(count, requester);
      }

      return count;
    } catch (error) {
      return this.handleError(
        error,
        `Error counting ${this.entityName}`,
        error instanceof AppError ? error.getStatusCode() : 400,
      );
    }
  }

  /**
   * Xác thực quyền tạo mới entity
   */
  protected async validateCreate(requester: Requester, dto: C): Promise<void> {
    // Check basic permission
    await this.checkPermission(requester, 'create');

    // Additional validation rules can be implemented here
    await this.validateBusinessRules(dto, 'create');

    // Verify no duplicate exists if the entity has unique constraints
    await this.checkDuplicates(dto);
  }

  /**
   * Xác thực quyền cập nhật entity
   * Enhanced with additional validation for update operations
   */
  protected async validateUpdate(
    requester: Requester,
    entity: T,
    dto: U,
  ): Promise<void> {
    // Check basic permission
    await this.checkPermission(requester, 'update', (entity as any).id);

    // Check if entity is locked or in a state that prevents updates
    if ((entity as any).status === 'LOCKED' || (entity as any).isArchived) {
      throw AppError.from(
        new Error(`Cannot update ${this.entityName}: It is locked or archived`),
        400,
      );
    }

    // Additional validation rules for update
    await this.validateBusinessRules(dto, 'update', entity);
  }

  /**
   * Xác thực quyền xóa entity
   * Enhanced with additional validation for delete operations
   */
  protected async validateDelete(
    requester: Requester,
    entity: T,
  ): Promise<void> {
    // Check basic permission
    await this.checkPermission(requester, 'delete', (entity as any).id);

    // Check if entity is in a state that allows deletion
    if ((entity as any).status === 'LOCKED' || (entity as any).isArchived) {
      throw AppError.from(
        new Error(`Cannot delete ${this.entityName}: It is locked or archived`),
        400,
      );
    }

    // Check for dependencies that would prevent deletion
    await this.checkDependencies(entity);
  }

  /**
   * Kiểm tra các ràng buộc nghiệp vụ (business rules)
   * Phương thức này nên được triển khai ở các lớp con
   */
  protected async validateBusinessRules(
    dto: any,
    operation: 'create' | 'update',
    existingEntity?: T,
  ): Promise<void> {
    // Default implementation to be overridden in subclasses if needed
    if (operation === 'create') {
      // Validate required fields for create
      this.validateRequiredFields(dto);
    } else if (operation === 'update') {
      // Validate update-specific rules
      if (existingEntity) {
        // Check for logical constraints between fields
        await this.validateFieldConstraints(dto, existingEntity);
      }
    }
  }

  /**
   * Kiểm tra các trường bắt buộc
   */
  protected validateRequiredFields(dto: any): void {
    // Default implementation - should be overridden in subclasses
    // Example of a basic implementation:
    const requiredFields: string[] = [];

    for (const field of requiredFields) {
      if (
        dto[field] === undefined ||
        dto[field] === null ||
        dto[field] === ''
      ) {
        throw AppError.from(
          new Error(`Field '${field}' is required for ${this.entityName}`),
          400,
        );
      }
    }
  }

  /**
   * Kiểm tra ràng buộc giữa các trường dữ liệu
   */
  protected async validateFieldConstraints(
    dto: any,
    existingEntity: T,
  ): Promise<void> {
    // Default implementation - should be overridden in subclasses
    // This could check logical constraints between fields
    // For example, if startDate must be before endDate
  }

  /**
   * Kiểm tra trùng lặp trước khi tạo entity
   * Prevents duplicate entries for entities with unique constraints
   */
  protected async checkDuplicates(dto: any): Promise<void> {
    // Define unique fields to check - should be overridden in specific services
    const uniqueFields: string[] = this.getUniqueFields();

    for (const field of uniqueFields) {
      if (dto[field]) {
        const conditions = { [field]: dto[field] };
        const existing = await this.repository.findByCond(conditions);

        if (existing) {
          throw AppError.from(
            new Error(
              `${this.entityName} with ${field} '${dto[field]}' already exists`,
            ),
            400,
          );
        }
      }
    }
  }

  /**
   * Lấy danh sách các trường unique
   * Phương thức này nên được override trong lớp con
   */
  protected getUniqueFields(): string[] {
    // Default implementation returns empty array
    // Should be overridden in subclasses
    return [];
  }

  /**
   * Kiểm tra các phụ thuộc trước khi xóa entity
   * Prevents deletion of entities that have dependent records
   */
  protected async checkDependencies(entity: T): Promise<void> {
    // This method should be overridden in specific service implementations
    // Default implementation checks for common dependencies
    await this.checkRelatedEntities(entity);
  }

  /**
   * Kiểm tra các entity có liên quan
   * Phương thức này nên được override trong lớp con
   */
  protected async checkRelatedEntities(entity: T): Promise<void> {
    // Default implementation - should be overridden in subclasses
    // For example, check if there are related records that would be orphaned
  }

  /**
   * Kiểm tra quyền truy cập
   * This enhanced implementation provides actual permission checking based on entity ownership and user role
   */
  protected async checkPermission(
    requester: Requester,
    action: 'create' | 'read' | 'update' | 'delete',
    entityId?: string,
  ): Promise<void> {
    const role = requester.role ?? UserRole.USER; // Fallback to USER role if undefined

    // Always allow super admin or admin
    if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
      return;
    }

    // If there's a role-based permission check through the CRUD options
    if (this._options?.endpoints) {
      const endpoint = this.mapActionToEndpoint(action);
      const endpointConfig = this._options.endpoints[endpoint];

      if (endpointConfig?.roles && !endpointConfig.roles.includes(role)) {
        throw AppError.from(
          new Error(
            `Permission denied: User role '${role}' not allowed to ${action} ${this.entityName}`,
          ),
          403,
        );
      }
    }

    // For update/delete operations, check entity ownership if applicable
    if (entityId && (action === 'update' || action === 'delete')) {
      const entity = await this.repository.get(entityId);

      if (!entity) {
        throw AppError.from(new Error(`${this.entityName} not found`), 404);
      }

      // Check ownership - assuming entity has createdBy or ownerId field
      if (this.hasOwnership && !this.isEntityOwner(entity, requester)) {
        throw AppError.from(
          new Error(
            `Permission denied: User does not own this ${this.entityName}`,
          ),
          403,
        );
      }
    }
  }

  /**
   * Kiểm tra xem người dùng có phải là chủ sở hữu của entity không
   */
  protected isEntityOwner(entity: T, requester: Requester): boolean {
    // Default implementation checks common ownership fields
    // Override in subclasses for custom ownership logic
    return (
      ('createdBy' in (entity as any) &&
        (entity as any).createdBy === requester.sub) ||
      ('ownerId' in (entity as any) &&
        (entity as any).ownerId === requester.sub) ||
      ('userId' in (entity as any) && (entity as any).userId === requester.sub)
    );
  }

  /**
   * Maps CRUD actions to endpoint types for permission checking
   */
  private mapActionToEndpoint(
    action: 'create' | 'read' | 'update' | 'delete',
  ): CrudEndpointType {
    switch (action) {
      case 'create':
        return 'create';
      case 'read':
        return 'getAll'; // Note: This is a simplification, could be 'getOne' in some contexts
      case 'update':
        return 'update';
      case 'delete':
        return 'delete';
      default:
        return 'getAll';
    }
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
   * Xử lý lỗi thống nhất với context nâng cao
   * Enhanced with better error categorization and more context
   */
  protected handleError(
    error: any,
    message: string,
    statusCode: number = 400,
    context?: Record<string, any>,
  ): never {
    // Add operation context and entity info to log
    const contextInfo = context ? ` [Context: ${JSON.stringify(context)}]` : '';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(`${message}: ${errorMessage}${contextInfo}`, errorStack);

    // Categorize errors for better client response
    if (error instanceof AppError) {
      throw error;
    }

    // Map common error types to appropriate status codes
    if (error.code === 'P2025' || error.name === 'NotFoundError') {
      // Prisma not found error
      throw AppError.from(
        new Error(`${this.entityName} not found: ${errorMessage}`),
        404,
      );
    }

    if (error.code === 'P2002' || error.code === 'P2003') {
      // Prisma unique constraint or foreign key error
      throw AppError.from(
        new Error(`Database constraint violation: ${errorMessage}`),
        409, // Conflict
      );
    }

    if (error.code === 'P2023') {
      // Prisma invalid input error
      throw AppError.from(
        new Error(`Invalid input data: ${errorMessage}`),
        400,
      );
    }

    // For validation errors
    if (error.name === 'ValidationError' || error.name === 'ZodError') {
      throw AppError.from(new Error(`Validation error: ${errorMessage}`), 400);
    }

    // Generic error with the original message
    throw AppError.from(new Error(`${message}: ${errorMessage}`), statusCode);
  }

  /**
   * Generate structured error response for API
   * Utility method to create consistent error responses
   */
  protected createErrorResponse(
    error: Error | string,
    statusCode: number = 400,
    errorCode?: string,
  ): {
    success: false;
    error: {
      message: string;
      code?: string;
      status: number;
    };
  } {
    const message = typeof error === 'string' ? error : error.message;

    return {
      success: false,
      error: {
        message,
        code: errorCode,
        status: statusCode,
      },
    };
  }

  /**
   * Default hooks implementation
   * These methods can be overridden in specific services
   */
  protected setupDefaultHooks(): void {
    // Initialize default hooks if options is not provided
    if (!this._options) {
      this._options = {
        entityName: this.entityName,
        hooks: {},
      };
    } else if (!this._options.hooks) {
      this._options.hooks = {};
    }

    // Set up default implementations where hooks are not provided
    const hooks = this._options.hooks!;

    // Default beforeCreate hook - adds audit fields
    if (!hooks.beforeCreate) {
      hooks.beforeCreate = async (dto: C, requester: Requester) => {
        const dtoWithAudit = { ...dto } as any;

        // Add audit fields if they exist in the schema
        if (!('createdBy' in dtoWithAudit)) {
          dtoWithAudit.createdBy = requester.sub;
        }

        if (!('createdAt' in dtoWithAudit)) {
          dtoWithAudit.createdAt = new Date();
        }

        return dtoWithAudit as C;
      };
    }

    // Default beforeUpdate hook - adds audit fields
    if (!hooks.beforeUpdate) {
      hooks.beforeUpdate = async (id: string, dto: U, requester: Requester) => {
        const dtoWithAudit = { ...dto } as any;

        // Add audit fields if they exist in the schema
        if (!('updatedBy' in dtoWithAudit)) {
          dtoWithAudit.updatedBy = requester.sub;
        }

        if (!('updatedAt' in dtoWithAudit)) {
          dtoWithAudit.updatedAt = new Date();
        }

        return dtoWithAudit as U;
      };
    }

    // Default beforeList hook - normalize pagination and filter sensitive data
    if (!hooks.beforeList) {
      hooks.beforeList = async (
        conditions: any,
        pagination: PagingDTO,
        requester: Requester,
      ) => {
        // Normalize pagination parameters
        const normalizedPagination = {
          page: Math.max(1, pagination.page || 1),
          limit: Math.min(100, Math.max(1, pagination.limit || 10)),
          sortBy: pagination.sortBy || 'createdAt',
          sortOrder: pagination.sortOrder || 'desc',
        };

        // Filter conditions based on user role
        let filteredConditions = { ...conditions };

        // If not admin or super admin, restrict access to own data if applicable
        const role = requester.role ?? UserRole.USER;
        if (
          role !== UserRole.ADMIN &&
          role !== UserRole.SUPER_ADMIN &&
          this.hasOwnership
        ) {
          filteredConditions = {
            ...filteredConditions,
            createdBy: requester.sub,
          };
        }

        return {
          conditions: filteredConditions,
          pagination: normalizedPagination,
        };
      };
    }

    // Default afterList hook - filter sensitive fields
    if (!hooks.afterList) {
      hooks.afterList = async (result: Paginated<T>, requester: Requester) => {
        // Filter sensitive fields based on user role
        const role = requester.role ?? UserRole.USER;
        if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
          result.data = result.data.map((item) =>
            this.filterSensitiveFields(item),
          );
        }

        return result;
      };
    }

    // Default beforeDelete hook - check permissions
    if (!hooks.beforeDelete) {
      hooks.beforeDelete = async (id: string, requester: Requester) => {
        // Get the entity
        const entity = await this.repository.get(id);
        if (!entity) {
          throw AppError.from(new Error(`${this.entityName} not found`), 404);
        }

        // Check if user has permission to delete
        await this.validateDelete(requester, entity);

        // Check if entity is in a state that allows deletion
        if ((entity as any).status === 'ARCHIVED') {
          throw AppError.from(
            new Error(`Cannot delete archived ${this.entityName}`),
            400,
          );
        }

        return true; // Allow deletion to proceed
      };
    }

    // Default beforeCount hook
    if (!hooks.beforeCount) {
      hooks.beforeCount = async (conditions: any, requester: Requester) => {
        // Filter conditions based on user role
        let filteredConditions = { ...conditions };

        // If not admin or super admin, restrict access to own data if applicable
        const role = requester.role ?? UserRole.USER;
        if (
          role !== UserRole.ADMIN &&
          role !== UserRole.SUPER_ADMIN &&
          this.hasOwnership
        ) {
          filteredConditions = {
            ...filteredConditions,
            createdBy: requester.sub,
          };
        }

        return filteredConditions;
      };
    }

    // Default afterCount hook
    if (!hooks.afterCount) {
      hooks.afterCount = async (count: number, requester: Requester) => {
        // Default implementation just returns the count
        return count;
      };
    }
  }

  /**
   * Helper method to determine if entity has ownership concept
   */
  protected get hasOwnership(): boolean {
    // Override in specific services if entity has ownership
    return false;
  }

  /**
   * Filter out sensitive fields from entity data
   * Should be overridden in specific services
   */
  protected filterSensitiveFields(entity: T): T {
    // Default implementation returns the entity as is
    // Override in specific services to filter sensitive fields
    const sensitiveFields = this.getSensitiveFields();
    if (sensitiveFields.length === 0) {
      return entity;
    }

    // Create a shallow copy to avoid modifying the original
    const filteredEntity = { ...entity } as any;

    // Remove sensitive fields
    for (const field of sensitiveFields) {
      if (field in filteredEntity) {
        delete filteredEntity[field];
      }
    }

    return filteredEntity as T;
  }

  /**
   * Get list of sensitive fields that should be filtered out
   * Override in subclasses to specify sensitive fields
   */
  protected getSensitiveFields(): string[] {
    // Default sensitive fields - override in subclasses
    return [];
  }

  /**
   * Apply hooks for custom operations
   * Utility method to apply hooks in custom operations
   */
  protected async applyHook<HookType extends (...args: any[]) => any>(
    hookName: keyof ICrudHooks<T, C, U>,
    defaultValue: ReturnType<HookType>,
    ...args: Parameters<HookType>
  ): Promise<ReturnType<HookType>> {
    try {
      const hook = this._options?.hooks?.[hookName] as HookType;

      if (typeof hook === 'function') {
        return await hook(...args);
      }

      return defaultValue;
    } catch (error) {
      this.logger.error(
        `Error in ${hookName} hook: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Hook error in ${hookName}: ${error.message}`),
        500,
      );
    }
  }
}
