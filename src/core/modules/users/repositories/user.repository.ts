// src/modules/users/repositories/user.repository.ts
import { Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/core/repositories/base.repository';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository);
  }

  // Add custom methods for user repository
  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.repository.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      },
    });
  }
}
