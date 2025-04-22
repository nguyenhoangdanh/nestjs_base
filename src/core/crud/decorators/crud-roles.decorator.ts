import { SetMetadata } from '@nestjs/common';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';

/**
 * Metadata key for CRUD options
 */
export const CRUD_OPTIONS = 'crud:options';

/**
 * Enum for endpoint types
 */
export enum CrudEndpointType {
  GET_ALL = 'getAll',
  GET_ONE = 'getOne',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  COUNT = 'count',
}

/**
 * Decorator để cấu hình CRUD controller
 * @param options Tùy chọn cấu hình
 */
export function CrudController<T, C, U, F = any>(
  options: CrudControllerOptions<T, C, U, F>,
) {
  return SetMetadata(CRUD_OPTIONS, options);
}

/**
 * Decorator để đánh dấu endpoint cụ thể
 */
export function CrudEndpoint(endpoint: CrudEndpointType) {
  return SetMetadata('crud:endpoint', endpoint);
}

/**
 * Decorator để tắt một endpoint cụ thể
 */
export function DisableEndpoint(endpoint: CrudEndpointType) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    // Set metadata để đánh dấu endpoint này bị tắt
    SetMetadata(`crud:disabled:${endpoint}`, true)(target, key, descriptor);
    return descriptor;
  };
}

/**
 * Decorator để bật một endpoint cụ thể
 */
export function EnableEndpoint(endpoint: CrudEndpointType) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    // Set metadata để đánh dấu endpoint này được bật
    SetMetadata(`crud:enabled:${endpoint}`, true)(target, key, descriptor);
    return descriptor;
  };
}

/**
 * Decorator để cấu hình cache cho một endpoint
 */
export function CrudCache(ttl: number = 60) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    // Set metadata để cấu hình cache
    SetMetadata('crud:cache:ttl', ttl)(target, key, descriptor);
    return descriptor;
  };
}

/**
 * Decorator để cấu hình pagination cho endpoint getAll
 */
export function CrudPagination(
  defaultPageSize: number = 10,
  maxPageSize: number = 100,
) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    // Set metadata để cấu hình pagination
    SetMetadata('crud:pagination', { defaultPageSize, maxPageSize })(
      target,
      key,
      descriptor,
    );
    return descriptor;
  };
}

/**
 * Decorator để cấu hình sorting cho endpoint getAll
 */
export function CrudSorting(
  defaultSortBy: string,
  defaultSortOrder: 'asc' | 'desc' = 'desc',
) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    // Set metadata để cấu hình sorting
    SetMetadata('crud:sorting', { defaultSortBy, defaultSortOrder })(
      target,
      key,
      descriptor,
    );
    return descriptor;
  };
}
