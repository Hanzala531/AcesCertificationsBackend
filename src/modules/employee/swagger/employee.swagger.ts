import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiParam,
  ApiQuery,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';

// Common error response schema
const errorResponseSchema = (statusCode: number, message: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: '/api/employee' },
  },
});

// Response Examples
export const EMPLOYEE_RESPONSE_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: '660e8400-e29b-41d4-a716-446655440001',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  organization_id: '770e8400-e29b-41d4-a716-446655440002',
  position: 'Senior Developer',
  department: 'Engineering',
  branch_id: '880e8400-e29b-41d4-a716-446655440003',
  profile_picture: null,
  permissions: [{ resource: 'reports', action: ['read'] }],
  status: 'active',
  created_at: '2026-01-13T12:00:00.000Z',
  updated_at: '2026-01-13T12:00:00.000Z',
};

const EMPLOYEE_LIST_ITEM_RESPONSE_EXAMPLE = {
  ...EMPLOYEE_RESPONSE_EXAMPLE,
  image: null,
};

export const EMPLOYEE_LIST_RESPONSE_EXAMPLE = {
  message: 'Employees retrieved successfully',
  data: [EMPLOYEE_LIST_ITEM_RESPONSE_EXAMPLE],
  pagination: {
    total: 25,
    page: 1,
    pageSize: 10,
    totalPages: 3,
  },
};

export const EMPLOYEE_CREATED_RESPONSE_EXAMPLE = {
  message:
    'Employee account created successfully. Login credentials sent to email.',
  data: EMPLOYEE_RESPONSE_EXAMPLE,
};

export const EMPLOYEE_DELETED_RESPONSE_EXAMPLE = {
  message: 'Employee deleted successfully',
};

export const MY_PROFILE_RESPONSE_EXAMPLE = {
  message: 'Employee profile retrieved successfully',
  data: EMPLOYEE_RESPONSE_EXAMPLE,
};

export const UPDATE_EMPLOYEE_PROFILE_RESPONSE_EXAMPLE = {
  message: 'Profile updated successfully',
  data: EMPLOYEE_RESPONSE_EXAMPLE,
};

export const UPDATE_EMPLOYEE_EMAIL_RESPONSE_EXAMPLE = {
  message: 'Email updated successfully',
  userId: '660e8400-e29b-41d4-a716-446655440001',
  email: 'newemail@example.com',
};

export const UPDATE_EMPLOYEE_PASSWORD_RESPONSE_EXAMPLE = {
  message: 'Password updated successfully',
  userId: '660e8400-e29b-41d4-a716-446655440001',
};

const PERMISSION_ITEM_EXAMPLE = {
  resource: 'reports',
  action: ['read', 'write'],
};

const PERMISSIONS_BODY_EXAMPLE = {
  permissions: [
    { resource: 'reports', action: ['read', 'write'] },
    { resource: 'branches', action: ['manage'] },
  ],
};

const PERMISSIONS_REMOVE_BODY_EXAMPLE = {
  permissions: [
    { resource: 'reports', action: ['read'] },
    { resource: 'branches', action: ['manage'] },
  ],
};

// Grant Permissions
export const SwaggerGrantPermissions = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Grant permissions to an employee',
      description:
        'Add one or more permission objects to the employee permissions array. Each permission must have a `resource` and `action` (array of strings). If a permission with the same resource already exists, the actions will be merged.',
    }),
    ApiParam({
      name: 'employeeId',
      description: 'Employee UUID or user id',
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
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
                  description: 'Array of action strings',
                },
              },
            },
          },
        },
        example: PERMISSIONS_BODY_EXAMPLE,
      },
    }),
    ApiOkResponse({
      description: 'Permissions granted successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: { type: 'array', items: { type: 'object' } },
        },
      },
    }),
  );

// Remove Permissions
export const SwaggerRemovePermissions = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Remove permissions from an employee',
      description:
        'Remove one or more permission objects from the employee permissions array. Each permission must have a `resource` and `action` (array of strings). Only the specified actions will be removed from the resource. If all actions are removed, the entire permission will be removed.',
    }),
    ApiParam({
      name: 'employeeId',
      description: 'Employee UUID or user id',
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
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
        example: PERMISSIONS_REMOVE_BODY_EXAMPLE,
      },
    }),
    ApiOkResponse({
      description: 'Permissions removed successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: { type: 'array', items: { type: 'object' } },
        },
      },
    }),
  );

