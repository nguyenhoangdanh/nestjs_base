import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Requester, UserRole, AppError } from '../../../share';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import {
  CrudControllerOptions,
  CrudEndpointType,
} from '../interfaces/crud-options.interface';

/**
 * Guard kiểm tra vai trò cho các endpoint CRUD
 */
@Injectable()
export class CrudRolesGuard implements CanActivate {
  private readonly logger = new Logger(CrudRolesGuard.name);

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
    if (!endpoint || !Object.keys(options.endpoints).includes(endpoint)) {
      this.logger.debug(
        `Endpoint không xác định hoặc không được cấu hình, cho phép truy cập`,
      );
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
      this.logger.debug(
        `Endpoint ${endpoint} không yêu cầu vai trò, cho phép truy cập`,
      );
      return true;
    }

    // Kiểm tra xem requester có tồn tại không
    if (!requester) {
      this.logger.warn(
        `Thiếu thông tin requester, từ chối truy cập cho endpoint ${endpoint}`,
      );
      throw AppError.from(new Error('Authentication required'), 401);
    }

    // Super admin luôn có quyền truy cập
    if (requester.role === UserRole.SUPER_ADMIN) {
      this.logger.debug(`SUPER_ADMIN được phép truy cập endpoint ${endpoint}`);
      return true;
    }

    // Kiểm tra vai trò
    if (!requester.role) {
      this.logger.warn(
        `Requester không có vai trò, từ chối truy cập cho endpoint ${endpoint}`,
      );
      return false;
    }

    // Kiểm tra xem vai trò của người dùng có nằm trong danh sách vai trò được phép không
    const hasRole = endpointConfig.roles.includes(requester.role);

    if (!hasRole) {
      this.logger.warn(
        `Vai trò ${requester.role} không được phép truy cập endpoint ${endpoint}. Vai trò được phép: ${endpointConfig.roles.join(', ')}`,
      );
    } else {
      this.logger.debug(
        `Vai trò ${requester.role} được phép truy cập endpoint ${endpoint}`,
      );
    }

    return hasRole;
  }

  /**
   * Xác định loại endpoint dựa trên HTTP method và path
   */
  private getEndpointKey(context: ExecutionContext): CrudEndpointType | null {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const path = request.route?.path || '';
    const handler = context.getHandler();

    // Try to get from metadata first (if explicitly marked)
    const specifiedEndpoint = this.reflector.get<string>(
      'crud:endpoint',
      handler,
    );

    // Validate that specified endpoint matches one of our allowed types
    if (specifiedEndpoint && this.isValidEndpointType(specifiedEndpoint)) {
      return specifiedEndpoint;
    }
    // Determine endpoint from method and path
    if (method === 'GET') {
      if (path.includes('/count') || request.url.includes('/count')) {
        return 'count';
      }
      if (path.includes(':id') || /\/[a-f0-9-]{36}$/i.test(request.url)) {
        return 'getOne';
      }
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

  // Add a type guard to check if a string is a valid endpoint type
  private isValidEndpointType(endpoint: string): endpoint is CrudEndpointType {
    return ['getAll', 'getOne', 'create', 'update', 'delete', 'count'].includes(
      endpoint,
    );
  }
}
