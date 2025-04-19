import { Requester, TokenPayload, UserRole } from 'src/share';
import {
  ChangePasswordDTO,
  PaginationDTO,
  RequestPasswordResetDTO,
  UserCondDTO,
  UserLoginDTO,
  UserRegistrationDTO,
  UserResetPasswordDTO,
  UserRoleAssignmentDTO,
  UserUpdateDTO,
} from './user.dto';
import { User } from './user.model';

// Thêm interface này nếu chưa có
export interface ITokenIntrospect {
  introspect(
    token: string,
  ): Promise<{ payload: TokenPayload; error?: Error; isOk: boolean }>;
}

export interface ITokenService {
  generateToken(payload: TokenPayload, expiresIn?: string): Promise<string>;
  generateResetToken(): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload | null>;
  decodeToken(token: string): TokenPayload | null;
  getExpirationTime(token: string): number; // Số giây còn lại trước khi token hết hạn
  isTokenBlacklisted(token: string): Promise<boolean>;
  blacklistToken(token: string, expiresIn: number): Promise<void>;
}

// Interface cho user service
export interface IUserService {
  // Authentication
  register(dto: UserRegistrationDTO): Promise<string>;
  login(dto: UserLoginDTO): Promise<{
    token: string;
    expiresIn: number;
    requiredResetPassword: boolean;
  }>;
  logout(token: string): Promise<void>;
  introspectToken(token: string): Promise<TokenPayload>;
  refreshToken(token: string): Promise<{ token: string; expiresIn: number }>;

  // Profile management
  profile(userId: string): Promise<Omit<User, 'password' | 'salt'>>;
  update(
    requester: Requester,
    userId: string,
    dto: UserUpdateDTO,
  ): Promise<void>;
  delete(requester: Requester, userId: string): Promise<void>;

  // Password management
  changePassword(userId: string, dto: ChangePasswordDTO): Promise<void>;
  requestPasswordReset(
    dto: RequestPasswordResetDTO,
  ): Promise<{ resetToken: string; expiryDate: Date; username: string }>;
  resetPassword(dto: UserResetPasswordDTO): Promise<void>;

  // Role management
  assignRole(
    requester: Requester,
    userId: string,
    dto: UserRoleAssignmentDTO,
  ): Promise<void>;
  removeRole(
    requester: Requester,
    userId: string,
    roleId: string,
    scope?: string,
  ): Promise<void>;
  getUserRoles(
    userId: string,
  ): Promise<
    { roleId: string; role: UserRole; scope?: string; expiryDate?: Date }[]
  >;
  // Access control
  canAccessEntity(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<boolean>;

  // User management
  listUsers(
    requester: Requester,
    conditions: UserCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: Array<Omit<User, 'password' | 'salt'>>;
    total: number;
    page: number;
    limit: number;
  }>;
}

// Interface cho user repository
export interface IUserRepository {
  // Query
  get(id: string): Promise<User | null>;
  findByCond(cond: UserCondDTO): Promise<User | null>;
  findByCardId(cardId: string, employeeId: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByResetToken(token: string): Promise<User | null>;
  listByIds(ids: string[]): Promise<User[]>;
  list(
    conditions: UserCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: User[];
    total: number;
  }>;

  // Command
  insert(user: User): Promise<void>;
  update(id: string, dto: Partial<User>): Promise<void>;
  delete(id: string, isHard: boolean): Promise<void>;
  invalidateToken(token: string): Promise<void>; // Để thêm token đã hết hạn vào blacklist

  // Role management
  assignRole(
    userId: string,
    roleId: string,
    scope?: string,
    expiryDate?: Date,
  ): Promise<void>;

  removeRole(userId: string, roleId: string, scope?: string): Promise<void>;

  getUserRoles(
    userId: string,
  ): Promise<
    { roleId: string; role: UserRole; scope?: string; expiryDate?: Date }[]
  >;

  // Entity access
  isFactoryManager(userId: string, factoryId: string): Promise<boolean>;
  isLineManager(userId: string, lineId: string): Promise<boolean>;
  isTeamLeader(userId: string, teamId: string): Promise<boolean>;
  isGroupLeader(userId: string, groupId: string): Promise<boolean>;

  // Hierarchical access check
  getManagerialAccess(userId: string): Promise<{
    factories: string[];
    lines: string[];
    teams: string[];
    groups: string[];
  }>;
}