// Invite Employee swagger decorator
export const SwaggerInviteEmployee = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create employee account in organization',
      description:
        'Organization admin can create new employee accounts. A temporary password is automatically generated and sent to the employee email. The employee account is created with role "organization_member" and is automatically verified.',
    }),
    ApiBody({
      description: 'Employee creation data',
      schema: {
        type: 'object',
        required: ['email', 'first_name', 'last_name'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'john.doe@example.com',
            description: 'Email address for the employee account',
          },
          first_name: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            example: 'John',
            description: 'First name of the employee (2-100 characters)',
          },
          last_name: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            example: 'Doe',
            description: 'Last name of the employee (2-100 characters)',
          },
          position: {
            type: 'string',
            maxLength: 100,
            example: 'Senior Developer',
            description: 'Job position/title (optional)',
          },
          department: {
            type: 'string',
            maxLength: 100,
            example: 'Engineering',
            description: 'Department name (optional)',
          },
          profile_picture_url: {
            type: 'string',
            format: 'uri',
            example:
              'https://res.cloudinary.com/account/image/upload/v123/employees/profile.jpg',
            description: 'Profile picture URL (optional)',
          },
          branch_id: {
            type: 'string',
            format: 'uuid',
            example: '880e8400-e29b-41d4-a716-446655440003',
            description: 'Branch UUID to assign employee to (optional)',
          },
          permissions: {
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
                // scope removed
              },
            },
            description:
              'Optional array of permission objects to assign to the employee. Each permission must have a resource and action (array of strings).',
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Employee account created successfully',
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
              email: { type: 'string', format: 'email' },
              organization_id: { type: 'string', format: 'uuid' },
              position: { type: 'string', nullable: true },
              department: { type: 'string', nullable: true },
              branch_id: { type: 'string', format: 'uuid', nullable: true },
              profile_picture: { type: 'string', nullable: true },
              permissions: {
                type: 'array',
                nullable: true,
                items: { type: 'object' },
              },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: EMPLOYEE_CREATED_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not own this organization',
      schema: errorResponseSchema(
        403,
        'You do not have permission to add members to this organization',
      ),
    }),
    ApiBadRequestResponse({
      description: 'Validation error or branch not found',
      schema: errorResponseSchema(
        400,
        'Branch not found or does not belong to this organization',
      ),
    }),
    ApiConflictResponse({
      description: 'User with this email already exists',
      schema: errorResponseSchema(409, 'User with this email already exists'),
    }),
    ApiNotFoundResponse({
      description: 'Organization not found',
      schema: errorResponseSchema(404, 'Organization not found'),
    }),
  );

// Resend Invite swagger decorator
export const SwaggerResendInvite = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Resend invite to an employee',
      description:
        'Resend login credentials to an existing employee by email. Generates a new temporary password and sends it to the employee email. Only the organization owner can resend invites.',
    }),
    ApiBody({
      description: 'Employee email to resend invite to',
      schema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'john.doe@example.com',
            description: 'Email address of the employee to resend invite to',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Invite resent successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        example: {
          message:
            'Invite resent successfully. New credentials have been sent to the employee email.',
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not own this organization',
      schema: errorResponseSchema(
        403,
        'You do not have permission to manage members of this organization',
      ),
    }),
    ApiBadRequestResponse({
      description: 'Email is required',
      schema: errorResponseSchema(400, 'Email is required'),
    }),
    ApiNotFoundResponse({
      description: 'No employee found with this email in the organization',
      schema: errorResponseSchema(
        404,
        'No employee found with this email in your organization',
      ),
    }),
  );

// List Employees swagger decorator
export const SwaggerListEmployees = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'List all employees in organization',
      description:
        'Retrieve paginated list of all employees in the organization. Organization owner or organization members can view the employee list. Maximum 100 results per page.',
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
        'If set to true, return all employees for the organization (no pagination)',
      example: 'true',
    }),
    ApiOkResponse({
      description: 'Employees retrieved successfully',
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
                user_id: { type: 'string', format: 'uuid' },
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                organization_id: { type: 'string', format: 'uuid' },
                position: { type: 'string', nullable: true },
                department: { type: 'string', nullable: true },
                branch_id: { type: 'string', format: 'uuid', nullable: true },
                profile_picture: { type: 'string', nullable: true },
                image: {
                  type: 'string',
                  nullable: true,
                  description:
                    'Alias of profile_picture for client compatibility.',
                },
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
        example: EMPLOYEE_LIST_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have permission',
      schema: errorResponseSchema(
        403,
        'You do not have permission to view members of this organization',
      ),
    }),
    ApiBadRequestResponse({
      description: 'Organization context missing from token',
      schema: errorResponseSchema(
        400,
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Organization not found',
      schema: errorResponseSchema(404, 'Organization not found'),
    }),
  );

