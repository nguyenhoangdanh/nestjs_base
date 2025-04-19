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
import { RedisEventPublisher } from './components/redis-event-publisher';
import { RedisModule, RedisProviders } from 'src/common/redis';

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

// Thay đổi: Sử dụng RedisEventPublisher thay vì RedisClient singleton
const redisEventPublisher: Provider = {
  provide: EVENT_PUBLISHER,
  useClass: RedisEventPublisher,
};

@Module({
  imports: [RedisModule],
  providers: [
    tokenIntrospector,
    userRPC,
    postRPC,
    redisEventPublisher,

    // Database provider
    PrismaService,

    // Redis providers (EVENT_PUBLISHER và các provider khác)
    ...RedisProviders,
  ],
  exports: [
    tokenIntrospector,
    userRPC,
    postRPC,
    redisEventPublisher,
    PrismaService,
  ],
})
export class ShareModule {}
