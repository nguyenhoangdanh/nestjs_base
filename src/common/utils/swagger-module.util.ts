// src/common/utils/swagger-module.util.ts

import { Type } from '@nestjs/common';
import { z } from 'zod';
import { generateClassFromZodSchema } from '../transformers/zod-to-class.transformer';

export function registerSwaggerModels(
  zodSchemas: Record<string, z.ZodObject<any>>,
): Type<any>[] {
  return Object.entries(zodSchemas).map(([name, schema]) => {
    return generateClassFromZodSchema(schema, name);
  });
}
