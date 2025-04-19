// src/app.module.ts
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionModule } from './modules/permission/permission.module';
import { ShareModule } from './share/module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './common/redis';
import { APP_FILTER } from '@nestjs/core';
import { AppErrorFilter } from './common/exceptions/app-error.filter';

@Module({
  imports: [
    // Static files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),

    // Config module
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Core modules
    ShareModule,
    RedisModule,
    
    // Feature modules
    AuthModule,      // Thêm AuthModule mới
    UserModule,
    RoleModule,
    PermissionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppErrorFilter,
    },
  ],
})
export class AppModule {}