import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from 'src/share';
import { TOKEN_INTROSPECTOR } from 'src/share/di-token';
import { ShareModule } from 'src/share/module';
import { AuthController, AuthRpcController } from './auth.controller';
import { AUTH_SERVICE, TOKEN_SERVICE } from './auth.di-token';
import { AuthService } from './auth.service';
import { TokenService } from 'src/share/components/token.service';
import { RedisModule } from 'src/common/redis';
import { UserModule } from '../user/user.module';
import { ROLE_REPOSITORY, ROLE_SERVICE } from '../role/role.di-token';
import { RoleService } from '../role/role.service';
import { RolePrismaRepository } from '../role/role-prisma.repo';

const services: Provider[] = [
  { provide: AUTH_SERVICE, useClass: AuthService },
  { provide: TOKEN_SERVICE, useClass: TokenService },
  // Provide TOKEN_INTROSPECTOR using the same instance as TOKEN_SERVICE
  { provide: TOKEN_INTROSPECTOR, useExisting: TOKEN_SERVICE },
  { provide: ROLE_SERVICE, useClass: RoleService },
];

const repositories: Provider[] = [
  { provide: ROLE_REPOSITORY, useClass: RolePrismaRepository },
];

@Module({
  imports: [
    ShareModule,
    RedisModule,
    UserModule, // Import UserModule to use its repositories
    JwtModule.register({
      secret: config.rpc.jwtSecret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController, AuthRpcController],
  providers: [...services, ...repositories],
  exports: [AUTH_SERVICE, TOKEN_SERVICE, TOKEN_INTROSPECTOR],
})
export class AuthModule {}
