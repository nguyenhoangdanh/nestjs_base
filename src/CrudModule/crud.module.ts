import { DynamicModule, Type, Provider, Controller } from '@nestjs/common';
import { createCrudController } from './base-crud.controller';
import { BaseCrudService } from './base-crud.service';
import { BasePrismaRepository } from './base-prisma.repository';
import { CRUD_OPTIONS } from './crud.decorator';

/**
 * Options for creating a CRUD module
 */
export interface CrudModuleOptions<T, C, U, F = any> {
  // Basic module info
  moduleName: string;
  path: string;

  // Class definitions
  modelType: Type<T>;
  createDtoType: Type<C>;
  updateDtoType: Type<U>;
  filterDtoType?: Type<F>;

  // Custom implementations
  serviceClass: Type<BaseCrudService<T, C, U>>;
  repositoryClass: Type<BasePrismaRepository<T, C, U>>;

  // DI tokens
  serviceToken: string | symbol;
  repositoryToken: string | symbol;

  // Other options
  imports?: any[];
  providers?: Provider[];
  exports?: (string | symbol | Provider)[];
}

/**
 * Create a dynamic CRUD module
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
    imports = [],
    providers = [],
    exports = [],
  } = options;

  // Create controller using factory
  const CrudControllerClass = createCrudController<T, C, U, F>({
    service: serviceToken,
    modelName: moduleName,
  });

  // Add Controller decorator metadata manually
  Controller(path)(CrudControllerClass);

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
    // Add CRUD_OPTIONS provider so it's available to the controller
    {
      provide: CRUD_OPTIONS,
      useValue: {
        endpoints: {
          getAll: true,
          getOne: true,
          create: true,
          update: true,
          delete: true,
        },
        model: modelType,
        createDto: createDtoType,
        updateDto: updateDtoType,
        conditionDto: filterDtoType,
        path: path,
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
