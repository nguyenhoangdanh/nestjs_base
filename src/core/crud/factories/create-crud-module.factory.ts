import { DynamicModule, Type, Provider } from '@nestjs/common';
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
    modelType,
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

  // Tạo controller từ factory
  const CrudControllerClass = createCrudController<T, C, U, F>({
    service: serviceToken,
    controllerOptions: controllerOptions || {
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
    },
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
      useValue: controllerOptions || {
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
      },
    },
    ...providers,
  ];

  // Define exports
  const moduleExports = [serviceToken, repositoryToken, ...exports];

  // Create the module
  return {
    module: class {},
    controllers: [CrudControllerClass],
    providers: moduleProviders,
    imports,
    exports: moduleExports,
  };
}
