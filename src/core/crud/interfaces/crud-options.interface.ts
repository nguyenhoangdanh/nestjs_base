import { UserRole } from '../../../share';
import { ICrudHooks } from './crud.interface';

/**
 * Interface định nghĩa các tùy chọn cấu hình CRUD endpoint
 */
export interface CrudEndpointOptions {
  /** Bật/tắt endpoint này */
  enabled?: boolean;
  /** Vai trò được phép truy cập endpoint này */
  roles?: UserRole[];
  /** Mô tả endpoint cho Swagger */
  description?: string;
  /** Ví dụ cho Swagger */
  examples?: Record<string, any>;
  /** Tùy chọn cache */
  cache?: {
    enabled?: boolean;
    ttl?: number;
  };
}

/**
 * Interface cho việc cấu hình CRUD controller
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 * @template F - Filter DTO type
 */
export interface CrudControllerOptions<T = any, C = any, U = any, F = any> {
  /** Tên của entity */
  entityName: string;

  /** Mô tả của module */
  description?: string;

  /** Cấu hình các endpoint */
  endpoints?: {
    getAll?: CrudEndpointOptions;
    getOne?: CrudEndpointOptions;
    create?: CrudEndpointOptions;
    update?: CrudEndpointOptions;
    delete?: CrudEndpointOptions;
    count?: CrudEndpointOptions;
  };

  /** Swagger tags */
  swagger?: {
    tags?: string[];
    description?: string;
  };

  /** Hooks lifecycle */
  hooks?: ICrudHooks<T, C, U>;

  /** Tên các DTO class để validate */
  dtoValidation?: {
    createDtoClass?: any;
    updateDtoClass?: any;
    filterDtoClass?: any;
  };
}

/**
 * Interface cho việc tạo CRUD module
 * @template T - Entity type
 * @template C - Create DTO type
 * @template U - Update DTO type
 * @template F - Filter DTO type
 */
export interface CrudModuleOptions<T, C, U, F = any> {
  /** Tên của module */
  moduleName: string;

  /** Đường dẫn API endpoint */
  path: string;

  /** Các class types */
  modelType: any;
  createDtoType: any;
  updateDtoType: any;
  filterDtoType?: any;

  /** Các class implementation */
  serviceClass: any;
  repositoryClass: any;

  /** DI tokens */
  serviceToken: string | symbol;
  repositoryToken: string | symbol;

  /** Tùy chọn controller */
  controllerOptions?: CrudControllerOptions<T, C, U, F>;

  /** Các module phụ thuộc */
  imports?: any[];

  /** Các provider bổ sung */
  providers?: any[];

  /** Các export bổ sung */
  exports?: (string | symbol | any)[];
}
