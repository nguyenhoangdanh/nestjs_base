import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { ROLE_REPOSITORY, ROLE_SERVICE } from './role.di-token';
import { RolePrismaRepository } from './role-prisma.repo';
import { RoleHttpController } from './role-http.controller';
import { ShareModule } from 'src/share/module';
import { RedisModule } from 'src/common/redis';

@Module({
  imports: [ShareModule, RedisModule],
  controllers: [RoleHttpController],
  providers: [
    {
      provide: ROLE_REPOSITORY,
      useClass: RolePrismaRepository,
    },
    {
      provide: ROLE_SERVICE,
      useClass: RoleService,
    },
  ],
  exports: [ROLE_SERVICE, ROLE_REPOSITORY],
})
export class RoleModule {}
