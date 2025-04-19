import { Module } from '@nestjs/common';
import { ShareModule } from 'src/share/module';
import { RedisModule } from 'src/common/redis';
import { UserModule } from '../user/user.module';
import { PermissionHttpController } from './permission-http.controller';
import { PermissionPrismaRepository } from './permission-prisma.repo';
import { PermissionService } from './permission.service';
import {
  PERMISSION_REPOSITORY,
  PERMISSION_SERVICE,
} from './permission.di-token';

@Module({
  imports: [
    ShareModule,
    RedisModule,
    UserModule, // Import UserModule để có thể sử dụng UserRepository
  ],
  controllers: [PermissionHttpController],
  providers: [
    {
      provide: PERMISSION_REPOSITORY,
      useClass: PermissionPrismaRepository,
    },
    {
      provide: PERMISSION_SERVICE,
      useClass: PermissionService,
    },
  ],
  exports: [PERMISSION_SERVICE, PERMISSION_REPOSITORY],
})
export class PermissionModule {}
