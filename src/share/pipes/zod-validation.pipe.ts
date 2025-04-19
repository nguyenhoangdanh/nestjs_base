import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      const result = this.schema.parse(value);
      return result;
    } catch (error) {
      const formattedError = this.formatError(error);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedError,
      });
    }
  }

  private formatError(error: any) {
    if (error.errors) {
      return error.errors.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
    }
    return [{ message: error.message }];
  }
}
