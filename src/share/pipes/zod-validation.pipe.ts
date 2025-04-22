// Trong zod-validation.pipe.ts
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodType, ZodTypeDef } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodType<any, ZodTypeDef, any>) {}

  transform(value: any, metadata: ArgumentMetadata) {
    // Nếu không có schema, trả về nguyên giá trị
    if (!this.schema) {
      return value;
    }

    try {
      return this.schema.parse(value);
    } catch (error) {
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
