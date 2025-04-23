import { Module } from '@nestjs/common';
import { USER_REPOSITORY, USER_SERVICE } from './user.di-token';
import { UserService } from './user.service';
import { UserPrismaRepository } from './user-prisma.repo';
import { UserHttpController } from './user-http.controller';
import { PrismaService } from '../../share/prisma.service';
import { RoleModule } from '../role/role.module';

@Module({
  imports: [RoleModule],
  controllers: [UserHttpController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserPrismaRepository,
    },
    {
      provide: USER_SERVICE,
      useClass: UserService,
    },
    PrismaService,
  ],
  exports: [USER_SERVICE, USER_REPOSITORY],
})
export class UserModule {}
