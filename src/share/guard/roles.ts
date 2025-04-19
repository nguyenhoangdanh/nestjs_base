import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Requester, UserRole } from '../interface';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const requester = request['requester'] as Requester;

    // Better error handling for missing requester
    if (!requester) {
      console.error('No requester found in request. Check auth middleware.');
      return false;
    }

    // Handle case where role is undefined
    if (requester.role === undefined) {
      console.error('User role is undefined. Check token payload extraction.');
      return false;
    }

    // Now check permissions
    if (requester.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    return requiredRoles.some((role) => requester.role === role);
  }
}
