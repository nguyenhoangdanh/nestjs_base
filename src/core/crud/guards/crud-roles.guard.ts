import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Requester, UserRole, AppError } from '../../../share';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';

/**
 * Guard kiểm tra vai trò cho các endpoint CRUD
 */
@Injectable()
export class CrudRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lấy tùy chọn CRUD từ metadata
    const options = this.reflector.get<CrudControllerOptions>(
      CRUD_OPTIONS,
      context.getClass(),
    );

    // Nếu không có cấu hình, cho phép truy cập
    if (!options || !options.endpoints) {
      return true;
    }

    // Lấy thông tin request và endpoint
    const request = context.switchToHttp().getRequest();
    const requester = request['requester'] as Requester;
    const endpoint = this.getEndpointKey(context);

    // Kiểm tra nếu endpoint không có trong cấu hình
    if (!endpoint) {
      return true;
    }

    // Lấy cấu hình của endpoint
    const endpointConfig = options.endpoints[endpoint];

    // Nếu endpoint không yêu cầu vai trò, cho phép truy cập
    if (
      !endpointConfig ||
      !endpointConfig.roles ||
      endpointConfig.roles.length === 0
    ) {
      return true;
    }

    // Kiểm tra xem requester có tồn tại không
    if (!requester) {
      throw AppError.from(new Error('Authentication required'), 401);
    }

    // Super admin luôn có quyền truy cập
    if (requester.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Kiểm tra vai trò
    if (!requester.role) {
      return false;
    }

    // Kiểm tra xem vai trò của người dùng có nằm trong danh sách vai trò được phép không
    return endpointConfig.roles.includes(requester.role);
  }

  /**
   * Xác định loại endpoint dựa trên HTTP method và path
   */
  private getEndpointKey(context: ExecutionContext): string | null {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.route?.path || '';

    // Kiểm tra các pattern và trả về loại endpoint
    if (method === 'GET') {
      if (path.includes(':id')) return 'getOne';
      if (path.includes('count')) return 'count';
      return 'getAll';
    } else if (method === 'POST') {
      return 'create';
    } else if (method === 'PATCH' || method === 'PUT') {
      return 'update';
    } else if (method === 'DELETE') {
      return 'delete';
    }

    return null;
  }
}
