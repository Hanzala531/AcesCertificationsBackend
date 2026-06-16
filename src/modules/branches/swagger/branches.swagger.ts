import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

// Error response schema
const errorResponseSchema = (statusCode: number, message: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: '/api/branches' },
  },
});

// Response examples
export const BRANCH_RESPONSE_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  organization_id: '660e8400-e29b-41d4-a716-446655440001',
  name: 'Main Branch',
  address: '123 Business St',
  city: 'New York',
  state: 'NY',
  country: 'USA',
  postal_code: '10001',
  contact_no: '+1-555-0123',
  email: 'main.branch@company.com',
  branch_size: 'Small',
  is_main: true,
  created_at: '2026-01-13T12:00:00.000Z',
  updated_at: '2026-01-13T12:00:00.000Z',
};

export const BRANCH_LIST_RESPONSE_EXAMPLE = {
  message: 'Branches retrieved successfully',
  data: [BRANCH_RESPONSE_EXAMPLE],
  pagination: {
    total: 5,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  },
};

export const BRANCH_CREATED_RESPONSE_EXAMPLE = {
  message: 'Branch created successfully',
  data: BRANCH_RESPONSE_EXAMPLE,
};

export const BRANCH_UPDATED_RESPONSE_EXAMPLE = {
  message: 'Branch updated successfully',
  data: {
    ...BRANCH_RESPONSE_EXAMPLE,
    name: 'Updated Branch Name',
    updated_at: '2026-01-13T13:00:00.000Z',
  },
};

export const BRANCH_DELETED_RESPONSE_EXAMPLE = {
  message: 'Branch deleted successfully',
};

export const SET_MAIN_BRANCH_RESPONSE_EXAMPLE = {
  message: 'Main branch updated successfully',
  data: {
    ...BRANCH_RESPONSE_EXAMPLE,
    is_main: true,
    updated_at: '2026-01-13T13:00:00.000Z',
  },
};

export const SwaggerCreateBranch = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create a new branch',
      description:
        'Organization admin can create new branches. The first branch created is automatically set as the main branch. Branch details such as address, contact information, and email are optional.',
    }),
    ApiBody({
      description: 'Branch creation data',
      schema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 2,
            example: 'New York Branch',
            description: 'Branch name (minimum 2 characters)',
          },
          branch_size: {
            type: 'string',
            example: 'Small',
            description:
              'Size/category of the branch (e.g. Small, Medium, Large)',
          },
          address: {
            type: 'string',
            example: '123 Business Avenue',
            description: 'Street address (optional)',
          },
          city: {
            type: 'string',
            example: 'New York',
            description: 'City (optional)',
          },
          state: {
            type: 'string',
            example: 'NY',
            description: 'State (optional)',
          },
          country: {
            type: 'string',
            example: 'USA',
            description: 'Country (optional)',
          },
          postal_code: {
            type: 'string',
            example: '10001',
            description: 'Postal/ZIP code (optional)',
          },
          contact_no: {
            type: 'string',
            example: '+1-555-0123',
            description: 'Contact phone number (optional)',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'ny.branch@company.com',
            description: 'Branch email address (optional)',
          },
          is_main: {
            type: 'boolean',
            example: false,
            description:
              'Set as main branch (optional, defaults to true for first branch)',
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Branch successfully created',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              organization_id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              address: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              state: { type: 'string', nullable: true },
              country: { type: 'string', nullable: true },
              postal_code: { type: 'string', nullable: true },
              contact_no: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
              branch_size: { type: 'string', nullable: true },
              is_main: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: BRANCH_CREATED_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have organization role',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiBadRequestResponse({
      description: 'Validation error or organization not properly set up',
      schema: errorResponseSchema(
        400,
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      ),
    }),
  );

// Swagger decorator for GET /branches
export const SwaggerListBranches = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'List all branches of an organization',
      description:
        "Retrieve paginated list of all branches belonging to the authenticated user's organization. Organization owner or members can view branches. Maximum 100 results per page.",
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of results per page (default: 10, max: 100)',
      example: 10,
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (default: 1)',
      example: 1,
    }),
    ApiQuery({
      name: 'all',
      required: false,
      type: String,
      description:
        'If set to true, return all branches for the organization (no pagination)',
      example: 'true',
    }),
    ApiOkResponse({
      description: 'Branches retrieved successfully',
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
                organization_id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                address: { type: 'string', nullable: true },
                city: { type: 'string', nullable: true },
                state: { type: 'string', nullable: true },
                country: { type: 'string', nullable: true },
                postal_code: { type: 'string', nullable: true },
                contact_no: { type: 'string', nullable: true },
                email: { type: 'string', nullable: true },
                is_main: { type: 'boolean' },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
              },
            },
          },
          pagination: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              page: { type: 'number' },
              pageSize: { type: 'number' },
              totalPages: { type: 'number' },
            },
          },
        },
        example: BRANCH_LIST_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have organization role',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiBadRequestResponse({
      description: 'Organization context missing from token',
      schema: errorResponseSchema(
        400,
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      ),
    }),
  );

