import {
  applyDecorators,
  UseGuards,
  SetMetadata,
  Controller,
  Type,
} from '@nestjs/common';
import { RemoteAuthGuard, RolesGuard } from 'src/share/guard';

/**
 * Metadata keys
 */
export const CRUD_OPTIONS = 'crud:options';
export const REQUIRED_ROLES = 'roles';

/**
 * Options for CRUD controller
 */
export interface CrudControllerOptions {
  path: string;
  model: Type<any>;
  createDto: Type<any>;
  updateDto: Type<any>;
  conditionDto?: Type<any>;
  roles?: string[];
  disableEndpoints?: {
    getAll?: boolean;
    getOne?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  };
}

/**
 * Decorator to enable CRUD operations on a controller
 */
export function CrudController(options: CrudControllerOptions) {
  const { path, roles = [] } = options;

  // Default operations (все включены) - все endpoints доступны
  const endpoints = {
    getAll: !options.disableEndpoints?.getAll,
    getOne: !options.disableEndpoints?.getOne,
    create: !options.disableEndpoints?.create,
    update: !options.disableEndpoints?.update,
    delete: !options.disableEndpoints?.delete,
  };

  return applyDecorators(
    SetMetadata(CRUD_OPTIONS, {
      ...options,
      endpoints,
    }),
    SetMetadata(REQUIRED_ROLES, roles),
    Controller(path),
    UseGuards(RemoteAuthGuard, RolesGuard),
  );
}
