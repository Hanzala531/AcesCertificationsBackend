import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiParam,
  ApiExtraModels,
} from '@nestjs/swagger';
import { UpdateAccountStatusDto } from '../dto/update-profile.dto';
import {
  PermissionArrayDto,
  PermissionDto,
} from '../../employee/dto/permission.dto';

// Error response schema
const errorResponseSchema = (
  statusCode: number,
  message: string,
  path: string = '/api/subadmins/profile',
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
const SUBADMIN_PROFILE_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: '660e8400-e29b-41d4-a716-446655440001',
  first_name: 'Jane',
  last_name: 'Smith',
  profile_picture:
    'https://res.cloudinary.com/account/image/upload/v123/subadmins/profile.jpg',
  created_at: '2026-01-13T12:00:00.000Z',
  updated_at: '2026-01-13T12:00:00.000Z',
};

const GET_PROFILE_RESPONSE = {
  message: 'Profile retrieved successfully',
  data: SUBADMIN_PROFILE_EXAMPLE,
};

const UPDATE_PROFILE_RESPONSE = {
  message: 'Profile updated successfully',
  data: SUBADMIN_PROFILE_EXAMPLE,
};

const UPDATE_EMAIL_RESPONSE = {
  message: 'Email updated successfully',
  userId: '660e8400-e29b-41d4-a716-446655440001',
  email: 'newemail@example.com',
};

const UPDATE_PASSWORD_RESPONSE = {
  message: 'Password updated successfully',
  userId: '660e8400-e29b-41d4-a716-446655440001',
};

const DELETE_PROFILE_RESPONSE = {
  message: 'Profile deleted successfully',
  data: null,
};

const LIST_SUBADMINS_RESPONSE = {
  message: 'Subadmins retrieved successfully',
  data: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      profile_picture:
        'https://res.cloudinary.com/account/image/upload/v123/subadmins/profile.jpg',
      accountStatus: true,
      permissions: [
        { resource: 'reports', action: ['read', 'write'] },
        { resource: 'assessments', action: ['read'] },
      ],
    },
  ],
  total: 1,
};

const UPDATE_ACCOUNT_STATUS_RESPONSE = {
  message: 'Account status updated successfully',
  data: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    accountStatus: false,
  },
};

const GRANT_PERMISSIONS_RESPONSE = {
  message: 'Permissions granted',
  data: [
    { resource: 'reports', action: ['read', 'write'] },
    { resource: 'assessments', action: ['read'] },
  ],
};

const REMOVE_PERMISSIONS_RESPONSE = {
  message: 'Permissions removed',
  data: [{ resource: 'reports', action: ['read'] }],
};

export const SwaggerGetSubadminProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get subadmin profile',
      description:
        'Retrieve the authenticated subadmin profile with all details.',
    }),
    ApiOkResponse({
      description: 'Profile retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string', format: 'uuid' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              profile_picture: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: GET_PROFILE_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Subadmin profile not found',
      schema: errorResponseSchema(404, 'Subadmin profile not found'),
    }),
  );

export const SwaggerGetSubadminProfileById = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get subadmin profile by ID',
      description: 'Retrieve a subadmin profile by subadmin ID. Admin only.',
    }),
    ApiParam({ name: 'subadminId', description: 'Subadmin UUID' }),
    ApiOkResponse({
      description: 'Profile retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string', format: 'uuid' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              profile_picture: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: GET_PROFILE_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Subadmin profile not found',
      schema: errorResponseSchema(404, 'Subadmin profile not found'),
    }),
  );

export const SwaggerUpdateSubadminProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update subadmin profile',
      description: `Update subadmin profile information (first name, last name, profile picture URL, account status).

**Constraints:**
- Profile picture URLs must be from Cloudinary (pattern: https://res.cloudinary.com/...)
- Email and password changes require OTP verification via separate endpoints
- Admin can update any subadmin by providing subadminId query parameter
- **Account Status**: Only admin users can update accountStatus field. Non-admin users will receive an error if they attempt to update it.`,
    }),
    ApiQuery({
      name: 'subadminId',
      required: false,
      type: 'string',
      description:
        'Subadmin ID (optional, required only when admin updates another subadmin). Must be a valid UUID.',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          first_name: { type: 'string', example: 'Jane' },
          last_name: { type: 'string', example: 'Smith' },
          profile_picture_url: {
            type: 'string',
            example:
              'https://res.cloudinary.com/account/image/upload/v123/subadmins/profile.jpg',
          },
          accountStatus: {
            type: 'boolean',
            example: true,
            description:
              'Account status (true = active, false = inactive). Only admin can update this field.',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Profile updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string', format: 'uuid' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              profile_picture: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: UPDATE_PROFILE_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description:
        'Invalid profile picture URL (must be from Cloudinary) or non-admin attempting to update accountStatus',
      schema: errorResponseSchema(
        400,
        'Profile picture URL must be from Cloudinary',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Subadmin profile not found',
      schema: errorResponseSchema(404, 'Subadmin profile not found'),
    }),
  );

export const SwaggerUpdateSubadminEmail = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update subadmin email (requires OTP)',
      description: `Update email address with OTP verification.

**Requirements:**
- Must first call send-otp endpoint with purpose "email_verification"
- OTP must not be expired
- OTP must not have been used already
- New email must not already be in use by another account`,
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'newemail@example.com',
          },
          otp: { type: 'string', example: '123456' },
        },
      },
    }),
    ApiOkResponse({
      description: 'Email updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
        },
        example: UPDATE_EMAIL_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description:
        'Invalid OTP, expired OTP, OTP already used, or email already in use',
      schema: errorResponseSchema(
        400,
        'Invalid OTP for email verification',
        '/api/subadmins/email',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized', '/api/subadmins/email'),
    }),
  );

export const SwaggerUpdateSubadminPassword = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update subadmin password (requires OTP)',
      description: `Update password with current password verification and OTP verification.

**Requirements:**
- Must provide correct current password
- Must first call send-otp endpoint with purpose "password_reset"
- OTP must not be expired
- OTP must not have been used already`,
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['oldPassword', 'newPassword', 'otp'],
        properties: {
          oldPassword: { type: 'string', example: 'currentPassword123' },
          newPassword: { type: 'string', example: 'newSecurePassword456' },
          otp: { type: 'string', example: '123456' },
        },
      },
    }),
    ApiOkResponse({
      description: 'Password updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
        },
        example: UPDATE_PASSWORD_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description:
        'Current password incorrect, invalid OTP, expired OTP, or OTP already used',
      schema: errorResponseSchema(
        400,
        'Current password is incorrect',
        '/api/subadmins/password',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/subadmins/password',
      ),
    }),
    ApiInternalServerErrorResponse({
      description: 'Failed to update password due to server error',
      schema: errorResponseSchema(
        500,
        'Failed to update password',
        '/api/subadmins/password',
      ),
    }),
  );

export const SwaggerDeleteSubadminProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Delete subadmin profile',
      description:
        'Delete the subadmin profile. The associated user account will be marked as deleted.',
    }),
    ApiOkResponse({
      description: 'Profile deleted successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: { type: 'null', nullable: true },
        },
        example: DELETE_PROFILE_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Subadmin profile not found',
      schema: errorResponseSchema(404, 'Subadmin profile not found'),
    }),
  );

// Swagger decorator for GET /subadmins
export const SwaggerListSubadmins = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'List all subadmins (Admin only)',
      description:
        'Retrieve a paginated list of all subadmins with name, email, account status, and permissions. Returns all subadmins regardless of accountStatus. Requires admin role.',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of results per page (default: 25)',
      example: 25,
    }),
    ApiQuery({
      name: 'pageNumber',
      required: false,
      type: Number,
      description: 'Page number for pagination (default: 1)',
      example: 1,
    }),
    ApiOkResponse({
      description: 'Subadmins retrieved successfully',
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
                email: { type: 'string', format: 'email' },
                profile_picture: { type: 'string', nullable: true },
                accountStatus: { type: 'boolean' },
                permissions: {
                  type: 'array',
                  description:
                    'Array of permission objects { resource, action[] }',
                  items: {
                    type: 'object',
                    properties: {
                      resource: { type: 'string' },
                      action: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          total: { type: 'number', description: 'Total number of subadmins' },
        },
        example: LIST_SUBADMINS_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

// Swagger decorator for PUT /subadmins/:subadminId/account-status
export const SwaggerUpdateSubadminAccountStatus = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update subadmin account status (Admin only)',
      description:
        'Activate or deactivate a subadmin account. Only admins can manage account status. true = active, false = inactive.',
    }),
    ApiParam({
      name: 'subadminId',
      type: 'string',
      format: 'uuid',
      description: 'Subadmin ID to update',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      type: UpdateAccountStatusDto,
      description: 'Account status (true = active, false = inactive).',
    }),
    ApiOkResponse({
      description: 'Account status updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              accountStatus: { type: 'boolean' },
            },
          },
        },
        example: UPDATE_ACCOUNT_STATUS_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid request body',
      schema: errorResponseSchema(400, 'Invalid account status value'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Subadmin profile not found',
      schema: errorResponseSchema(
        404,
        'Subadmin profile not found',
        '/api/subadmins/:subadminId/account-status',
      ),
    }),
  );

