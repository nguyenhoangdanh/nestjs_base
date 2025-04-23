// src/common/decorators/api-module.decorator.ts

import { Module, Type, ModuleMetadata } from '@nestjs/common';
import { ApiExtraModels } from '@nestjs/swagger';

export function ApiModule(
  models: Type<any>[] = [],
  metadata: ModuleMetadata = {},
) {
  return (target: any) => {
    // Apply ApiExtraModels to automatically register models
    models.forEach((model) => {
      ApiExtraModels(model)(target);
    });

    // Apply original Module decorator with metadata
    return Module(metadata)(target);
  };
}
