import { Request } from 'express';
import { AppEvent, Post, PublicUser, Topic } from './data-model';

export enum UserRole {
  WORKER = 'WORKER',
  GROUP_LEADER = 'GROUP_LEADER',
  TEAM_LEADER = 'TEAM_LEADER',
  LINE_MANAGER = 'LINE_MANAGER',
  FACTORY_MANAGER = 'FACTORY_MANAGER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface TokenPayload {
  sub: string;
  roleId?: string;
  role?: UserRole;
  factoryId?: string;
  lineId?: string;
  teamId?: string;
  groupId?: string;
}

export interface Requester extends TokenPayload {}
// export interface ReqWithRequester {
//   requester: Requester;
// }
export interface ReqWithRequester extends Request {
  requester: Requester;
  // cookies và headers đã được định nghĩa trong Request từ Express
}
export interface ReqWithRequesterOpt {
  requester?: Requester;
}

export interface ITokenProvider {
  // generate access token
  generateToken(payload: TokenPayload): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload | null>;
}

// Trong file src/share/interface.ts hoặc nơi định nghĩa các interface
export interface TokenIntrospectResult {
  payload: TokenPayload | null;
  error?: Error;
  isOk: boolean;
}

export interface ITokenIntrospect {
  introspect(token: string): Promise<TokenIntrospectResult>;
  isTokenBlacklisted(token: string): Promise<boolean>;
}
export interface IPostRpc {
  findById(id: string): Promise<Post | null>;
  findByIds(ids: Array<string>): Promise<Array<Post>>;
}
export interface IAuthorRpc {
  findById(id: string): Promise<PublicUser | null>;
  findByIds(ids: Array<string>): Promise<Array<PublicUser>>;
}

export interface ITopicRPC {
  findById(id: string): Promise<Topic | null>;
  findAll(): Promise<Array<Topic>>;
}

// export interface IPublicUserRpc extends IAuthorRpc {}

export interface IPublicUserRpc extends IAuthorRpc {}

export type EventHandler = (msg: string) => void;

export interface IEventPublisher {
  publish<T>(event: AppEvent<T>): Promise<void>;
}
