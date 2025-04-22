import { Paginated } from '../../../share';
import { PagingDTO } from '../interfaces/crud.interface';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';
import { Type } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Tạo response định dạng chuẩn với pagination
 */
export const paginatedResponse = <E>(paginated: Paginated<E>, filter: any) => ({
  data: paginated.data,
  paging: paginated.paging,
  total: paginated.total,
  filter,
});

/**
 * Chuẩn hóa thông số pagination
 */
export const normalizePagination = (
  pagination: Partial<PagingDTO>,
): PagingDTO => {
  return {
    page: Math.max(1, pagination.page || 1),
    limit: Math.min(100, Math.max(1, pagination.limit || 10)),
    sortBy: pagination.sortBy || 'createdAt',
    sortOrder: (['asc', 'desc'].includes(pagination.sortOrder?.toLowerCase())
      ? pagination.sortOrder?.toLowerCase()
      : 'desc') as 'asc' | 'desc',
  };
};

/**
 * Tạo cấu hình SwaggerDoc cho controller
 */
export const createSwaggerDocs = (
  options: CrudControllerOptions,
  entityName: string,
) => {
  const { description, swagger } = options;

  return {
    tags: swagger?.tags || [entityName],
    description: description || `API endpoints for ${entityName}`,
  };
};

/**
 * Tạo mô tả cho từng endpoint
 */
export const createEndpointDescription = (
  endpoint: string,
  entityName: string,
  options?: CrudControllerOptions,
) => {
  const endpointConfig = options?.endpoints?.[endpoint];

  if (endpointConfig?.description) {
    return endpointConfig.description;
  }

  // Mô tả mặc định
  switch (endpoint) {
    case 'getAll':
      return `Get list of ${entityName} with pagination`;
    case 'getOne':
      return `Get single ${entityName} by ID`;
    case 'create':
      return `Create new ${entityName}`;
    case 'update':
      return `Update an existing ${entityName}`;
    case 'delete':
      return `Delete an ${entityName}`;
    case 'count':
      return `Count ${entityName} based on filters`;
    default:
      return `Operation on ${entityName}`;
  }
};

/**
 * Xác định xem endpoint có được bật không
 */
export const isEndpointEnabled = (
  endpoint: string,
  options?: CrudControllerOptions,
): boolean => {
  if (!options?.endpoints) {
    return true; // Mặc định là bật nếu không có cấu hình
  }

  const endpointConfig = options.endpoints[endpoint];
  return endpointConfig?.enabled !== false; // Mặc định là bật trừ khi cấu hình tắt
};

/**
 * Tạo đối tượng cấu hình CRUD từ class DTO
 */
export const createCrudOptionsFromDto = <T, C, U, F = any>(params: {
  entityName: string;
  createDtoClass?: Type<C> | ZodSchema;
  updateDtoClass?: Type<U> | ZodSchema;
  filterDtoClass?: Type<F> | ZodSchema;
  roles?: {
    getAll?: string[];
    getOne?: string[];
    create?: string[];
    update?: string[];
    delete?: string[];
    count?: string[];
  };
}): CrudControllerOptions<T, C, U, F> => {
  const { entityName, createDtoClass, updateDtoClass, filterDtoClass, roles } =
    params;

  return {
    entityName,
    endpoints: {
      getAll: {
        enabled: true,
        roles: roles?.getAll,
      },
      getOne: {
        enabled: true,
        roles: roles?.getOne,
      },
      create: {
        enabled: true,
        roles: roles?.create,
      },
      update: {
        enabled: true,
        roles: roles?.update,
      },
      delete: {
        enabled: true,
        roles: roles?.delete,
      },
      count: {
        enabled: true,
        roles: roles?.count,
      },
    },
    dtoValidation: {
      createDtoClass,
      updateDtoClass,
      filterDtoClass,
    },
    swagger: {
      tags: [entityName],
    },
  };
};
