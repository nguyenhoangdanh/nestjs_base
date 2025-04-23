// src/common/decorators/swagger.decorator.ts

import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  getSchemaPath,
  ApiExtraModels,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';

interface ApiDocOptions {
  summary?: string;
  description?: string;
}

export function ApiGetDoc<T extends Type<any>>(
  model: T,
  options: ApiDocOptions = {},
) {
  return applyDecorators(
    ApiOperation({
      summary: options.summary || 'Get resource',
      description: options.description,
    }),
    ApiExtraModels(model),
    ApiOkResponse({
      description: 'Successfully retrieved the resource',
      schema: {
        allOf: [{ $ref: getSchemaPath(model) }],
      },
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Resource not found' }),
  );
}

export function ApiGetListDoc<T extends Type<any>>(
  model: T,
  options: ApiDocOptions = {},
) {
  return applyDecorators(
    ApiOperation({
      summary: options.summary || 'Get list of resources',
      description: options.description,
    }),
    ApiExtraModels(model),
    ApiOkResponse({
      description: 'Successfully retrieved list of resources',
      schema: {
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          total: {
            type: 'number',
            description: 'Total number of records',
          },
          page: {
            type: 'number',
            description: 'Current page',
          },
          limit: {
            type: 'number',
            description: 'Items per page',
          },
        },
      },
    }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'sortBy', required: false }),
    ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function ApiCreateDoc<T extends Type<any>, R extends Type<any>>(
  requestModel: T,
  responseModel: R,
  options: ApiDocOptions = {},
) {
  return applyDecorators(
    ApiOperation({
      summary: options.summary || 'Create a new resource',
      description: options.description,
    }),
    ApiExtraModels(requestModel, responseModel),
    ApiBody({ type: requestModel }),
    ApiCreatedResponse({
      description: 'The resource has been successfully created',
      schema: {
        allOf: [{ $ref: getSchemaPath(responseModel) }],
      },
    }),
    ApiResponse({ status: 400, description: 'Bad request' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

export function ApiUpdateDoc<T extends Type<any>>(
  model: T,
  options: ApiDocOptions = {},
) {
  return applyDecorators(
    ApiOperation({
      summary: options.summary || 'Update a resource',
      description: options.description,
    }),
    ApiExtraModels(model),
    ApiParam({ name: 'id', type: 'string', description: 'Resource ID' }),
    ApiBody({ type: model }),
    ApiOkResponse({
      description: 'The resource has been successfully updated',
      schema: {
        properties: {
          message: {
            type: 'string',
            example: 'Resource has been updated successfully',
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Bad request' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Resource not found' }),
  );
}

export function ApiDeleteDoc(options: ApiDocOptions = {}) {
  return applyDecorators(
    ApiOperation({
      summary: options.summary || 'Delete a resource',
      description: options.description,
    }),
    ApiParam({ name: 'id', type: 'string', description: 'Resource ID' }),
    ApiOkResponse({
      description: 'The resource has been successfully deleted',
      schema: {
        properties: {
          message: {
            type: 'string',
            example: 'Resource has been deleted successfully',
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Bad request' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 404, description: 'Resource not found' }),
  );
}
