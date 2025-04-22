// src/core/modules/crud-module.factory.ts
import { DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseEntity } from '../entities/base.entity';

interface CrudModuleOptions
  Entity extends BaseEntity,
  Repository,
  Service,
  Controller
> {
  entity: Type<Entity>;
  repository: Type<Repository>;
  service: Type<Service>;
  controller: Type<Controller>;
  imports?: any[];
  providers?: any[];
  exports?: any[];
}

export function createCrudModule<
  Entity extends BaseEntity,
  Repository,
  Service,
  Controller
>(options: CrudModuleOptions<Entity, Repository, Service, Controller>): DynamicModule {
  const {
    entity,
    repository,
    service,
    controller,
    imports = [],
    providers = [],
    exports = [],
  } = options;

  return {
    module: class {},
    imports: [
      TypeOrmModule.forFeature([entity]),
      ...imports,
    ],
    controllers: [controller],
    providers: [
      repository,
      service,
      ...providers,
    ],
    exports: [
      repository,
      service,
      ...exports,
    ],
  };
}