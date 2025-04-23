import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PrismaService } from '../../share/prisma.service';
import { UserModule } from '../user/user.module';
import { AUTH_SERVICE, TOKEN_SERVICE } from './auth.di-token';
import { EmailModule } from '../email/email.module';
import { RedisModule } from '../../common/redis';
import { AuthHttpController } from './auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    UserModule,
    EmailModule,
    RedisModule,
  ],
  controllers: [AuthHttpController],
  providers: [
    {
      provide: AUTH_SERVICE,
      useClass: AuthService,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: TokenService,
    },
    PrismaService,
  ],
  exports: [AUTH_SERVICE, TOKEN_SERVICE],
})
export class AuthModule {}
