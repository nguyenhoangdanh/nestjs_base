import { z } from 'zod';

/**
 * Schema Zod cho UUID
 * Sử dụng để validate dữ liệu ID
 */
export const uuidSchema = z.string().uuid('ID phải là UUID hợp lệ');

/**
 * Schema Zod cho mảng UUID
 * Sử dụng để validate danh sách ID
 */
export const uuidArraySchema = z
  .array(uuidSchema)
  .nonempty('Danh sách ID không được rỗng');

/**
 * Tạo schema cho tham số trong URL
 * @param paramName Tên tham số
 * @returns Zod schema
 */
export const createParamSchema = (paramName: string) => {
  return z.object({
    [paramName]: uuidSchema,
  });
};