// Swagger decorator for POST /subadmins/:subadminId/permissions/grant
export const SwaggerGrantSubadminPermissions = () =>
  applyDecorators(
    ApiExtraModels(PermissionArrayDto, PermissionDto),
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Grant permissions to subadmin (Admin only)',
      description:
        'Add one or more permissions to the specified subadmin profile. Each permission must have a `resource` and `action` (array of strings). If a permission with the same resource already exists, the actions will be merged. Requires admin role.',
    }),
    ApiParam({
      name: 'subadminId',
      type: 'string',
      format: 'uuid',
      description: 'Subadmin ID',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      type: PermissionArrayDto,
      description:
        'Body must have `permissions`: array of { resource: string, action: string[] }. Each action must be an array of strings (e.g. ["read", "write"]).',
      schema: {
        type: 'object',
        required: ['permissions'],
        properties: {
          permissions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['resource', 'action'],
              properties: {
                resource: { type: 'string', example: 'reports' },
                action: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  example: ['read', 'write'],
                  description: 'Array of action strings (e.g. read, write)',
                },
              },
            },
          },
        },
        example: {
          permissions: [
            { resource: 'reports', action: ['read', 'write'] },
            { resource: 'assessments', action: ['read'] },
          ],
        },
      },
    }),
    ApiOkResponse({
      description: 'Permissions granted successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Permissions granted' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                resource: { type: 'string', example: 'reports' },
                action: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['read', 'write'],
                },
              },
            },
            description: 'Array of granted permissions',
          },
        },
        example: GRANT_PERMISSIONS_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid permissions format',
      schema: errorResponseSchema(
        400,
        'each permission must have resource and action',
        '/api/subadmins/:subadminId/permissions/grant',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/subadmins/:subadminId/permissions/grant',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Subadmin profile not found',
      schema: errorResponseSchema(
        404,
        'Subadmin profile not found',
        '/api/subadmins/:subadminId/permissions/grant',
      ),
    }),
  );

export const SwaggerRemoveSubadminPermissions = () =>
  applyDecorators(
    ApiExtraModels(PermissionArrayDto, PermissionDto),
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Remove permissions from subadmin (Admin only)',
      description:
        'Remove one or more permissions from the specified subadmin profile. Each permission must have a `resource` and `action` (array of strings). Only the specified actions will be removed from the resource. If all actions are removed, the entire permission will be removed. Requires admin role.',
    }),
    ApiParam({
      name: 'subadminId',
      type: 'string',
      format: 'uuid',
      description: 'Subadmin ID',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      type: PermissionArrayDto,
      description:
        'Body must have `permissions`: array of { resource: string, action: string[] }. Each action must be an array of strings to remove (e.g. ["read"]).',
      schema: {
        type: 'object',
        required: ['permissions'],
        properties: {
          permissions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['resource', 'action'],
              properties: {
                resource: { type: 'string', example: 'reports' },
                action: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  example: ['read'],
                  description: 'Array of action strings to remove',
                },
              },
            },
          },
        },
        example: {
          permissions: [{ resource: 'reports', action: ['read'] }],
        },
      },
    }),
    ApiOkResponse({
      description: 'Permissions removed successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Permissions removed' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                resource: { type: 'string', example: 'reports' },
                action: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['write'],
                },
              },
            },
            description: 'Array of remaining permissions',
            nullable: true,
          },
        },
        example: REMOVE_PERMISSIONS_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid permissions format',
      schema: errorResponseSchema(
        400,
        'each permission must have resource and action',
        '/api/subadmins/:subadminId/permissions/remove',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/subadmins/:subadminId/permissions/remove',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Subadmin profile not found',
      schema: errorResponseSchema(
        404,
        'Subadmin profile not found',
        '/api/subadmins/:subadminId/permissions/remove',
      ),
    }),
  );
