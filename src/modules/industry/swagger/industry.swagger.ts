import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';

// Error response schema
const errorResponseSchema = (
  statusCode: number,
  message: string,
  path: string = '/api/industries',
) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: path },
  },
});

// Response examples
export const INDUSTRY_RESPONSE_EXAMPLE = {
  id: 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
  name: 'Information Technology',
  updated_at: '2026-01-13T12:00:00.000Z',
};

export const INDUSTRY_CREATED_RESPONSE_EXAMPLE = {
  message: 'Industry created successfully',
  data: INDUSTRY_RESPONSE_EXAMPLE,
};

export const INDUSTRY_LIST_RESPONSE_EXAMPLE = {
  message: 'Industries retrieved successfully',
  data: {
    data: [
      INDUSTRY_RESPONSE_EXAMPLE,
      {
        id: 'b2c3d4e5-f6a7-48b9-c0d1-e2f3a4b5c6d7',
        name: 'Healthcare',
        updated_at: '2026-01-13T12:05:00.000Z',
      },
    ],
    total: 2,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  },
};

export const INDUSTRY_SEARCH_RESPONSE_EXAMPLE = {
  message: 'Search results retrieved successfully',
  data: [INDUSTRY_RESPONSE_EXAMPLE],
};

export const INDUSTRY_GET_BY_ID_RESPONSE_EXAMPLE = {
  message: 'Industry retrieved successfully',
  data: INDUSTRY_RESPONSE_EXAMPLE,
};

export const INDUSTRY_UPDATED_RESPONSE_EXAMPLE = {
  message: 'Industry updated successfully',
  data: {
    id: 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
    name: 'Information Technology & Services',
    updated_at: '2026-01-13T12:05:00.000Z',
  },
};

export const INDUSTRY_DELETED_RESPONSE_EXAMPLE = {
  message: 'Industry deleted successfully',
  data: {
    id: 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
  },
};

// POST /industries
export const SwaggerCreateIndustry = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create a new industry',
      description: `Create a new industry record. Only admins can create industries.
      
**Required Role:** admin`,
    }),
    ApiBody({
      description: 'Industry data to create',
      schema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Information Technology' },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Industry successfully created',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: INDUSTRY_CREATED_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid input data or validation errors',
      schema: errorResponseSchema(400, 'name should not be empty'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'Insufficient permissions - Admin role required',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiConflictResponse({
      description: 'Industry with this name already exists',
      schema: errorResponseSchema(
        409,
        'Industry with name "Information Technology" already exists',
      ),
    }),
  );

// GET /industries
export const SwaggerGetAllIndustries = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get all industries',
      description:
        'Retrieve all industries with pagination support. This endpoint is public and does not require authentication.',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (default: 1). Must be at least 1.',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of records per page (default: 10, max: 100)',
      example: 10,
    }),
    ApiOkResponse({
      description: 'Industries retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    updated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
              total: { type: 'number' },
              page: { type: 'number' },
              pageSize: { type: 'number' },
              totalPages: { type: 'number' },
            },
          },
        },
        example: INDUSTRY_LIST_RESPONSE_EXAMPLE,
      },
    }),
  );

// GET /industries/search
export const SwaggerSearchIndustries = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Search industries',
      description:
        'Search industries by name. This endpoint is public and does not require authentication.',
    }),
    ApiQuery({
      name: 'q',
      required: true,
      type: String,
      description:
        'Search query string (matches industry names containing this text)',
      example: 'tech',
    }),
    ApiOkResponse({
      description: 'Search results retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                updated_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        example: INDUSTRY_SEARCH_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid search query',
      schema: errorResponseSchema(
        400,
        'Search query is required',
        '/api/industries/search',
      ),
    }),
  );

// GET /industries/:id
export const SwaggerGetIndustryById = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get industry by ID',
      description:
        'Retrieve a specific industry by its UUID. This endpoint is public and does not require authentication.',
    }),
    ApiParam({
      name: 'id',
      description: 'Industry UUID',
      type: 'string',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
    }),
    ApiOkResponse({
      description: 'Industry retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: INDUSTRY_GET_BY_ID_RESPONSE_EXAMPLE,
      },
    }),
    ApiNotFoundResponse({
      description: 'Industry not found',
      schema: errorResponseSchema(
        404,
        'Industry with ID "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6" not found',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
  );

// PUT /industries/:id
export const SwaggerUpdateIndustry = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update industry',
      description: `Update an existing industry by ID.
      
**Required Role:** admin`,
    }),
    ApiParam({
      name: 'id',
      description: 'Industry UUID',
      type: 'string',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
    }),
    ApiBody({
      description: 'Industry data to update',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'Information Technology & Services',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Industry successfully updated',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: INDUSTRY_UPDATED_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid input data or validation errors',
      schema: errorResponseSchema(
        400,
        'name should not be empty',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
    ApiForbiddenResponse({
      description: 'Insufficient permissions - Admin role required',
      schema: errorResponseSchema(
        403,
        'Forbidden resource',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Industry not found',
      schema: errorResponseSchema(
        404,
        'Industry with ID "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6" not found',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
    ApiConflictResponse({
      description: 'Industry with this name already exists',
      schema: errorResponseSchema(
        409,
        'Industry with name "Information Technology" already exists',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
  );

// DELETE /industries/:id
export const SwaggerDeleteIndustry = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Delete industry',
      description: `Delete an existing industry by ID. Returns the deleted industry's ID.
      
**Required Role:** admin`,
    }),
    ApiParam({
      name: 'id',
      description: 'Industry UUID',
      type: 'string',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
    }),
    ApiOkResponse({
      description: 'Industry successfully deleted',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
            },
          },
        },
        example: INDUSTRY_DELETED_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
    ApiForbiddenResponse({
      description: 'Insufficient permissions - Admin role required',
      schema: errorResponseSchema(
        403,
        'Forbidden resource',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Industry not found',
      schema: errorResponseSchema(
        404,
        'Industry with ID "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6" not found',
        '/api/industries/a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ),
    }),
  );
