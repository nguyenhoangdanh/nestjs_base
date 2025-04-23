// src/common/utils/module-helpers.ts

import { z } from 'zod';
import { generateClassFromZodSchema } from '../transformers/zod-to-class.transformer';
import {
  ApiCreateDoc,
  ApiDeleteDoc,
  ApiGetDoc,
  ApiGetListDoc,
  ApiUpdateDoc,
} from '../decorators/swagger.decorator';

export function createSwaggerResources(
  modelName: string,
  zodSchema: z.ZodObject<any>,
) {
  const DTOClass = generateClassFromZodSchema(zodSchema, `${modelName}DTO`);

  return {
    DTOClass,
    getOneDecorator: () => ApiGetDoc(DTOClass, { summary: `Get ${modelName}` }),
    getListDecorator: () =>
      ApiGetListDoc(DTOClass, { summary: `List ${modelName}s` }),
    createDecorator: () =>
      ApiCreateDoc(DTOClass, DTOClass, { summary: `Create ${modelName}` }),
    updateDecorator: () =>
      ApiUpdateDoc(DTOClass, { summary: `Update ${modelName}` }),
    deleteDecorator: () => ApiDeleteDoc({ summary: `Delete ${modelName}` }),
  };
}
