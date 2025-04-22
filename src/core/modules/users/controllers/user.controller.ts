// src/modules/users/controllers/user.controller.ts
import { Controller, Body } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { ApiTags } from '@nestjs/swagger';
import { BaseController } from 'src/core/controllers/base.controller';
import { UserQueryDto } from 'src/core/dtos/user-query.dto';
import { Roles } from 'src/share/guard';
import { UserRole } from 'src/share';
import { Override } from 'src/core/decorators/override.decorator';

@Controller('users')
@ApiTags('users')
export class UserController extends BaseController<
  User,
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto
> {
  constructor(private userService: UserService) {
    super(userService);
  }

  // Override create method
  @Override() // Giả định rằng bạn có decorator Override cho việc này
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async create(@Body() createDto: CreateUserDto): Promise<User> {
    return this.userService.createUser(createDto);
  }
}
