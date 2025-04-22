import { Controller, Type, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BaseCrudController } from '../base/base-crud.controller';
import { CRUD_OPTIONS } from '../decorators/crud-endpoint.decorator';
import { CrudControllerOptions } from '../interfaces/crud-options.interface';
import { ICrudService } from '../interfaces/crud.interface';
import { Logger } from '@nestjs/common';

/**
 * Factory function để tạo controller class
 * @param options Tùy chọn cấu hình
 * @returns Controller class
 */
export function createCrudController<T, C, U, F = any>(options: {
  service: string | symbol;
  controllerOptions: CrudControllerOptions<T, C, U, F>;
  path?: string;
}): Type<BaseCrudController<T, C, U, F>> {
  const { service, controllerOptions } = options;
  const logger = new Logger('CrudControllerFactory');

  // Xác định path và tags
  const controllerPath = options.path || '';
  const apiTags = controllerOptions.swagger?.tags || [
    controllerOptions.entityName,
  ];

  @Controller(controllerPath)
  @ApiTags(...apiTags)
  class ControllerClass extends BaseCrudController<T, C, U, F> {
    constructor(
      @Inject(service) crudService: ICrudService<T, C, U>,
      @Inject(CRUD_OPTIONS) options: CrudControllerOptions<T, C, U, F>,
    ) {
      super(crudService, options);
      logger.log(`Created CRUD controller for ${options.entityName}`);
    }
  }

  return ControllerClass;
}
