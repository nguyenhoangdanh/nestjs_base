import { UserRole } from 'src/share';
import { z } from 'zod';

export enum UserStatus {
  PENDING_ACTIVATION = 'PENDING_ACTIVATION',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
}

// business errors
export const ErrUsernameAtLeast3Chars = new Error(
  'Username phải có ít nhất 3 ký tự',
);
export const ErrUsernameAtMost25Chars = new Error(
  'Username không được quá 25 ký tự',
);
export const ErrUsernameInvalid = new Error(
  'Username không hợp lệ, chỉ chứa chữ cái, số và dấu gạch dưới (_)',
);
export const ErrPasswordAtLeast6Chars = new Error(
  'Password bắt buộc phải có ít nhất 6 ký tự',
);
export const ErrUsernameExisted = new Error('Username đã tồn tại');
export const ErrInvalidUsernameAndPassword = new Error(
  'Tên đăng nhập hoặc mật khẩu không đúng',
);
export const ErrUserInactivated = new Error('User đã bị vô hiệu hóa');
export const ErrInvalidToken = new Error('Token không hợp lệ hoặc đã hết hạn');
export const ErrInvalidCardIdAndEmployeeId = new Error(
  'CCCD hoặc mã nhân viên không đúng',
);
export const ErrExistsPassword = new Error(
  'Mật khẩu đã tồn tại, vui lòng chọn mật khẩu khác',
);
export const ErrMissingResetCredentials = new Error(
  'Vui lòng cung cấp username hoặc cả cardId và employeeId',
);
export const ErrInvalidResetToken = new Error(
  'Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
);
export const ErrPermissionDenied = new Error(
  'Bạn không có quyền thực hiện hành động này',
);
export const ErrRoleAlreadyAssigned = new Error(
  'Vai trò này đã được gán cho người dùng',
);
export const ErrEntityTypeInvalid = new Error('Loại đối tượng không hợp lệ');

// data model
export const authSchema = z.object({
  id: z.string().uuid(),
  avatar: z.string().nullable().optional(),
  fullName: z.string().min(5, 'Họ tên phải có ít nhất 5 ký tự'),
  employeeId: z.string().nonempty('Mã nhân viên không được để trống'),
  cardId: z.string().nonempty('Mã thẻ không được để trống'),
  username: z
    .string()
    .min(3, ErrUsernameAtLeast3Chars.message)
    .max(25, ErrUsernameAtMost25Chars.message)
    .regex(/^[a-zA-Z0-9_]+$/, ErrUsernameInvalid.message),
  password: z
    .string()
    .min(6, ErrPasswordAtLeast6Chars.message)
    .regex(/^\S*$/, { message: 'Mật khẩu không được chứa khoảng trắng' }),
  salt: z.string().min(8),
  roleId: z.string().uuid(),
  status: z.nativeEnum(UserStatus).optional(),
  email: z.string().email('Email không hợp lệ').nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.nativeEnum(UserRole).optional(),

  // Các trường liên kết với cấu trúc tổ chức
  factoryId: z.string().uuid().nullable().optional(),
  lineId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  positionId: z.string().uuid().nullable().optional(),

  // Thông tin xác thực
  lastLogin: z.date().nullable().optional(),
  passwordResetToken: z.string().nullable().optional(),
  passwordResetExpiry: z.date().nullable().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Auth = z.infer<typeof authSchema>;