// GET /branches/:branchId
export const SwaggerGetBranch = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get branch details',
      description:
        'Retrieve detailed information about a specific branch. User must have access to the organization that owns this branch.',
    }),
    ApiParam({
      name: 'branchId',
      description: 'Branch UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      description: 'Branch details retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              organization_id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              address: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              state: { type: 'string', nullable: true },
              country: { type: 'string', nullable: true },
              postal_code: { type: 'string', nullable: true },
              contact_no: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
              is_main: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: {
          message: 'Branch retrieved successfully',
          data: BRANCH_RESPONSE_EXAMPLE,
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have organization role',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiNotFoundResponse({
      description: 'Branch not found or user does not have access',
      schema: errorResponseSchema(
        404,
        'Branch not found or you do not have access to it',
      ),
    }),
    ApiBadRequestResponse({
      description: 'Organization context missing from token',
      schema: errorResponseSchema(
        400,
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      ),
    }),
  );

// PUT /branches/:branchId
export const SwaggerUpdateBranch = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update branch details',
      description:
        'Update information for an existing branch. Only organization admin can update branches. All fields are optional - only provide fields you want to update.',
    }),
    ApiParam({
      name: 'branchId',
      description: 'Branch UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      description: 'Branch update data (all fields optional)',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 2,
            example: 'East Coast Regional Office',
            description: 'Branch name (minimum 2 characters)',
          },
          address: {
            type: 'string',
            example: '456 New Street',
            description: 'Street address',
          },
          city: {
            type: 'string',
            example: 'Boston',
            description: 'City',
          },
          state: {
            type: 'string',
            example: 'MA',
            description: 'State',
          },
          country: {
            type: 'string',
            example: 'USA',
            description: 'Country',
          },
          postal_code: {
            type: 'string',
            example: '02101',
            description: 'Postal/ZIP code',
          },
          contact_no: {
            type: 'string',
            example: '+1-555-9999',
            description: 'Contact phone number',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'newemail@company.com',
            description: 'Branch email address',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Branch updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              organization_id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              address: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              state: { type: 'string', nullable: true },
              country: { type: 'string', nullable: true },
              postal_code: { type: 'string', nullable: true },
              contact_no: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
              is_main: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: BRANCH_UPDATED_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have organization role',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiNotFoundResponse({
      description: 'Branch not found or user does not have access',
      schema: errorResponseSchema(
        404,
        'Branch not found or you do not have access to it',
      ),
    }),
    ApiBadRequestResponse({
      description: 'Validation error or organization context missing',
      schema: errorResponseSchema(
        400,
        'Branch name must be at least 2 characters',
      ),
    }),
  );

//  DELETE /branches/:branchId
export const SwaggerDeleteBranch = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Delete a branch',
      description:
        'Remove a branch from the organization. Only organization admin can delete branches. This action cannot be undone. Returns a confirmation message, not 204 No Content.',
    }),
    ApiParam({
      name: 'branchId',
      description: 'Branch UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      description: 'Branch deleted successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Branch deleted successfully' },
        },
        example: BRANCH_DELETED_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have organization role',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiNotFoundResponse({
      description: 'Branch not found or user does not have access',
      schema: errorResponseSchema(
        404,
        'Branch not found or you do not have access to it',
      ),
    }),
    ApiBadRequestResponse({
      description: 'Organization context missing from token',
      schema: errorResponseSchema(
        400,
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      ),
    }),
  );

// PUT /branches/:branchId/set-main
export const SwaggerSetMainBranch = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Set branch as main',
      description:
        'Set a specific branch as the main branch. All other branches in the organization will be marked as non-main.',
    }),
    ApiParam({
      name: 'branchId',
      description: 'Branch UUID to set as main',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      description: 'Main branch updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              organization_id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              address: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              state: { type: 'string', nullable: true },
              country: { type: 'string', nullable: true },
              postal_code: { type: 'string', nullable: true },
              contact_no: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
              is_main: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: SET_MAIN_BRANCH_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have organization role',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiNotFoundResponse({
      description: 'Branch not found or user does not have access',
      schema: errorResponseSchema(
        404,
        'Branch not found or you do not have access to it',
      ),
    }),
    ApiBadRequestResponse({
      description: 'Organization context missing from token',
      schema: errorResponseSchema(
        400,
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      ),
    }),
  );
