import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from 'src/share';
import { TOKEN_INTROSPECTOR } from 'src/share/di-token';
import { ShareModule } from 'src/share/module';
import {
  UserHttpController,
  UserRpcHttpController,
} from './user-http.controller';
import { UserPrismaRepository } from './user-prisma.repo';
import { TOKEN_SERVICE, USER_REPOSITORY, USER_SERVICE } from './user.di-token';
import { UserService } from './user.service';
import { TokenService } from 'src/share/components/token.service';
import { RedisModule } from 'src/common/redis';
import { ROLE_REPOSITORY, ROLE_SERVICE } from '../role/role.di-token';
import { RoleService } from '../role/role.service';
import { RolePrismaRepository } from '../role/role-prisma.repo';

const repositories: Provider[] = [
  { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
  { provide: ROLE_REPOSITORY, useClass: RolePrismaRepository },
];

const services: Provider[] = [
  { provide: USER_SERVICE, useClass: UserService },
  { provide: TOKEN_SERVICE, useClass: TokenService },
  // Quan trọng: Cung cấp TOKEN_INTROSPECTOR sử dụng cùng instance với TOKEN_SERVICE
  { provide: TOKEN_INTROSPECTOR, useExisting: TOKEN_SERVICE },
  { provide: ROLE_SERVICE, useClass: RoleService },
];

@Module({
  imports: [
    ShareModule,
    RedisModule,
    JwtModule.register({
      secret: config.rpc.jwtSecret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [UserHttpController, UserRpcHttpController],
  providers: [...repositories, ...services],
  exports: [USER_SERVICE, USER_REPOSITORY, TOKEN_SERVICE, TOKEN_INTROSPECTOR],
})
export class UserModule {}
