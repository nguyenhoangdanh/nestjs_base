import { Injectable, Logger } from '@nestjs/common';
import { AppError, Paginated } from '../../../share';
import { ICrudRepository, PagingDTO } from '../interfaces/crud.interface';

/**
 * Lớp Repository cơ sở cho Prisma, triển khai các thao tác CRUD cơ bản
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 */
@Injectable()
export abstract class BasePrismaRepository<T, C, U>
  implements ICrudRepository<T, C, U>
{
  protected readonly logger: Logger;
  protected readonly entityName: string;
  protected readonly prismaModel: any;

  /**
   * Constructor
   * @param entityName Tên của entity
   * @param prismaModel Model Prisma tương ứng
   */
  constructor(entityName: string, prismaModel: any) {
    this.entityName = entityName;
    this.prismaModel = prismaModel;
    this.logger = new Logger(`${entityName}Repository`);
  }

  /**
   * Chuyển đổi từ Prisma model sang domain model
   * Phương thức này cần được triển khai bởi các lớp con
   */
  protected abstract _toModel(data: any): T;

  /**
   * Chuyển đổi từ điều kiện tìm kiếm sang Prisma where clause
   * Phương thức này cần được triển khai bởi các lớp con
   */
  protected abstract _conditionsToWhereClause(conditions: any): any;

  /**
   * Lấy entity theo ID
   */
  async get(id: string): Promise<T | null> {
    try {
      const data = await this.prismaModel.findUnique({
        where: { id },
      });

      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error fetching ${this.entityName} ${id}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to get ${this.entityName}: ${error.message}`),
        500,
      );
    }
  }

  /**
   * Tìm entity theo điều kiện
   */
  async findByCond(conditions: any): Promise<T | null> {
    try {
      const whereClause = this._conditionsToWhereClause(conditions);
      const data = await this.prismaModel.findFirst({
        where: whereClause,
      });

      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error finding ${this.entityName} by conditions: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(
          `Failed to find ${this.entityName} by conditions: ${error.message}`,
        ),
        500,
      );
    }
  }

  /**
   * Lấy danh sách entity với phân trang
   */
  async list(conditions: any, pagination: PagingDTO): Promise<Paginated<T>> {
    try {
      // Validate pagination parameters
      const page = Math.max(1, pagination.page || 1);
      const limit = Math.min(100, Math.max(1, pagination.limit || 10));
      const sortBy = pagination.sortBy || 'createdAt';
      const sortOrder = pagination.sortOrder || 'desc';

      const whereClause = this._conditionsToWhereClause(conditions);

      // Run count and data queries in parallel for efficiency
      const [total, data] = await Promise.all([
        this.prismaModel.count({ where: whereClause }),
        this.prismaModel.findMany({
          where: whereClause,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      // Return in Paginated format
      return {
        data: data.map((item: any) => this._toModel(item)),
        paging: {
          page,
          limit,
          total,
        },
        total,
      };
    } catch (error) {
      this.logger.error(
        `Error listing ${this.entityName}s: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to list ${this.entityName}s: ${error.message}`),
        500,
      );
    }
  }

  /**
   * Tạo mới entity
   */
  async insert(entity: any): Promise<string> {
    try {
      // Prepare data for insertion
      const createData = this._prepareCreateData(entity);

      // Create in database
      const data = await this.prismaModel.create({
        data: createData,
      });

      return data.id;
    } catch (error) {
      this.logger.error(
        `Error inserting ${this.entityName}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to insert ${this.entityName}: ${error.message}`),
        500,
      );
    }
  }

  /**
   * Cập nhật entity
   */
  async update(id: string, dto: Partial<T>): Promise<void> {
    try {
      // Prepare data for update
      const updateData = this._prepareUpdateData(dto);

      // Always include updatedAt if the model has it
      if ('updatedAt' in this.prismaModel.fields) {
        updateData.updatedAt = new Date();
      }

      await this.prismaModel.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(
        `Error updating ${this.entityName} ${id}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to update ${this.entityName}: ${error.message}`),
        500,
      );
    }
  }

  /**
   * Xóa entity
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prismaModel.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(
        `Error deleting ${this.entityName} ${id}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to delete ${this.entityName}: ${error.message}`),
        500,
      );
    }
  }

  /**
   * Chuẩn bị dữ liệu cho thao tác tạo mới
   * Phương thức này có thể được override bởi các lớp con
   */
  protected _prepareCreateData(entity: any): any {
    // Add timestamps by default if the model supports them
    const data = { ...entity };

    if ('createdAt' in this.prismaModel.fields && !data.createdAt) {
      data.createdAt = new Date();
    }

    if ('updatedAt' in this.prismaModel.fields && !data.updatedAt) {
      data.updatedAt = new Date();
    }

    return data;
  }

  /**
   * Chuẩn bị dữ liệu cho thao tác cập nhật
   * Phương thức này có thể được override bởi các lớp con
   */
  protected _prepareUpdateData(dto: Partial<T>): any {
    // Filter out undefined values
    const updateData: any = {};

    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    return updateData;
  }

  /**
   * Đếm số lượng entity theo điều kiện
   */
  async count(conditions: any): Promise<number> {
    try {
      const whereClause = this._conditionsToWhereClause(conditions);
      return await this.prismaModel.count({ where: whereClause });
    } catch (error) {
      this.logger.error(
        `Error counting ${this.entityName}s: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(`Failed to count ${this.entityName}s: ${error.message}`),
        500,
      );
    }
  }

  /**
   * Thực hiện transaction
   */
  async transaction<R>(callback: (model: any) => Promise<R>): Promise<R> {
    try {
      // Sử dụng transaction của Prisma
      return await this.prismaModel.$transaction(async (tx: any) => {
        return await callback(tx);
      });
    } catch (error) {
      this.logger.error(
        `Transaction error for ${this.entityName}: ${error.message}`,
        error.stack,
      );
      throw AppError.from(
        new Error(
          `Transaction failed for ${this.entityName}: ${error.message}`,
        ),
        500,
      );
    }
  }
}
