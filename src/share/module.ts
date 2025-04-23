// src/share/module.ts
import { Module, Provider } from '@nestjs/common';
import { config } from './config';
import {
  EVENT_PUBLISHER,
  POST_RPC,
  TOKEN_INTROSPECTOR,
  USER_RPC,
} from './di-token';
import { PostRPCClient, TokenIntrospectRPCClient, UserRPCClient } from './rpc';
import { PrismaService } from './prisma.service';
import { RedisModule } from 'src/common/redis';

const tokenRPCClient = new TokenIntrospectRPCClient(config.rpc.introspectUrl);
const tokenIntrospector: Provider = {
  provide: TOKEN_INTROSPECTOR,
  useValue: tokenRPCClient,
};

const userRPCClient = new UserRPCClient(config.rpc.userServiceURL);
const userRPC: Provider = {
  provide: USER_RPC,
  useValue: userRPCClient,
};

const postRPCClient = new PostRPCClient(config.rpc.postServiceURL);
const postRPC: Provider = {
  provide: POST_RPC,
  useValue: postRPCClient,
};

@Module({
  imports: [RedisModule], // Sử dụng RedisModule để lấy EVENT_PUBLISHER
  providers: [
    tokenIntrospector,
    userRPC,
    postRPC,
    // Không cần khai báo EVENT_PUBLISHER ở đây nữa
    // vì đã được export từ RedisModule
    PrismaService,
  ],
  exports: [
    tokenIntrospector,
    userRPC,
    postRPC,
    // Export EVENT_PUBLISHER từ RedisModule
    PrismaService,
  ],
})
export class ShareModule {}
