// src/common/decorators/api-controller.decorator.ts

import { applyDecorators, Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RemoteAuthGuard, RolesGuard } from 'src/share/guard';

export function ApiController(tag: string, path?: string) {
  return applyDecorators(
    Controller(path || ''), // Provide a default empty string if path is undefined
    ApiTags(tag),
    ApiBearerAuth(),
    UseGuards(RemoteAuthGuard, RolesGuard),
  );
}