// Get Employee swagger decorator
export const SwaggerGetEmployee = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get employee details',
      description:
        'Retrieve details of a specific employee. Only the organization owner can view employee details.',
    }),
    ApiParam({
      name: 'employeeId',
      description: 'Employee UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      description: 'Employee details retrieved successfully',
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
              email: { type: 'string', format: 'email' },
              organization_id: { type: 'string', format: 'uuid' },
              position: { type: 'string', nullable: true },
              department: { type: 'string', nullable: true },
              branch_id: { type: 'string', format: 'uuid', nullable: true },
              profile_picture: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: {
          message: 'Employee details retrieved successfully',
          data: EMPLOYEE_RESPONSE_EXAMPLE,
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have permission to view this employee',
      schema: errorResponseSchema(
        403,
        'You do not have permission to view this employee',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Employee or organization not found',
      schema: errorResponseSchema(404, 'Employee not found'),
    }),
  );

// Delete Employee swagger decorator
export const SwaggerDeleteEmployee = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Delete employee from organization',
      description:
        'Remove an employee from the organization. Only organization owner can delete employees. This action cannot be undone. Returns a confirmation message.',
    }),
    ApiParam({
      name: 'employeeId',
      description: 'Employee UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      description: 'Employee deleted successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Employee deleted successfully' },
        },
        example: EMPLOYEE_DELETED_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have permission to delete this employee',
      schema: errorResponseSchema(
        403,
        'You do not have permission to delete this employee',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Employee or organization not found',
      schema: errorResponseSchema(404, 'Employee not found'),
    }),
  );

// Get My Profile swagger decorator
export const SwaggerGetMyProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get my employee profile',
      description:
        "Retrieve the authenticated employee's own profile. Only accessible to users with organization_member role.",
    }),
    ApiOkResponse({
      description: 'Employee profile retrieved successfully',
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
              email: { type: 'string', format: 'email' },
              organization_id: { type: 'string', format: 'uuid' },
              position: { type: 'string', nullable: true },
              department: { type: 'string', nullable: true },
              branch_id: { type: 'string', format: 'uuid', nullable: true },
              profile_picture: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: MY_PROFILE_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have organization_member role',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiNotFoundResponse({
      description: 'Employee profile not found',
      schema: errorResponseSchema(404, 'Employee profile not found'),
    }),
  );

export const SwaggerUpdateEmployeeProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update employee profile',
      description:
        'Update profile details. organization_member can update their own profile fields. organization can update any employee profile by passing employeeId in query and may also update status and permissions. Email and password are not updated via this API. Profile picture URL must be from Cloudinary.',
    }),
    ApiQuery({
      name: 'employeeId',
      required: false,
      type: 'string',
      description:
        'Required when role is organization. Target employee profile ID to update.',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          first_name: { type: 'string', example: 'John' },
          last_name: { type: 'string', example: 'Doe' },
          position: { type: 'string', example: 'Senior Developer' },
          department: { type: 'string', example: 'Engineering' },
          profile_picture_url: {
            type: 'string',
            example:
              'https://res.cloudinary.com/account/image/upload/v123/employees/profile.jpg',
          },
          branch_id: {
            type: 'string',
            format: 'uuid',
            example: '880e8400-e29b-41d4-a716-446655440003',
          },
          permissions: {
            type: 'array',
            description:
              'Organization-only: full permissions array replacement.',
            items: {
              type: 'object',
              required: ['resource', 'action'],
              properties: {
                resource: { type: 'string', example: 'reports' },
                action: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['read', 'write'],
                },
              },
            },
          },
          status: {
            type: 'string',
            enum: ['pending', 'active'],
            description: 'Organization-only employee status update.',
            example: 'active',
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
          data: { type: 'object' },
        },
        example: UPDATE_EMPLOYEE_PROFILE_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description:
        'Invalid profile picture URL (must be from Cloudinary) or invalid branch',
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
      description: 'Employee profile not found',
      schema: errorResponseSchema(404, 'Employee profile not found'),
    }),
  );

export const SwaggerUpdateEmployeeEmail = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update employee email (requires OTP)',
      description:
        'Update email address with OTP verification. Must call send-otp first.',
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
        example: UPDATE_EMPLOYEE_EMAIL_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid OTP, expired OTP, or email already in use',
      schema: errorResponseSchema(400, 'Invalid OTP for email verification'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

export const SwaggerUpdateEmployeePassword = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update employee password (requires OTP)',
      description:
        'Update password with current password and OTP verification.',
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
        example: UPDATE_EMPLOYEE_PASSWORD_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Current password incorrect or invalid OTP',
      schema: errorResponseSchema(400, 'Current password is incorrect'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiInternalServerErrorResponse({
      description: 'Failed to update password',
      schema: errorResponseSchema(500, 'Failed to update password'),
    }),
  );
