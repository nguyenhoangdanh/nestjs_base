// src/common/factories/controller.factory.ts

import { z } from 'zod';
import { generateClassFromZodSchema } from '../transformers/zod-to-class.transformer';
import {
  ApiCreateDoc,
  ApiGetDoc,
  ApiGetListDoc,
  ApiUpdateDoc,
  ApiDeleteDoc,
} from '../decorators/swagger.decorator';
import { ApiController } from '../decorators/api-controller.decorator';

export function createControllerWithSwagger(
  tag: string,
  path: string,
  zodSchema: z.ZodObject<any>,
  options = {
    enableCreate: true,
    enableGet: true,
    enableList: true,
    enableUpdate: true,
    enableDelete: true,
  },
) {
  // Generate DTO class from Zod schema
  const DTOClass = generateClassFromZodSchema(zodSchema, `${tag}DTO`);

  // Create decorator factory
  @ApiController(tag, path)
  class BaseController {
    constructor() {}

    // Apply appropriate decorators based on options
    @ApiGetDoc(DTOClass, { summary: `Get ${tag}` })
    getOne() {}

    @ApiGetListDoc(DTOClass, { summary: `List ${tag}` })
    getMany() {}

    @ApiCreateDoc(DTOClass, DTOClass, { summary: `Create ${tag}` })
    create() {}

    @ApiUpdateDoc(DTOClass, { summary: `Update ${tag}` })
    update() {}

    @ApiDeleteDoc({ summary: `Delete ${tag}` })
    delete() {}
  }

  return BaseController;
}
