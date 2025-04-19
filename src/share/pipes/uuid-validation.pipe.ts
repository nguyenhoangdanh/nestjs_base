import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class UuidZodValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): string {
    // Skip validation for certain routes or parameters
    if (metadata.type === 'query' || metadata.type === 'param') {
      // If the parameter is optional or not explicitly a UUID parameter, skip validation
      if (!value || this.shouldSkipValidation(metadata)) {
        return value;
      }
    }

    // Create a Zod UUID schema
    const uuidSchema = z.string().uuid({ message: 'UUID không hợp lệ' });

    try {
      // Attempt to parse the UUID
      return uuidSchema.parse(value);
    } catch (error) {
      // If validation fails, throw a BadRequestException with a clear message
      if (error instanceof z.ZodError) {
        throw new BadRequestException(
          `UUID không hợp lệ: ${value}. ID phải là UUID hợp lệ`,
        );
      }

      // Rethrow any other unexpected errors
      throw new BadRequestException('Đã xảy ra lỗi khi xác thực UUID');
    }
  }

  // Helper method to determine if validation should be skipped
  private shouldSkipValidation(metadata: ArgumentMetadata): boolean {
    // Add more conditions as needed
    const skipRoutes = [
      'client-access', // Skip validation for client-access route
    ];

    // Check if the current route or parameter should skip UUID validation
    return skipRoutes.includes(metadata.data as string);
  }
}
