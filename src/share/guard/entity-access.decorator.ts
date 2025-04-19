import { SetMetadata } from '@nestjs/common';
import { ENTITY_ACCESS_KEY, EntityAccessMetadata } from './entity-access.guard';

export const EntityAccess = (type: string, paramName: string) =>
  SetMetadata<string, EntityAccessMetadata>(ENTITY_ACCESS_KEY, {
    type,
    paramName,
  });
