// src/modules/users/services/user.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { CreateUserDto } from '../dtos/create-user.dto';
import * as bcrypt from 'bcrypt';
import { BaseService } from 'src/core/services/base.service';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserQueryDto } from 'src/core/dtos/user-query.dto';

@Injectable()
export class UserService extends BaseService<
  User,
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto
> {
  // Trong BaseService
  protected readonly logger = new Logger(this.constructor.name);
  constructor(private userRepository: UserRepository) {
    super(userRepository);
  }

  // Override validation method
  protected async validateCreate(createDto: CreateUserDto): Promise<void> {
    // Check if email exists
    const existingUser = await this.userRepository.findByEmail(createDto.email);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }
  }

  // Add custom methods
  async createUser(createDto: CreateUserDto): Promise<User> {
    // Hash password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createDto.password, salt);

    // Create user
    const user = await this.create({
      ...createDto,
      password: hashedPassword,
    });

    // Add roles if provided
    if (createDto.roleIds && createDto.roleIds.length > 0) {
      await this.assignRoles(user.id, createDto.roleIds);
    }

    return user;
  }

  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    // Implement role assignment logic
    // ...
  }
}
