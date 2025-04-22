import { Controller, Type, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BaseCrudController } from '../base/base-crud.controller';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';
import { ICrudService } from '../interfaces/crud.interface';

/**
 * Factory function để tạo controller class
 * @param options Tùy chọn cấu hình
 * @returns Controller class
 */
export function createCrudController<T, C, U, F = any>(options: {
  service: string | symbol;
  controllerOptions: CrudControllerOptions<T, C, U, F>;
}): Type<BaseCrudController<T, C, U, F>> {
  const { service, controllerOptions } = options;

  @Controller() // Decorator rỗng, path sẽ được thiết lập bên ngoài
  @ApiTags(controllerOptions.swagger?.tags || [controllerOptions.entityName])
  class CrudControllerHost extends BaseCrudController<T, C, U, F> {
    constructor(
      @Inject(service) crudService: ICrudService<T, C, U>,
      @Inject(CRUD_OPTIONS) options: CrudControllerOptions<T, C, U, F>,
    ) {
      super(crudService, options);
    }
  }

  return CrudControllerHost;
}