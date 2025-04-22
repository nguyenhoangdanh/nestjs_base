import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { ZodSchema } from 'zod';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';

/**
 * Pipe xác thực DTO cho các CRUD operations
 */
@Injectable()
export class CrudValidationPipe implements PipeTransform {
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

    // Xác định schema dựa trên loại parameter
    if (metadata.type === 'body') {
      // Kiểm tra path để xác định là create hay update
      const path = metadata.data;
      const isUpdateOperation =
        path?.includes('update') ||
        path?.includes('patch') ||
        path?.toLowerCase().includes('edit');

      schema = isUpdateOperation ? this.updateDtoSchema : this.createDtoSchema;
    } else if (metadata.type === 'query') {
      schema = this.filterDtoSchema;
    }

    // Nếu không có schema phù hợp, trả về giá trị gốc
    if (!schema) {
      return value;
    }

    try {
      // Validate dữ liệu với schema
      return schema.parse(value);
    } catch (error) {
      // Định dạng lỗi
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
    transform(value: any, metadata: ArgumentMetadata) {
      try {
        return schema.parse(value);
      } catch (error) {
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
