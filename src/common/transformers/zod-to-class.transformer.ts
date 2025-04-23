// src/common/transformers/zod-to-class.transformer.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  ZodSchema,
  ZodType,
  ZodObject,
  ZodRawShape,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodDate,
  ZodArray,
  ZodEnum,
  ZodOptional,
  ZodNullable,
  ZodDefault,
} from 'zod';

/**
 * Generates a class with ApiProperty decorators from a Zod schema
 * @param schema The Zod schema to convert
 * @param className Name for the generated class
 * @returns A class with properties and decorators based on the schema
 */
export function generateClassFromZodSchema(
  schema: ZodSchema<any>,
  className: string,
): any {
  // Kiểm tra xem schema có phải là ZodObject không
  if (!(schema instanceof ZodObject)) {
    throw new Error('Schema must be a ZodObject');
  }

  const zodObj = schema as ZodObject<ZodRawShape>;
  // Sử dụng phương thức an toàn để lấy shape
  const shape = zodObj.shape;

  // Tạo class mới
  const DynamicClass = class {
    constructor(data: any = {}) {
      Object.assign(this, data);
    }
  };

  // Đặt tên cho class
  Object.defineProperty(DynamicClass, 'name', { value: className });

  // Xử lý từng property trong shape
  for (const [key, zodType] of Object.entries(shape)) {
    // Xử lý thuộc tính
    const propertyOptions = extractApiPropertyOptions(zodType as ZodType);

    // Đặt decorator ApiProperty
    ApiProperty(propertyOptions)(DynamicClass.prototype, key);

    // Định nghĩa property trên prototype
    Object.defineProperty(DynamicClass.prototype, key, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: undefined,
    });
  }

  return DynamicClass;
}

/**
 * Trích xuất các tùy chọn ApiProperty từ kiểu Zod
 */
function extractApiPropertyOptions(zodType: ZodType): any {
  let currentType = zodType;
  let type: any = Object;
  let isArray = false;
  let required = true;
  let nullable = false;
  let description = '';
  let example: any;
  let defaultValue: any;
  let enumValues: any[] | undefined;

  // Kiểm tra đúng kiểu của ZodType bằng instanceof
  if (currentType instanceof ZodOptional) {
    required = false;
    // Truy cập unwrap() để lấy kiểu bên trong
    currentType = currentType.unwrap();
  }

  // Xử lý ZodNullable
  if (currentType instanceof ZodNullable) {
    nullable = true;
    // Truy cập unwrap() để lấy kiểu bên trong
    currentType = currentType.unwrap();
  }

  // Xử lý ZodDefault - lưu ý là instance check và gọi defaultValue() có thể khác nhau giữa các phiên bản Zod
  if (currentType instanceof ZodDefault) {
    // Sử dụng typeof guard để truy cập an toàn
    if (typeof currentType.removeDefault === 'function') {
      defaultValue = currentType._def?.defaultValue?.();
      currentType = currentType.removeDefault();
    }
  }

  // Xác định kiểu cơ bản - sử dụng instanceof thay vì truy cập typeName
  if (currentType instanceof ZodString) {
    type = String;
    example = 'Example string';

    // Lấy mô tả nếu có
    description = currentType._def?.description || '';
  } else if (currentType instanceof ZodNumber) {
    type = Number;
    example = 0;
  } else if (currentType instanceof ZodBoolean) {
    type = Boolean;
    example = false;
  } else if (currentType instanceof ZodDate) {
    type = Date;
    example = new Date().toISOString();
  } else if (currentType instanceof ZodArray) {
    isArray = true;
    // Lấy kiểu của các phần tử mảng
    const elementType = currentType.element;
    type = getTypeFromZodType(elementType);
  } else if (currentType instanceof ZodEnum) {
    type = String;
    enumValues = currentType._def?.values || [];
  } else if (currentType instanceof ZodObject) {
    type = Object;
  }

  // Trích xuất mô tả nếu có
  description = description || currentType._def?.description || '';

  return {
    type,
    isArray,
    required,
    nullable,
    description,
    example,
    default: defaultValue,
    enum: enumValues,
  };
}

/**
 * Xác định kiểu JavaScript từ kiểu Zod
 */
function getTypeFromZodType(zodType: ZodType): any {
  if (zodType instanceof ZodString) return String;
  if (zodType instanceof ZodNumber) return Number;
  if (zodType instanceof ZodBoolean) return Boolean;
  if (zodType instanceof ZodDate) return Date;
  if (zodType instanceof ZodEnum) return String;
  if (zodType instanceof ZodOptional)
    return getTypeFromZodType(zodType.unwrap());
  if (zodType instanceof ZodNullable)
    return getTypeFromZodType(zodType.unwrap());

  if (zodType instanceof ZodDefault) {
    if (typeof zodType.removeDefault === 'function') {
      return getTypeFromZodType(zodType.removeDefault());
    }
  }

  return Object;
}
