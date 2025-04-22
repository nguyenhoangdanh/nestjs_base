import { DynamicModule, Provider, Logger } from '@nestjs/common';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import { CrudModuleOptions } from '../interfaces/crud-options.interface';
import { createCrudController } from './create-crud-controller.factory';

/**
 * Factory function để tạo CRUD module
 * @param options Tùy chọn cấu hình module
 * @returns Dynamic module
 */
export function createCrudModule<T, C, U, F = any>(
  options: CrudModuleOptions<T, C, U, F>,
): DynamicModule {
  const {
    moduleName,
    path,
    createDtoType,
    updateDtoType,
    filterDtoType,
    serviceClass,
    repositoryClass,
    serviceToken,
    repositoryToken,
    controllerOptions,
    imports = [],
    providers = [],
    exports = [],
  } = options;

  const logger = new Logger('CrudModuleFactory');
  logger.log(`Creating CRUD module for entity: ${moduleName}`);

  // Prepare controller options
  const finalControllerOptions = controllerOptions || {
    entityName: moduleName,
    endpoints: {
      getAll: { enabled: true },
      getOne: { enabled: true },
      create: { enabled: true },
      update: { enabled: true },
      delete: { enabled: true },
      count: { enabled: true },
    },
    dtoValidation: {
      createDtoClass: createDtoType,
      updateDtoClass: updateDtoType,
      filterDtoClass: filterDtoType,
    },
    swagger: {
      tags: [moduleName],
    },
  };

  // Tạo controller từ factory
  const CrudControllerClass = createCrudController<T, C, U, F>({
    service: serviceToken,
    controllerOptions: finalControllerOptions,
    path: path,
  });

  // Define providers
  const moduleProviders: Provider[] = [
    {
      provide: repositoryToken,
      useClass: repositoryClass,
    },
    {
      provide: serviceToken,
      useClass: serviceClass,
    },
    // Thêm options vào providers để có thể inject
    {
      provide: CRUD_OPTIONS,
      useValue: finalControllerOptions,
    },
    ...providers,
  ];

  // Define exports
  const moduleExports = [serviceToken, repositoryToken, ...exports];

  // Create a class name for the dynamic module
  // This helps with debugging and understanding the module structure
  const className = `${moduleName}CrudModule`;

  // Create the dynamic module
  const dynamicModule: DynamicModule = {
    module: class {},
    controllers: [CrudControllerClass],
    providers: moduleProviders,
    imports,
    exports: moduleExports,
  };

  // Set the module class name for better debugging
  Object.defineProperty(dynamicModule.module, 'name', { value: className });

  logger.log(`CRUD module created: ${className}`);

  return dynamicModule;
}
