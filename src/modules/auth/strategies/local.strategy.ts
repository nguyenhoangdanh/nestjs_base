// src/modules/auth/strategies/local.strategy.ts
import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AUTH_SERVICE } from '../auth.di-token';
import { IAuthService } from '../auth.interface';
import { AppError } from '../../../share';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
  ) {
    super({ usernameField: 'username' });
  }

  async validate(username: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw AppError.from(
        new Error('Tên đăng nhập hoặc mật khẩu không đúng'),
        401,
      );
    }
    return user;
  }
}