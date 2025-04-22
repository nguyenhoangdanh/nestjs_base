import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { ZodSchema } from 'zod';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';

/**
 * Pipe xác thực DTO cho các CRUD operations
 */
@Injectable()
export class CrudValidationPipe implements PipeTransform {
  private readonly logger = new Logger(CrudValidationPipe.name);
  private readonly createDtoSchema?: ZodSchema;
  private readonly updateDtoSchema?: ZodSchema;
  private readonly filterDtoSchema?: ZodSchema;

  constructor(
    @Optional()
    @Inject(CRUD_OPTIONS)
    private readonly options?: CrudControllerOptions,
  ) {
    // Lấy schema từ cấu hình
    if (options?.dtoValidation) {
      this.createDtoSchema = options.dtoValidation.createDtoClass;
      this.updateDtoSchema = options.dtoValidation.updateDtoClass;
      this.filterDtoSchema = options.dtoValidation.filterDtoClass;

      this.logger.log(
        `CrudValidationPipe initialized for entity: ${options.entityName}`,
      );
    } else {
      this.logger.warn(
        'CrudValidationPipe initialized without DTO validation options',
      );
    }
  }

  /**
   * Transform và validate dữ liệu
   */
  transform(value: any, metadata: ArgumentMetadata) {
    // Nếu không có schema, trả về giá trị gốc
    if (
      !this.createDtoSchema &&
      !this.updateDtoSchema &&
      !this.filterDtoSchema
    ) {
      return value;
    }

    let schema: ZodSchema | undefined;
    const methodName = metadata.metatype?.name;

    // Xác định schema dựa trên loại parameter và context
    if (metadata.type === 'body') {
      const requestUrl = metadata.data;

      // Kiểm tra path và method để xác định là create hay update
      const isUpdateOperation =
        requestUrl?.includes('update') ||
        requestUrl?.includes('patch') ||
        requestUrl?.toLowerCase()?.includes('edit') ||
        methodName?.includes('update') ||
        methodName?.includes('patch');

      schema = isUpdateOperation ? this.updateDtoSchema : this.createDtoSchema;

      if (schema) {
        this.logger.debug(
          `Using ${isUpdateOperation ? 'update' : 'create'} schema for validation`,
        );
      } else {
        this.logger.warn(
          `No ${isUpdateOperation ? 'update' : 'create'} schema found for validation`,
        );
      }
    } else if (metadata.type === 'query') {
      schema = this.filterDtoSchema;

      if (schema) {
        this.logger.debug('Using filter schema for validation');
      } else {
        this.logger.warn('No filter schema found for validation');
      }
    }

    // Nếu không có schema phù hợp, trả về giá trị gốc
    if (!schema) {
      return value;
    }

    try {
      // Validate dữ liệu với schema
      const result = schema.parse(value);
      return result;
    } catch (error) {
      // Định dạng lỗi
      this.logger.error(
        `Validation error: ${JSON.stringify(error.errors || error.message)}`,
      );
      const formattedErrors = this.formatZodErrors(error);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }
  }

  /**
   * Format lỗi từ Zod sang dạng dễ đọc
   */
  private formatZodErrors(error: any): { field: string; message: string }[] {
    if (!error.errors) {
      return [
        { field: 'unknown', message: error.message || 'Validation error' },
      ];
    }

    return error.errors.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
  }
}

/**
 * Factory function để tạo pipe với schema cụ thể
 */
export function createValidationPipe(schema: ZodSchema): PipeTransform {
  @Injectable()
  class CustomValidationPipe implements PipeTransform {
    private readonly logger = new Logger(CustomValidationPipe.name);

    transform(value: any, metadata: ArgumentMetadata) {
      try {
        return schema.parse(value);
      } catch (error) {
        this.logger.error(
          `Validation error: ${JSON.stringify(error.errors || error.message)}`,
        );
        // Format lỗi
        const formattedErrors = error.errors?.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })) || [
          { field: 'unknown', message: error.message || 'Validation error' },
        ];

        throw new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      }
    }
  }

  return new CustomValidationPipe();
}
