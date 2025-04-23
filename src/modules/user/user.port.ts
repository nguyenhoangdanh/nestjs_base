import {
  PaginationDto,
  UserFilterDto,
  CreateUserDto,
  UpdateUserDto,
} from './user.dto';
import { User } from './user.model';
import { Paginated, Requester, UserRole } from '../../share';

export interface IUserRepository {
  // Query methods
  get(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByResetToken(token: string): Promise<User | null>;
  findByVerifyCode(code: string): Promise<User | null>;
  list(
    filter: UserFilterDto,
    pagination: PaginationDto,
  ): Promise<Paginated<User>>;

  // Command methods
  insert(user: User): Promise<string>;
  update(id: string, data: Partial<User>): Promise<void>;
  delete(id: string, hardDelete?: boolean): Promise<void>;

  // Auth related methods
  setResetToken(userId: string, token: string, expiry: Date): Promise<void>;
  setVerifyCode(userId: string, code: string, expiry: Date): Promise<void>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;
  verify(userId: string): Promise<void>;
  updateLastLogin(userId: string): Promise<void>;

  // 2FA methods
  set2FASecret(userId: string, secret: string): Promise<void>;
  set2FABackupCodes(userId: string, codes: string[]): Promise<void>;
  enable2FA(userId: string, enabled: boolean): Promise<void>;

  // Role methods
  getUserRoles(userId: string): Promise<{ roleId: string; role: UserRole }[]>;
}

export interface IUserService {
  // Basic CRUD
  createUser(dto: CreateUserDto): Promise<string>;
  getUser(id: string): Promise<User>;
  updateUser(
    requester: Requester,
    id: string,
    dto: UpdateUserDto,
  ): Promise<void>;
  deleteUser(
    requester: Requester,
    id: string,
    hardDelete?: boolean,
  ): Promise<void>;
  listUsers(
    requester: Requester,
    filter: UserFilterDto,
    pagination: PaginationDto,
  ): Promise<Paginated<User>>;

  // User profile
  getUserProfile(userId: string): Promise<User>;

  // Email verification
  generateVerifyCode(userId: string): Promise<string>;
  verifyEmail(code: string): Promise<boolean>;

  // Password management
  updatePassword(userId: string, newPassword: string): Promise<void>;

  // 2FA
  setup2FA(userId: string): Promise<{ secret: string; qrCodeUrl: string }>;
  verify2FA(userId: string, token: string): Promise<boolean>;
  enable2FA(userId: string, enabled: boolean): Promise<void>;
  generate2FABackupCodes(userId: string): Promise<string[]>;

  // Roles
  getUserRoles(userId: string): Promise<{ roleId: string; role: UserRole }[]>;

  // Access control
  canAccessResource(
    userId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<boolean>;
}
