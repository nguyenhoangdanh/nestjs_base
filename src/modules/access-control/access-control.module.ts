import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis';
import { ShareModule } from 'src/share/module';
import { UserModule } from '../user/user.module';
import { RoleHttpController } from '../role/role-http.controller';
import { PermissionHttpController } from '../permission/permission-http.controller';
import { ROLE_REPOSITORY, ROLE_SERVICE } from '../role/role.di-token';
import { RolePrismaRepository } from '../role/role-prisma.repo';
import { RoleService } from '../role/role.service';
import {
  PERMISSION_REPOSITORY,
  PERMISSION_SERVICE,
} from '../permission/permission.di-token';
import { PermissionPrismaRepository } from '../permission/permission-prisma.repo';
import { PermissionService } from '../permission/permission.service';

@Module({
  imports: [ShareModule, RedisModule, UserModule],
  controllers: [RoleHttpController, PermissionHttpController],
  providers: [
    {
      provide: ROLE_REPOSITORY,
      useClass: RolePrismaRepository,
    },
    {
      provide: ROLE_SERVICE,
      useClass: RoleService,
    },
    {
      provide: PERMISSION_REPOSITORY,
      useClass: PermissionPrismaRepository,
    },
    {
      provide: PERMISSION_SERVICE,
      useClass: PermissionService,
    },
  ],
  exports: [
    ROLE_SERVICE,
    ROLE_REPOSITORY,
    PERMISSION_SERVICE,
    PERMISSION_REPOSITORY,
  ],
})
export class AccessControlModule {}
