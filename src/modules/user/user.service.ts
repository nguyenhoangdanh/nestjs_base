import { Inject, Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcrypt';
import {
  AppError,
  ErrNotFound,
  Requester,
  TokenPayload,
  UserRole,
} from 'src/share';
import { v4 } from 'uuid';
import { TOKEN_SERVICE, USER_REPOSITORY } from './user.di-token';
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
import {
  ErrExistsPassword,
  ErrInvalidResetToken,
  ErrInvalidToken,
  ErrInvalidUsernameAndPassword,
  ErrMissingResetCredentials,
  ErrPermissionDenied,
  ErrRoleAlreadyAssigned,
  ErrUserInactivated,
  ErrUsernameExisted,
  User,
  UserStatus,
} from './user.model';
import { ITokenService, IUserRepository, IUserService } from './user.port';
import { ROLE_SERVICE } from '../role/role.di-token';
import { IRoleService } from '../role/role.port';

@Injectable()
export class UserService implements IUserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(ROLE_SERVICE) private readonly roleService: IRoleService,
  ) {}

  // Authentication methods
  async register(dto: UserRegistrationDTO): Promise<string> {
    try {
      // Check if username already exists
      const existingUser = await this.userRepo.findByUsername(dto.username);
      if (existingUser) {
        throw AppError.from(ErrUsernameExisted, 400);
      }

      // Generate salt and hash password
      const salt = bcrypt.genSaltSync(10);
      const hashPassword = await bcrypt.hash(`${dto.password}.${salt}`, 12);

      // Generate new user ID
      const newId = v4();

      // Lấy defaultRoleId từ code vai trò
      let defaultRoleId: string;
      // if (dto.defaultRoleCode) {
      //   const role = await this.roleService.getRoleByCode(dto.defaultRoleCode);
      //   defaultRoleId = role.id;
      // } else {
      //   // Nếu không có defaultRoleCode, lấy ID của vai trò WORKER
      //   const defaultRole = await this.roleService.getRoleByCode(
      //     UserRole.WORKER,
      //   );
      //   defaultRoleId = defaultRole.id;
      // }
      if (dto.roleId) {
        const role = await this.roleService.getRole(dto.roleId);
        defaultRoleId = role.id;
      } else {
        // Nếu không có defaultRoleCode, lấy ID của vai trò WORKER
        const defaultRole = await this.roleService.getRoleByCode(
          UserRole.WORKER,
        );
        defaultRoleId = defaultRole.id;
      }

      // Create new user object
      const newUser: User = {
        ...dto,
        password: hashPassword,
        username: dto.username,
        id: newId,
        status: dto.status || UserStatus.PENDING_ACTIVATION,
        salt: salt,
        roleId: defaultRoleId, // Sử dụng defaultRoleId thay vì role
        createdAt: new Date(),
        updatedAt: new Date(),
        fullName: dto.fullName,
        employeeId: dto.employeeId,
        cardId: dto.cardId,
        factoryId: dto.factoryId || null,
        lineId: dto.lineId || null,
        teamId: dto.teamId || null,
        groupId: dto.groupId || null,
        positionId: dto.positionId || null,
      };

      // Insert new user to repository
      await this.userRepo.insert(newUser);

      // Log successful user creation
      this.logger.log(`New user registered: ${dto.username} (${newId})`);

      return newId;
    } catch (error) {
      // Log error details
      this.logger.error(
        `Error during user registration: ${error.message}`,
        error.stack,
      );

      // Rethrow error for controller to handle
      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi đăng ký người dùng: ${error.message}`),
        400,
      );
    }
  }

  async login(dto: UserLoginDTO): Promise<{
    token: string;
    expiresIn: number;
    requiredResetPassword: boolean;
  }> {
    try {
      // Find user by username
      const user = await this.userRepo.findByUsername(dto.username);
      if (!user) {
        throw AppError.from(ErrInvalidUsernameAndPassword, 400);
      }

      // Check if user account is active
      if (
        user.status !== UserStatus.ACTIVE &&
        user.status !== UserStatus.PENDING_ACTIVATION
      ) {
        throw AppError.from(ErrUserInactivated, 400);
      }

      // Verify password
      const isMatch = await bcrypt.compare(
        `${dto.password}.${user.salt}`,
        user.password,
      );
      if (!isMatch) {
        throw AppError.from(ErrInvalidUsernameAndPassword, 400);
      }

      // Determine token expiration based on "remember me" option
      const expiresIn = dto.rememberMe ? '7d' : '1d'; // 7 days or 1 day

      // Create token payload
      const tokenPayload: TokenPayload = {
        sub: user.id,
        roleId: user.roleId,
        role: user.role,
        factoryId: user.factoryId || undefined,
        lineId: user.lineId || undefined,
        teamId: user.teamId || undefined,
        groupId: user.groupId || undefined,
      };

      // Generate JWT token
      const token = await this.tokenService.generateToken(
        tokenPayload,
        expiresIn,
      );

      // Calculate token expiration time in seconds
      const expirationTime = this.tokenService.getExpirationTime(token);

      // Update user's last login timestamp
      await this.userRepo.update(user.id, {
        lastLogin: new Date(),
        // If user is in PENDING_ACTIVATION, auto-activate on first login
      });

      // Log successful login
      this.logger.log(`User logged in: ${user.username} (${user.id})`);

      return {
        token,
        expiresIn: expirationTime,
        requiredResetPassword: user.status === UserStatus.PENDING_ACTIVATION,
      };
    } catch (error) {
      // Log error details
      this.logger.error(`Login error: ${error.message}`, error.stack);

      // Rethrow error for controller to handle
      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.from(
        new Error(`Lỗi khi đăng nhập: ${error.message}`),
        400,
      );
    }
  }

  async logout(token: string): Promise<void> {
    try {
      if (!token) {
        this.logger.warn('Attempted logout with empty token');
        return;
      }

      // Add additional debug logging
      this.logger.debug(
        `Processing logout for token: ${token.substring(0, 10)}...`,
      );

      // Decode token payload first to get user info for logging
      const payload = this.tokenService.decodeToken(token);
      const userId = payload?.sub || 'unknown';

      // Check blacklist before to see if token is already blacklisted
      const isAlreadyBlacklisted =
        await this.tokenService.isTokenBlacklisted(token);
      if (isAlreadyBlacklisted) {
        this.logger.debug(`Token for user ${userId} is already blacklisted`);
        return;
      }

      // Get token expiration time
      const expiresIn = this.tokenService.getExpirationTime(token);
      this.logger.debug(`Token expires in ${expiresIn} seconds`);

      if (expiresIn <= 0) {
        this.logger.debug(`Token for user ${userId} already expired`);
        return;
      }

      await this.tokenService.blacklistToken(token, expiresIn);

      // Verify the token was blacklisted
      const isNowBlacklisted =
        await this.tokenService.isTokenBlacklisted(token);
      if (!isNowBlacklisted) {
        this.logger.error(`Failed to blacklist token for user ${userId}`);
      } else {
        this.logger.log(`User logged out: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error during logout: ${error.message}`, error.stack);
    }
  }

  async introspectToken(token: string): Promise<TokenPayload> {
    // Verify token
    const payload = await this.tokenService.verifyToken(token);
    if (!payload) {
      throw AppError.from(ErrInvalidToken, 401);
    }

    // Get user to validate current status
    const user = await this.userRepo.get(payload.sub);
    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      throw AppError.from(ErrUserInactivated, 403);
    }

    return {
      sub: user.id,
      roleId: user.roleId,
      factoryId: user.factoryId || undefined,
      lineId: user.lineId || undefined,
      teamId: user.teamId || undefined,
      groupId: user.groupId || undefined,
    };
  }

  async refreshToken(
    token: string,
  ): Promise<{ token: string; expiresIn: number }> {
    // Decode the existing token (without verifying it)
    const payload = this.tokenService.decodeToken(token);
    if (!payload) {
      throw AppError.from(ErrInvalidToken, 401);
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw AppError.from(ErrInvalidToken, 401);
    }

    // Get user to ensure they still exist and are active
    const user = await this.userRepo.get(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw AppError.from(ErrUserInactivated, 403);
    }

    // Create a new token with the same payload but new expiration
    const newToken = await this.tokenService.generateToken({
      sub: user.id,
      roleId: user.roleId,
      factoryId: user.factoryId || undefined,
      lineId: user.lineId || undefined,
      teamId: user.teamId || undefined,
      groupId: user.groupId || undefined,
    });

    // Calculate expiration time
    const expiresIn = this.tokenService.getExpirationTime(newToken);

    // Blacklist the old token
    const oldTokenExpiresIn = this.tokenService.getExpirationTime(token);
    if (oldTokenExpiresIn > 0) {
      await this.tokenService.blacklistToken(token, oldTokenExpiresIn);
    }

    return { token: newToken, expiresIn };
  }

  async profile(userId: string): Promise<Omit<User, 'password' | 'salt'>> {
    try {
      const user = await this.userRepo.get(userId);

      if (!user) {
        this.logger.warn(`Profile request for non-existent user: ${userId}`);
        throw AppError.from(ErrNotFound, 404);
      }

      // Exclude sensitive information
      const { password, salt, ...userInfo } = user;
      return userInfo;
    } catch (error) {
      if (error instanceof AppError && error.message === 'Not found') {
        // Convert "Not found" errors to Unauthorized for profile requests
        // This helps when a token contains a deleted user ID
        throw AppError.from(
          new Error('Người dùng không tồn tại, vui lòng đăng nhập lại'),
          401,
        );
      }
      throw error;
    }
  }

  async update(
    requester: Requester,
    userId: string,
    dto: UserUpdateDTO,
  ): Promise<void> {
    // Check if user exists
    const user = await this.userRepo.get(userId);
    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Check permissions:
    // 1. User can update their own profile (but with limited fields)
    // 2. ADMIN and SUPER_ADMIN can update any user
    // 3. Managers can update users in their hierarchy
    const isSelfUpdate = requester.sub === userId;
    const isAdmin =
      requester.role === UserRole.ADMIN ||
      requester.role === UserRole.SUPER_ADMIN;

    if (!isSelfUpdate && !isAdmin) {
      // Check hierarchical permissions for managers
      const hasAccess = await this.canAccessEntity(
        requester.sub,
        'user',
        userId,
      );
      if (!hasAccess) {
        throw AppError.from(ErrPermissionDenied, 403);
      }

      // Non-admins cannot change status or role
      if (dto.status !== undefined || dto.roleId !== undefined) {
        throw AppError.from(ErrPermissionDenied, 403);
      }
    }

    // If it's a self-update by a non-admin, restrict the fields that can be updated
    if (isSelfUpdate && !isAdmin) {
      const { avatar, fullName, email, phone } = dto;
      await this.userRepo.update(userId, {
        avatar,
        fullName,
        email,
        phone,
        updatedAt: new Date(),
      });
    } else {
      // For admins or managers, update all allowed fields
      await this.userRepo.update(userId, { ...dto, updatedAt: new Date() });
    }

    this.logger.log(`User updated: ${userId} by ${requester.sub}`);
  }

  async delete(requester: Requester, userId: string): Promise<void> {
    // Check if user exists
    const user = await this.userRepo.get(userId);
    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Check permissions (only self, ADMIN, or SUPER_ADMIN can delete)
    const isSelf = requester.sub === userId;
    const isAdmin =
      requester.role === UserRole.ADMIN ||
      requester.role === UserRole.SUPER_ADMIN;

    if (!isSelf && !isAdmin) {
      throw AppError.from(ErrPermissionDenied, 403);
    }

    // Soft delete the user (change status to DELETED)
    await this.userRepo.delete(userId, false);

    this.logger.log(`User deleted: ${userId} by ${requester.sub}`);
  }

  // Password management methods
  async changePassword(userId: string, dto: ChangePasswordDTO): Promise<void> {
    // Get user
    const user = await this.userRepo.get(userId);
    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Verify old password
    const isMatch = await bcrypt.compare(
      `${dto.oldPassword}.${user.salt}`,
      user.password,
    );
    if (!isMatch) {
      throw AppError.from(ErrInvalidUsernameAndPassword, 400);
    }

    // Check if new password is the same as old password
    const isSamePassword = await bcrypt.compare(
      `${dto.newPassword}.${user.salt}`,
      user.password,
    );
    if (isSamePassword) {
      throw AppError.from(ErrExistsPassword, 400);
    }

    // Generate new salt and hash for the new password
    const salt = bcrypt.genSaltSync(10);
    const hashPassword = await bcrypt.hash(`${dto.newPassword}.${salt}`, 12);

    // Update user with new password
    await this.userRepo.update(userId, {
      password: hashPassword,
      salt,
      updatedAt: new Date(),
    });

    this.logger.log(`Password changed for user: ${userId}`);
  }

  async requestPasswordReset(
    dto: RequestPasswordResetDTO,
  ): Promise<{ resetToken: string; expiryDate: Date; username: string }> {
    let user: User | null = null;

    // Find user based on provided credentials
    if (dto.username) {
      user = await this.userRepo.findByUsername(dto.username);
    } else if (dto.cardId && dto.employeeId) {
      user = await this.userRepo.findByCardId(dto.cardId, dto.employeeId);
    } else {
      throw AppError.from(ErrMissingResetCredentials, 400);
    }

    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Generate password reset token
    const resetToken = await this.tokenService.generateResetToken();

    // Set expiry to 1 hour from now
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);

    // Save reset token to user
    await this.userRepo.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpiry: expiryDate,
      updatedAt: new Date(),
    });

    this.logger.log(`Password reset requested for user: ${user.id}`);

    return { resetToken, expiryDate, username: user.username };
  }

  async resetPassword(dto: UserResetPasswordDTO): Promise<void> {
    let user: User | null = null;

    // Find user based on provided credentials
    if (dto.resetToken) {
      // If reset token is provided, use it to find the user
      user = await this.userRepo.findByResetToken(dto.resetToken);

      // Verify token is valid and not expired
      if (
        !user ||
        !user.passwordResetExpiry ||
        user.passwordResetExpiry < new Date()
      ) {
        throw AppError.from(ErrInvalidResetToken, 400);
      }
    } else if (dto.username) {
      // If username is provided, find by username
      user = await this.userRepo.findByUsername(dto.username);
    } else if (dto.cardId && dto.employeeId) {
      // If cardId and employeeId are provided, find by those
      user = await this.userRepo.findByCardId(dto.cardId, dto.employeeId);
    } else {
      throw AppError.from(ErrMissingResetCredentials, 400);
    }

    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Check if new password is the same as old password
    const isSamePassword = await bcrypt.compare(
      `${dto.password}.${user.salt}`,
      user.password,
    );
    if (isSamePassword) {
      throw AppError.from(ErrExistsPassword, 400);
    }

    // Generate new salt and hash for the new password
    const salt = bcrypt.genSaltSync(10);
    const hashPassword = await bcrypt.hash(`${dto.password}.${salt}`, 12);

    // Update user with new password and clear reset token
    await this.userRepo.update(user.id, {
      password: hashPassword,
      salt,
      passwordResetToken: null,
      passwordResetExpiry: null,
      updatedAt: new Date(),
      status:
        user.status === UserStatus.PENDING_ACTIVATION
          ? UserStatus.ACTIVE
          : user.status,
    });

    this.logger.log(`Password reset completed for user: ${user.id}`);
  }

  // Role management methods
  async assignRole(
    requester: Requester,
    userId: string,
    dto: UserRoleAssignmentDTO,
  ): Promise<void> {
    // Check if user exists
    const user = await this.userRepo.get(userId);
    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Check if requester has permission to assign roles
    if (
      requester.role !== UserRole.ADMIN &&
      requester.role !== UserRole.SUPER_ADMIN
    ) {
      throw AppError.from(ErrPermissionDenied, 403);
    }

    // Check if user already has this role with the same scope
    const existingRoles = await this.userRepo.getUserRoles(userId);
    const duplicateRole = existingRoles.find(
      (r) => r.roleId === dto.roleId && r.scope === dto.scope,
    );

    if (duplicateRole) {
      throw AppError.from(ErrRoleAlreadyAssigned, 400);
    }

    // Assign the role
    await this.userRepo.assignRole(
      userId,
      dto.roleId,
      dto.scope,
      dto.expiryDate,
    );

    this.logger.log(
      `Role ${dto.roleId} assigned to user ${userId} by ${requester.sub}`,
    );
  }

  async removeRole(
    requester: Requester,
    userId: string,
    roleId: string,
    scope?: string,
  ): Promise<void> {
    // Check if user exists
    const user = await this.userRepo.get(userId);
    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Check if requester has permission to remove roles
    if (
      requester.role !== UserRole.ADMIN &&
      requester.role !== UserRole.SUPER_ADMIN
    ) {
      throw AppError.from(ErrPermissionDenied, 403);
    }

    // Remove the role
    await this.userRepo.removeRole(userId, roleId, scope);

    this.logger.log(
      `Role ${roleId} removed from user ${userId} by ${requester.sub}`,
    );
  }

  async getUserRoles(
    userId: string,
  ): Promise<
    { roleId: string; role: UserRole; scope?: string; expiryDate?: Date }[]
  > {
    // Check if user exists
    const user = await this.userRepo.get(userId);
    if (!user) {
      throw AppError.from(ErrNotFound, 404);
    }

    // Get all assigned roles
    const roles = await this.userRepo.getUserRoles(userId);

    // Include default role if not already included
    const hasDefaultRole = roles.some(
      (r) => r.roleId === user.roleId && !r.scope,
    );
    if (!hasDefaultRole && user.roleId) {
      // Thêm vai trò mặc định nếu chưa có trong danh sách
      const userRole = await this.roleService.getRole(user.roleId);
      roles.push({
        roleId: user.roleId,
        role: userRole.code as UserRole,
        scope: undefined,
      });
    }

    return roles;
  }

  // Access control methods
  async canAccessEntity(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<boolean> {
    // Get user
    const user = await this.userRepo.get(userId);
    if (!user) {
      return false;
    }

    // Get user roles
    const userRoles = await this.userRepo.getUserRoles(userId);
    const roles = userRoles.map((r) => r.role);

    // ADMIN and SUPER_ADMIN have full access
    if (
      roles.includes(UserRole.ADMIN) ||
      roles.includes(UserRole.SUPER_ADMIN)
    ) {
      return true;
    }

    // Check access based on entity type
    switch (entityType.toLowerCase()) {
      case 'factory':
        return this.userRepo.isFactoryManager(userId, entityId);

      case 'line':
        return this.userRepo.isLineManager(userId, entityId);

      case 'team':
        return this.userRepo.isTeamLeader(userId, entityId);

      case 'group':
        return this.userRepo.isGroupLeader(userId, entityId);

      case 'user':
        // A user can access another user if they manage any organization unit that user belongs to
        const targetUser = await this.userRepo.get(entityId);
        if (!targetUser) return false;

        // Self access
        if (userId === entityId) return true;

        // Check if user is a manager of target user's organizational units
        if (
          targetUser.factoryId &&
          (await this.userRepo.isFactoryManager(userId, targetUser.factoryId))
        ) {
          return true;
        }
        if (
          targetUser.lineId &&
          (await this.userRepo.isLineManager(userId, targetUser.lineId))
        ) {
          return true;
        }
        if (
          targetUser.teamId &&
          (await this.userRepo.isTeamLeader(userId, targetUser.teamId))
        ) {
          return true;
        }
        if (
          targetUser.groupId &&
          (await this.userRepo.isGroupLeader(userId, targetUser.groupId))
        ) {
          return true;
        }

        return false;

      default:
        this.logger.warn(
          `Unknown entity type: ${entityType} requested by user ${userId}`,
        );
        return false;
    }
  }

  // User management methods
  async listUsers(
    requester: Requester,
    conditions: UserCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: Array<Omit<User, 'password' | 'salt'>>;
    total: number;
    page: number;
    limit: number;
  }> {
    // Apply access control filters based on requester's role and permissions
    const filteredConditions = { ...conditions };

    // If not admin, restrict to organizational units the requester can access
    if (
      requester.role !== UserRole.ADMIN &&
      requester.role !== UserRole.SUPER_ADMIN
    ) {
      const managerialAccess = await this.userRepo.getManagerialAccess(
        requester.sub,
      );

      // Refine factory filter based on access
      if (filteredConditions.factoryId) {
        if (
          !managerialAccess.factories.includes(filteredConditions.factoryId)
        ) {
          throw AppError.from(ErrPermissionDenied, 403);
        }
      } else if (managerialAccess.factories.length > 0) {
        filteredConditions.factoryId = managerialAccess.factories[0]; // Default to first factory
      }

      // Apply similar logic for other organizational units
      if (
        filteredConditions.lineId &&
        !managerialAccess.lines.includes(filteredConditions.lineId)
      ) {
        throw AppError.from(ErrPermissionDenied, 403);
      }

      if (
        filteredConditions.teamId &&
        !managerialAccess.teams.includes(filteredConditions.teamId)
      ) {
        throw AppError.from(ErrPermissionDenied, 403);
      }

      if (
        filteredConditions.groupId &&
        !managerialAccess.groups.includes(filteredConditions.groupId)
      ) {
        throw AppError.from(ErrPermissionDenied, 403);
      }
    }

    // Get users with pagination
    const { data, total } = await this.userRepo.list(
      filteredConditions,
      pagination,
    );

    // Remove sensitive information
    const sanitizedData = data.map((user) => {
      const { password, salt, ...userInfo } = user;
      return userInfo;
    });

    return {
      data: sanitizedData,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }
}
