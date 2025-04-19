import { Requester, UserRole } from 'src/share';
import {
  ChangePasswordDTO,
  PaginationDTO,
  UserCondDTO,
  UserRoleAssignmentDTO,
  UserUpdateDTO,
} from './user.dto';
import { User } from './user.model';

export interface IUserService {
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
  ): Promise<{ roleId: string; role: UserRole; scope?: string; expiryDate?: Date }[]>;
  
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
  ): Promise<{ roleId: string; role: UserRole; scope?: string; expiryDate?: Date }[]>;

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

  // Methods needed for auth moved to Repository 
  // to avoid circular dependencies
  updateLastLogin(userId: string): Promise<void>;
  setResetToken(userId: string, token: string, expiry: Date): Promise<void>;
  changePassword(userId: string, hashedPassword: string, salt: string): Promise<void>;
}