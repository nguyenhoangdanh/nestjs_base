import { Type } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';
import {
  ZodObject,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodEnum,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodArray,
  ZodRecord,
  ZodDate,
  ZodTypeAny,
  ZodSchema,
  ZodEffects,
} from 'zod';

/**
 * Helper function for safely accessing properties that might not exist
 */
function safelyGet<T>(obj: any, path: string, defaultValue: T): T {
  try {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = current[part];
    }
    return current !== null && current !== undefined
      ? (current as T)
      : defaultValue;
  } catch (e) {
    console.log('Error', e);
    return defaultValue;
  }
}

/**
 * Unwrap ZodEffects to get the inner schema
 */
function unwrapZodEffects(schema: ZodSchema): ZodSchema {
  if (schema instanceof ZodEffects) {
    return unwrapZodEffects(schema.innerType());
  }
  return schema;
}

/**
 * DTO class decorator that adds Swagger properties based on a Zod schema
 * @param zodSchema The Zod schema to convert to Swagger properties
 * @param options Additional options for the generated class
 */
export function ZodToSwagger(
  zodSchema: ZodSchema,
  options: {
    description?: string;
    examples?: Record<string, any>;
  } = {},
) {
  return function (target: Type<any>) {
    // Unwrap ZodEffects to get the underlying ZodObject
    const unwrappedSchema = unwrapZodEffects(zodSchema);

    if (!(unwrappedSchema instanceof ZodObject)) {
      throw new Error(
        'Schema must be a ZodObject or a ZodEffects wrapping a ZodObject',
      );
    }

    // Extract shape from ZodObject
    const shape = unwrappedSchema._def.shape();

    // Process each property in the shape
    for (const [key, zodType] of Object.entries(shape)) {
      // Skip if property doesn't exist on target prototype
      if (
        !target.prototype.hasOwnProperty(key) &&
        !Object.getOwnPropertyDescriptor(target.prototype, key)
      ) {
        // Create the property if it doesn't exist
        Object.defineProperty(target.prototype, key, {
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      // Extract ApiProperty options
      const propertyOptions = extractApiPropertyOptions(
        zodType as ZodTypeAny,
        key,
        options.examples?.[key],
      );

      // Apply ApiProperty decorator
      ApiProperty(propertyOptions)(target.prototype, key);
    }

    return target;
  };
}

/**
 * Extract ApiProperty options from a Zod type
 */
function extractApiPropertyOptions(
  zodType: ZodTypeAny,
  propertyName: string,
  example?: any,
): ApiPropertyOptions {
  let type: any = String;
  let isArray = false;
  let required = true;
  let nullable = false;
  let enumValues: any[] | undefined;
  let defaultValue: any;
  let description = '';
  let minimum: number | undefined;
  let maximum: number | undefined;
  const format: string | undefined = undefined;

  // Unwrap the type to handle ZodOptional, ZodNullable, etc.
  let unwrappedType: ZodTypeAny = zodType;

  // Handle ZodEffects (created by .refine())
  if (unwrappedType instanceof ZodEffects) {
    unwrappedType = unwrappedType.innerType();
  }

  // Get the description if available
  description = safelyGet(zodType, '_def.description', '');

  // Handle ZodOptional
  if (unwrappedType instanceof ZodOptional) {
    required = false;
    unwrappedType = unwrappedType.unwrap();
  }

  // Handle ZodDefault
  if (unwrappedType instanceof ZodDefault) {
    try {
      if (typeof unwrappedType._def.defaultValue === 'function') {
        defaultValue = unwrappedType._def.defaultValue();
      } else {
        defaultValue = unwrappedType._def.defaultValue;
      }
      unwrappedType = safelyGet(unwrappedType, '_def.innerType', unwrappedType);
    } catch (e) {
      // Safely continue if we can't extract default value
      console.warn(`Could not extract default value for ${propertyName}`, e);
    }
  }

  // Handle ZodNullable
  if (unwrappedType instanceof ZodNullable) {
    nullable = true;
    unwrappedType = unwrappedType.unwrap();
  }

  // Determine the type based on the Zod type
  if (unwrappedType instanceof ZodString) {
    type = String;

    // Safely try to extract constraints
    try {
      const minLength = safelyGet(unwrappedType, '_def.minLength', null);
      if (minLength !== null) {
        minimum = minLength;
      }

      const maxLength = safelyGet(unwrappedType, '_def.maxLength', null);
      if (maxLength !== null) {
        maximum = maxLength;
      }
    } catch (e) {
      // Ignore errors in constraint extraction
      console.log('Error', e);
    }
  } else if (unwrappedType instanceof ZodNumber) {
    type = Number;

    // Safely try to extract constraints
    try {
      const min = safelyGet(unwrappedType, '_def.minimum', null);
      if (min !== null) {
        minimum = min;
      }

      const max = safelyGet(unwrappedType, '_def.maximum', null);
      if (max !== null) {
        maximum = max;
      }
    } catch (e) {
      // Ignore errors in constraint extraction
      console.log('Error', e);
    }
  } else if (unwrappedType instanceof ZodBoolean) {
    type = Boolean;
  } else if (unwrappedType instanceof ZodDate) {
    type = Date;
  } else if (unwrappedType instanceof ZodEnum) {
    type = String;
    enumValues = safelyGet(unwrappedType, '_def.values', []);
  } else if (unwrappedType instanceof ZodArray) {
    isArray = true;
    const elementType = safelyGet(unwrappedType, 'element', unwrappedType);
    const elementOptions = extractApiPropertyOptions(
      elementType,
      `${propertyName}Item`,
    );
    type = elementOptions.type;
  } else if (unwrappedType instanceof ZodRecord) {
    type = Object;
    // Record<string, any> is shown as an object in Swagger
  } else if (unwrappedType instanceof ZodObject) {
    type = Object;
    // Nested objects - would need a more complex handler for full detailing
  }

  // Create the ApiProperty options
  const options: ApiPropertyOptions = {
    type,
    isArray,
    required,
    nullable,
    description: description || undefined,
    default: defaultValue,
    enum: enumValues,
    example: example || undefined,
  };

  // Add constraints if they exist
  if (minimum !== undefined) {
    options.minimum = minimum;
  }
  if (maximum !== undefined) {
    options.maximum = maximum;
  }
  if (format) {
    options.format = format;
  }

  return options;
}

/**
 * Generate a class from a Zod schema
 * This is useful for creating DTO classes on-the-fly
 */
export function createDtoFromZodSchema<T extends ZodSchema>(
  zodSchema: T,
  className: string,
  options: {
    description?: string;
    examples?: Record<string, any>;
  } = {},
): Type<any> {
  // Create a new class
  const DtoClass = class {} as any;

  // Set the class name
  Object.defineProperty(DtoClass, 'name', { value: className });

  // Apply the ZodToSwagger decorator
  ZodToSwagger(zodSchema, options)(DtoClass);

  return DtoClass;
}

/**
 * Create an ApiBody decorator from a Zod schema
 */
export function ApiBodyFromZod(
  zodSchema: ZodSchema,
  options: {
    description?: string;
    required?: boolean;
    examples?: Record<string, any>;
  } = {},
) {
  // Create a temporary DTO class from the schema
  const TempDtoClass = createDtoFromZodSchema(zodSchema, 'TemporaryDTO', {
    examples: options.examples,
  });

  // Return an ApiBody decorator that uses this class
  return ApiProperty({
    type: TempDtoClass,
    description: options.description,
    required: options.required !== false,
  });
}
