// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { RedisModule } from '../../common/redis';
import { config } from '../../share/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokenService } from './token.service';
import { AUTH_SERVICE, TOKEN_SERVICE } from './auth.di-token';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: config.jwtSecret,
      signOptions: { expiresIn: '1d' }, // Mặc định hết hạn sau 1 ngày
    }),
    UserModule, // Cần import UserModule để sử dụng UserRepository
    RedisModule, // Để sử dụng blacklist token
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_SERVICE,
      useClass: AuthService,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: TokenService,
    },
    LocalStrategy,
    JwtStrategy,
  ],
  exports: [AUTH_SERVICE, TOKEN_SERVICE],
})
export class AuthModule {}