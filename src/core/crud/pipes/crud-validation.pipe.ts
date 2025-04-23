import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Optional,
  Logger,
  Type,
} from '@nestjs/common';
import { ZodSchema } from 'zod';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/**
 * Enhanced Pipe xác thực DTO cho các CRUD operations
 * Support for both Zod and Class-Validator validation strategies
 */
@Injectable()
export class CrudValidationPipe implements PipeTransform {
  private readonly logger = new Logger(CrudValidationPipe.name);
  private readonly createDtoSchema?: ZodSchema | Type<any>;
  private readonly updateDtoSchema?: ZodSchema | Type<any>;
  private readonly filterDtoSchema?: ZodSchema | Type<any>;
  private readonly validationOptions: {
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
    transform?: boolean;
    disableErrorMessages?: boolean;
  };

  constructor(
    @Optional()
    @Inject(CRUD_OPTIONS)
    private readonly options?: CrudControllerOptions,
    validationOptions?: {
      whitelist?: boolean;
      forbidNonWhitelisted?: boolean;
      transform?: boolean;
      disableErrorMessages?: boolean;
    },
  ) {
    // Default validation options
    this.validationOptions = {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
      ...validationOptions,
    };

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
  async transform(value: any, metadata: ArgumentMetadata) {
    // Nếu không có schema, trả về giá trị gốc
    if (
      !this.createDtoSchema &&
      !this.updateDtoSchema &&
      !this.filterDtoSchema
    ) {
      return value;
    }

    let schema: ZodSchema | Type<any> | undefined;
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
      // Determine if schema is a Zod schema or a class
      if (this.isZodSchema(schema)) {
        // Validate with Zod
        return this.validateWithZod(value, schema as ZodSchema);
      } else {
        // Validate with class-validator
        return await this.validateWithClassValidator(
          value,
          schema as Type<any>,
        );
      }
    } catch (error) {
      // Định dạng lỗi
      this.logger.error(
        `Validation error: ${JSON.stringify(error.errors || error.message)}`,
      );

      // Format errors based on the validation library used
      const formattedErrors = error.errors
        ? this.formatValidationErrors(error.errors)
        : [{ field: 'unknown', message: error.message || 'Validation error' }];

      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }
  }

  /**
   * Validate using Zod
   */
  private validateWithZod(value: any, schema: ZodSchema): any {
    return schema.parse(value);
  }

  /**
   * Validate using class-validator
   */
  private async validateWithClassValidator(
    value: any,
    metatype: Type<any>,
  ): Promise<any> {
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, this.validationOptions);

    if (errors.length > 0) {
      throw { errors };
    }

    return object;
  }

  /**
   * Type guard to check if schema is a Zod schema
   */
  private isZodSchema(schema: any): schema is ZodSchema {
    return schema && typeof schema.parse === 'function';
  }

  /**
   * Format validation errors from either Zod or class-validator
   */
  private formatValidationErrors(
    errors: any[],
  ): { field: string; message: string }[] {
    if (errors[0] instanceof ValidationError) {
      // Class-validator errors
      return this.formatClassValidatorErrors(errors);
    } else {
      // Zod errors
      return errors.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
    }
  }

  /**
   * Format class-validator errors to a consistent format
   */
  private formatClassValidatorErrors(
    errors: ValidationError[],
  ): { field: string; message: string }[] {
    const result: { field: string; message: string }[] = [];

    function formatErrors(errors: ValidationError[], parentField = '') {
      errors.forEach((error) => {
        const field = parentField
          ? `${parentField}.${error.property}`
          : error.property;

        if (error.constraints) {
          Object.values(error.constraints).forEach((message) => {
            result.push({ field, message });
          });
        }

        if (error.children && error.children.length) {
          formatErrors(error.children, field);
        }
      });
    }

    formatErrors(errors);
    return result;
  }
}

/**
 * Factory function để tạo pipe với schema cụ thể
 */
export function createValidationPipe(
  schema: ZodSchema | Type<any>,
  options?: {
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
    transform?: boolean;
    disableErrorMessages?: boolean;
  },
): PipeTransform {
  @Injectable()
  class CustomValidationPipe extends CrudValidationPipe {
    constructor() {
      super(
        {
          dtoValidation: {
            createDtoClass: schema,
            updateDtoClass: schema,
            filterDtoClass: schema,
          },
        } as any,
        options,
      );
    }
  }

  return new CustomValidationPipe();
}
