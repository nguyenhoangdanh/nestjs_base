import { Injectable, Logger } from '@nestjs/common';
import {
  User as UserPrisma,
  Role as PrismaRole,
  UserStatus as PrismaUserStatus,
  Prisma,
} from '@prisma/client';
import { UserRole } from 'src/share';
import prisma from 'src/share/components/prisma';
import { PaginationDTO, UserCondDTO } from './user.dto';
import { User, UserStatus } from './user.model';
import { IUserRepository } from './user.port';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
  private readonly logger = new Logger(UserPrismaRepository.name);

  // ========== Private Utility Methods ==========
  private _toModel(data: UserPrisma & { role?: PrismaRole | null }): User {
    // Map only fields defined in the User model
    return {
      id: data.id,
      fullName: data.fullName,
      employeeId: data.employeeId,
      cardId: data.cardId,
      username: data.username,
      password: data.password,
      salt: data.salt,
      roleId: data.roleId || '',
      status: data.status as UserStatus,
      role: data.role?.code as UserRole,
      email: data.email,
      phone: data.phone,
      factoryId: data.factoryId,
      lineId: data.lineId,
      teamId: data.teamId,
      groupId: data.groupId,
      positionId: data.positionId,
      lastLogin: data.lastLogin,
      passwordResetToken: data.passwordResetToken,
      passwordResetExpiry: data.passwordResetExpiry,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      avatar: data.avatar,
    };
  }

  private _conditionsToWhereClause(
    conditions: UserCondDTO,
  ): Prisma.UserWhereInput {
    const whereClause: Prisma.UserWhereInput = {};

    if (conditions.username) {
      whereClause.username = {
        contains: conditions.username,
        mode: 'insensitive',
      };
    }

    if (conditions.fullName) {
      whereClause.fullName = {
        contains: conditions.fullName,
        mode: 'insensitive',
      };
    }

    if (conditions.status) {
      whereClause.status = conditions.status as PrismaUserStatus;
    }

    if (conditions.factoryId) {
      whereClause.factoryId = conditions.factoryId;
    }

    if (conditions.lineId) {
      whereClause.lineId = conditions.lineId;
    }

    if (conditions.teamId) {
      whereClause.teamId = conditions.teamId;
    }

    if (conditions.groupId) {
      whereClause.groupId = conditions.groupId;
    }

    if (conditions.positionId) {
      whereClause.positionId = conditions.positionId;
    }

    if (conditions.roleId) {
      whereClause.roleId = conditions.roleId;
    }

    if (conditions.roleCode) {
      whereClause.role = {
        code: conditions.roleCode,
      };
    }

    // Default to active users unless explicitly specified
    if (conditions.status === undefined) {
      whereClause.status = { not: PrismaUserStatus.DELETED };
    }

    return whereClause;
  }

  // Check if user has administrative role (ADMIN or SUPER_ADMIN)
  private async _hasAdminRole(userId: string): Promise<boolean> {
    const adminRole = await prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        role: {
          code: {
            in: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
          },
        },
        // OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
    });

    return !!adminRole;
  }

  // Implement the methods from IUserRepository interface
  // The implementations will be added in subsequent files
  // ...

  // ========== Query methods ==========
  async get(id: string): Promise<User | null> {
    try {
      const data = await prisma.user.findUnique({
        where: { id },
        include: {
          role: true,
        },
      });

      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error fetching user ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  async findByCond(cond: UserCondDTO): Promise<User | null> {
    try {
      const data = await prisma.user.findFirst({
        where: this._conditionsToWhereClause(cond),
        include: {
          role: true,
        },
      });

      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error finding user by conditions: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to find user by conditions: ${error.message}`);
    }
  }

  async findByCardId(cardId: string, employeeId: string): Promise<User | null> {
    try {
      const data = await prisma.user.findFirst({
        where: {
          cardId,
          employeeId,
        },
        include: {
          role: true,
        },
      });

      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error finding user by card ID: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to find user by card ID: ${error.message}`);
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const data = await prisma.user.findFirst({
        where: { username },
        include: {
          role: true,
        },
      });

      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error finding user by username: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to find user by username: ${error.message}`);
    }
  }

  async findByResetToken(token: string): Promise<User | null> {
    try {
      const data = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpiry: {
            gt: new Date(), // Token not expired
          },
        },
        include: {
          role: true,
        },
      });

      return data ? this._toModel(data) : null;
    } catch (error) {
      this.logger.error(
        `Error finding user by reset token: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to find user by reset token: ${error.message}`);
    }
  }

  async listByIds(ids: string[]): Promise<User[]> {
    try {
      if (!ids.length) return [];

      const data = await prisma.user.findMany({
        where: { id: { in: ids } },
        include: {
          role: true,
        },
      });

      return data.map(this._toModel);
    } catch (error) {
      this.logger.error(
        `Error listing users by IDs: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to list users by IDs: ${error.message}`);
    }
  }

  async list(
    conditions: UserCondDTO,
    pagination: PaginationDTO,
  ): Promise<{
    data: User[];
    total: number;
  }> {
    try {
      // Validate pagination parameters
      const page = Math.max(1, pagination.page || 1);
      const limit = Math.min(100, Math.max(1, pagination.limit || 10));
      const sortBy = pagination.sortBy || 'createdAt';
      const sortOrder = pagination.sortOrder || 'desc';

      const whereClause = this._conditionsToWhereClause(conditions);

      // Run count and data queries in parallel for efficiency
      const [total, data] = await Promise.all([
        prisma.user.count({ where: whereClause }),
        prisma.user.findMany({
          where: whereClause,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: { role: true },
        }),
      ]);

      return {
        data: data.map(this._toModel),
        total,
      };
    } catch (error) {
      this.logger.error(`Error listing users: ${error.message}`, error.stack);
      throw new Error(`Failed to list users: ${error.message}`);
    }
  }

  // ========== Command methods ==========
  async insert(user: User): Promise<void> {
    try {
      await prisma.user.create({
        data: {
          id: user.id,
          fullName: user.fullName,
          employeeId: user.employeeId,
          cardId: user.cardId,
          username: user.username,
          password: user.password,
          salt: user.salt,
          roleId: user.roleId,
          status: user.status as PrismaUserStatus,
          email: user.email,
          phone: user.phone,
          factoryId: user.factoryId,
          lineId: user.lineId,
          teamId: user.teamId,
          groupId: user.groupId,
          positionId: user.positionId,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      this.logger.error(`Error inserting user: ${error.message}`, error.stack);
      throw new Error(`Failed to insert user: ${error.message}`);
    }
  }

  async update(id: string, dto: Partial<User>): Promise<void> {
    try {
      // Filter out undefined values to avoid unintended updates
      const updateData: Prisma.UserUpdateInput = {};

      if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
      if (dto.employeeId !== undefined) updateData.employeeId = dto.employeeId;
      if (dto.cardId !== undefined) updateData.cardId = dto.cardId;
      if (dto.username !== undefined) updateData.username = dto.username;
      if (dto.password !== undefined) updateData.password = dto.password;
      if (dto.salt !== undefined) updateData.salt = dto.salt;
      if (dto.status !== undefined)
        updateData.status = dto.status as PrismaUserStatus;
      if (dto.email !== undefined) updateData.email = dto.email;
      if (dto.phone !== undefined) updateData.phone = dto.phone;
      if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
      if (dto.lastLogin !== undefined) updateData.lastLogin = dto.lastLogin;
      if (dto.passwordResetToken !== undefined)
        updateData.passwordResetToken = dto.passwordResetToken;
      if (dto.passwordResetExpiry !== undefined)
        updateData.passwordResetExpiry = dto.passwordResetExpiry;

      if (dto.roleId !== undefined)
        updateData.role = dto.roleId
          ? { connect: { id: dto.roleId } }
          : { disconnect: true };

      if (dto.factoryId !== undefined)
        updateData.factory = dto.factoryId
          ? { connect: { id: dto.factoryId } }
          : { disconnect: true };

      if (dto.lineId !== undefined)
        updateData.line = dto.lineId
          ? { connect: { id: dto.lineId } }
          : { disconnect: true };

      if (dto.teamId !== undefined)
        updateData.team = dto.teamId
          ? { connect: { id: dto.teamId } }
          : { disconnect: true };

      if (dto.groupId !== undefined)
        updateData.group = dto.groupId
          ? { connect: { id: dto.groupId } }
          : { disconnect: true };

      if (dto.positionId !== undefined)
        updateData.position = dto.positionId
          ? { connect: { id: dto.positionId } }
          : { disconnect: true };

      await prisma.user.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(
        `Error updating user ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async delete(id: string, isHard: boolean = false): Promise<void> {
    try {
      if (isHard) {
        // Hard delete - remove the record from the database
        await prisma.user.delete({
          where: { id },
        });
      } else {
        // Soft delete - update the status to DELETED
        await prisma.user.update({
          where: { id },
          data: {
            status: PrismaUserStatus.DELETED,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Error deleting user ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async invalidateToken(token: string): Promise<void> {
    // try {
    //   // Add the token to the blacklist table
    //   await prisma.tokenBlacklist.create({
    //     data: {
    //       token,
    //       expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    //     },
    //   });
    // } catch (error) {
    //   this.logger.error(
    //     `Error invalidating token: ${error.message}`,
    //     error.stack,
    //   );
    //   throw new Error(`Failed to invalidate token: ${error.message}`);
    // }
  }

  // Additional helper methods not strictly in the interface but needed for implementation

  async setResetToken(
    userId: string,
    token: string,
    expiry: Date,
  ): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordResetToken: token,
          passwordResetExpiry: expiry,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error setting reset token for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to set reset token: ${error.message}`);
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastLogin: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Error updating last login for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to update last login: ${error.message}`);
    }
  }

  async changePassword(
    userId: string,
    hashedPassword: string,
    salt: string,
  ): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          salt: salt,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error changing password for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to change password: ${error.message}`);
    }
  }

  // ========== Role management methods ==========
  async assignRole(
    userId: string,
    roleId: string,
    scope?: string,
    expiryDate?: Date,
  ): Promise<void> {
    try {
      // Check if the role assignment already exists
      const existingAssignment = await prisma.userRoleAssignment.findFirst({
        where: {
          userId,
          roleId,
          scope: scope || null,
        },
      });

      if (existingAssignment) {
        // Update the existing assignment
        await prisma.userRoleAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            expiryDate,
          },
        });
      } else {
        // Create a new assignment
        await prisma.userRoleAssignment.create({
          data: {
            userId,
            roleId,
            scope,
            expiryDate,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Error assigning role ${roleId} to user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to assign role: ${error.message}`);
    }
  }

  async removeRole(
    userId: string,
    roleId: string,
    scope?: string,
  ): Promise<void> {
    try {
      await prisma.userRoleAssignment.deleteMany({
        where: {
          userId,
          roleId,
          ...(scope ? { scope } : {}),
        },
      });
    } catch (error) {
      this.logger.error(
        `Error removing role ${roleId} from user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove role: ${error.message}`);
    }
  }

  async getUserRoles(
    userId: string,
  ): Promise<
    { roleId: string; role: UserRole; scope?: string; expiryDate?: Date }[]
  > {
    try {
      const userRoleAssignments = await prisma.userRoleAssignment.findMany({
        where: {
          userId,
          // Only return non-expired roles
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
        include: {
          role: true,
        },
      });

      return userRoleAssignments.map((assignment) => ({
        roleId: assignment.roleId,
        role: assignment.role.code as UserRole,
        scope: assignment.scope || undefined,
        expiryDate: assignment.expiryDate || undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting user roles for ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get user roles: ${error.message}`);
    }
  }

  // Helper methods for hierarchical access queries
  private async _getFactoryAccess(
    userId: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<string[]> {
    // Get directly managed factories
    const managedFactories = await tx.factoryManager.findMany({
      where: {
        userId,
        endDate: { gte: new Date() },
      },
      select: { factoryId: true },
    });

    // Get factory-scoped roles
    const factoryRoles = await tx.userRoleAssignment.findMany({
      where: {
        userId,
        role: { code: UserRole.FACTORY_MANAGER },
        scope: { startsWith: 'factory:' },
        OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
      select: { scope: true },
    });

    // Extract factory IDs from scopes
    const factoryIds = [
      ...managedFactories.map((f) => f.factoryId),
      ...factoryRoles
        .map((r) => r.scope?.replace('factory:', '') || '')
        .filter((id) => id !== ''),
    ];

    // Remove duplicates
    return [...new Set(factoryIds)];
  }

  private async _getLineAccess(
    userId: string,
    factoryIds: string[],
    tx: Prisma.TransactionClient = prisma,
  ): Promise<string[]> {
    // Get lines in accessible factories
    const linesInFactories =
      factoryIds.length > 0
        ? await tx.line.findMany({
            where: { factoryId: { in: factoryIds } },
            select: { id: true },
          })
        : [];

    // Get directly managed lines
    const managedLines = await tx.lineManager.findMany({
      where: {
        userId,
        endDate: { gte: new Date() },
      },
      select: { lineId: true },
    });

    // Get line-scoped roles
    const lineRoles = await tx.userRoleAssignment.findMany({
      where: {
        userId,
        role: { code: UserRole.LINE_MANAGER },
        scope: { startsWith: 'line:' },
        OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
      select: { scope: true },
    });

    // Combine all line IDs
    const lineIds = [
      ...linesInFactories.map((l) => l.id),
      ...managedLines.map((l) => l.lineId),
      ...lineRoles
        .map((r) => r.scope?.replace('line:', '') || '')
        .filter((id) => id !== ''),
    ];

    // Remove duplicates
    return [...new Set(lineIds)];
  }

  private async _getTeamAccess(
    userId: string,
    lineIds: string[],
    tx: Prisma.TransactionClient = prisma,
  ): Promise<string[]> {
    // Get teams in accessible lines
    const teamsInLines =
      lineIds.length > 0
        ? await tx.team.findMany({
            where: { lineId: { in: lineIds } },
            select: { id: true },
          })
        : [];

    // Get directly led teams
    const ledTeams = await tx.teamLeader.findMany({
      where: {
        userId,
        endDate: { gte: new Date() },
      },
      select: { teamId: true },
    });

    // Get team-scoped roles
    const teamRoles = await tx.userRoleAssignment.findMany({
      where: {
        userId,
        role: { code: UserRole.TEAM_LEADER },
        scope: { startsWith: 'team:' },
        OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
      select: { scope: true },
    });

    // Combine all team IDs
    const teamIds = [
      ...teamsInLines.map((t) => t.id),
      ...ledTeams.map((t) => t.teamId),
      ...teamRoles
        .map((r) => r.scope?.replace('team:', '') || '')
        .filter((id) => id !== ''),
    ];

    // Remove duplicates
    return [...new Set(teamIds)];
  }

  private async _getGroupAccess(
    userId: string,
    teamIds: string[],
    tx: Prisma.TransactionClient = prisma,
  ): Promise<string[]> {
    // Get groups in accessible teams
    const groupsInTeams =
      teamIds.length > 0
        ? await tx.group.findMany({
            where: { teamId: { in: teamIds } },
            select: { id: true },
          })
        : [];

    // Get directly led groups
    const ledGroups = await tx.groupLeader.findMany({
      where: {
        userId,
        endDate: { gte: new Date() },
      },
      select: { groupId: true },
    });

    // Get group-scoped roles
    const groupRoles = await tx.userRoleAssignment.findMany({
      where: {
        userId,
        role: { code: UserRole.GROUP_LEADER },
        scope: { startsWith: 'group:' },
        OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
      select: { scope: true },
    });

    // Combine all group IDs
    const groupIds = [
      ...groupsInTeams.map((g) => g.id),
      ...ledGroups.map((g) => g.groupId),
      ...groupRoles
        .map((r) => r.scope?.replace('group:', '') || '')
        .filter((id) => id !== ''),
    ];

    // Remove duplicates
    return [...new Set(groupIds)];
  }

  // ========== Entity access methods ==========
  async isFactoryManager(userId: string, factoryId: string): Promise<boolean> {
    try {
      // Check admin role first for better performance
      const hasAdminAccess = await this._hasAdminRole(userId);
      if (hasAdminAccess) return true;

      // Check direct factory manager assignment
      const directAssignment = await prisma.factoryManager.findFirst({
        where: {
          userId,
          factoryId,
          endDate: { gte: new Date() },
        },
      });

      if (directAssignment) return true;

      // Check role-based factory manager assignment
      const roleAssignment = await prisma.userRoleAssignment.findFirst({
        where: {
          userId,
          role: {
            code: UserRole.FACTORY_MANAGER,
          },
          scope: `factory:${factoryId}`,
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
      });

      return !!roleAssignment;
    } catch (error) {
      this.logger.error(
        `Error checking factory manager status: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to check factory manager status: ${error.message}`,
      );
    }
  }

  async isLineManager(userId: string, lineId: string): Promise<boolean> {
    try {
      // First check if user has administrative privileges
      const hasAdminAccess = await this._hasAdminRole(userId);
      if (hasAdminAccess) return true;

      // Get line info including factory
      const line = await prisma.line.findUnique({
        where: { id: lineId },
        select: { factoryId: true },
      });

      if (!line) return false;

      // Check if user is factory manager for this line's factory
      const isUserFactoryManager = await this.isFactoryManager(
        userId,
        line.factoryId,
      );
      if (isUserFactoryManager) return true;

      // Check direct line manager assignment
      const directAssignment = await prisma.lineManager.findFirst({
        where: {
          userId,
          lineId,
          endDate: { gte: new Date() },
        },
      });

      if (directAssignment) return true;

      // Check role-based line manager assignment
      const roleAssignment = await prisma.userRoleAssignment.findFirst({
        where: {
          userId,
          role: {
            code: UserRole.LINE_MANAGER,
          },
          scope: `line:${lineId}`,
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
      });

      return !!roleAssignment;
    } catch (error) {
      this.logger.error(
        `Error checking line manager status: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to check line manager status: ${error.message}`);
    }
  }

  async isTeamLeader(userId: string, teamId: string): Promise<boolean> {
    try {
      // First check if user has administrative privileges
      const hasAdminAccess = await this._hasAdminRole(userId);
      if (hasAdminAccess) return true;

      // Get team info including line
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { lineId: true },
      });

      if (!team) return false;

      // Check if user is line manager (which includes being factory manager)
      const isUserLineManager = await this.isLineManager(userId, team.lineId);
      if (isUserLineManager) return true;

      // Check direct team leader assignment
      const directAssignment = await prisma.teamLeader.findFirst({
        where: {
          userId,
          teamId,
          endDate: { gte: new Date() },
        },
      });

      if (directAssignment) return true;

      // Check role-based team leader assignment
      const roleAssignment = await prisma.userRoleAssignment.findFirst({
        where: {
          userId,
          role: {
            code: UserRole.TEAM_LEADER,
          },
          scope: `team:${teamId}`,
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
      });

      return !!roleAssignment;
    } catch (error) {
      this.logger.error(
        `Error checking team leader status: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to check team leader status: ${error.message}`);
    }
  }

  async isGroupLeader(userId: string, groupId: string): Promise<boolean> {
    try {
      // First check if user has administrative privileges
      const hasAdminAccess = await this._hasAdminRole(userId);
      if (hasAdminAccess) return true;

      // Get group info including team
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { teamId: true },
      });

      if (!group) return false;

      // Check if user is team leader (which includes higher roles)
      const isUserTeamLeader = await this.isTeamLeader(userId, group.teamId);
      if (isUserTeamLeader) return true;

      // Check direct group leader assignment
      const directAssignment = await prisma.groupLeader.findFirst({
        where: {
          userId,
          groupId,
          endDate: { gte: new Date() },
        },
      });

      if (directAssignment) return true;

      // Check role-based group leader assignment
      const roleAssignment = await prisma.userRoleAssignment.findFirst({
        where: {
          userId,
          role: {
            code: UserRole.GROUP_LEADER,
          },
          scope: `group:${groupId}`,
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
      });

      return !!roleAssignment;
    } catch (error) {
      this.logger.error(
        `Error checking group leader status: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to check group leader status: ${error.message}`);
    }
  }

  async getManagerialAccess(userId: string): Promise<{
    factories: string[];
    lines: string[];
    teams: string[];
    groups: string[];
  }> {
    try {
      // Check admin role first
      const hasAdminAccess = await this._hasAdminRole(userId);

      // Admin and super admin have access to everything
      if (hasAdminAccess) {
        const [factories, lines, teams, groups] = await Promise.all([
          prisma.factory.findMany({ select: { id: true } }),
          prisma.line.findMany({ select: { id: true } }),
          prisma.team.findMany({ select: { id: true } }),
          prisma.group.findMany({ select: { id: true } }),
        ]);

        return {
          factories: factories.map((f) => f.id),
          lines: lines.map((l) => l.id),
          teams: teams.map((t) => t.id),
          groups: groups.map((g) => g.id),
        };
      }

      // Efficiently query all the hierarchical data in a transaction
      return await prisma.$transaction(async (tx) => {
        // Get factory access
        const factoryIds = await this._getFactoryAccess(userId, tx);

        // Get line access based on factory access and direct assignments
        const lineIds = await this._getLineAccess(userId, factoryIds, tx);

        // Get team access based on line access and direct assignments
        const teamIds = await this._getTeamAccess(userId, lineIds, tx);

        // Get group access based on team access and direct assignments
        const groupIds = await this._getGroupAccess(userId, teamIds, tx);

        return {
          factories: factoryIds,
          lines: lineIds,
          teams: teamIds,
          groups: groupIds,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting managerial access for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get managerial access: ${error.message}`);
    }
  }

  // ========== Entity access method ==========
  async canAccessEntity(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<boolean> {
    try {
      // Check if user has admin role first
      const hasAdminAccess = await this._hasAdminRole(userId);
      if (hasAdminAccess) return true;

      // Entity type specific access checks
      switch (entityType.toLowerCase()) {
        case 'factory':
          return await this.isFactoryManager(userId, entityId);

        case 'line':
          return await this.isLineManager(userId, entityId);

        case 'team':
          return await this.isTeamLeader(userId, entityId);

        case 'group':
          return await this.isGroupLeader(userId, entityId);

        // Add more entity types if needed

        default:
          this.logger.warn(`Unknown entity type: ${entityType}`);
          return false;
      }
    } catch (error) {
      this.logger.error(
        `Error checking entity access for user ${userId}, entity type ${entityType}, entity ID ${entityId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to check entity access: ${error.message}`);
    }
  }
}
