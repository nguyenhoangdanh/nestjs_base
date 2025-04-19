// src/utils/uuid-utils.ts

/**
 * Kiểm tra xem một chuỗi có phải là UUID hợp lệ hay không
 * @param uuid Chuỗi cần kiểm tra
 * @returns true nếu là UUID hợp lệ, false nếu không
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid) return false;

  // UUID regex format: 8-4-4-4-12 hexadecimal digits
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Kiểm tra xem một giá trị bất kỳ có phải là UUID hợp lệ hay không
 * Trả về null nếu không hợp lệ
 * @param input Giá trị đầu vào
 * @returns UUID hợp lệ hoặc null
 */
export function validateUUID(input: any): string | null {
  if (!input || typeof input !== 'string') return null;
  return isValidUUID(input) ? input : null;
}
