import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { USER_SERVICE } from '../../modules/user/user.di-token';
import { IUserService } from '../../modules/user/user.port';

export const ENTITY_ACCESS_KEY = 'entityAccess';
export interface EntityAccessMetadata {
  type: string;
  paramName: string;
}

@Injectable()
export class EntityAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(USER_SERVICE) private readonly userService: IUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<EntityAccessMetadata>(
      ENTITY_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.requester?.sub;

    if (!userId) {
      return false;
    }

    const entityId = request.params[metadata.paramName];

    if (!entityId) {
      return false;
    }

    return this.userService.canAccessEntity(userId, metadata.type, entityId);
  }
}
