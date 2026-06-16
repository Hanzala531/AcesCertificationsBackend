import { applyDecorators, HttpStatus } from '@nestjs/common';
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
  ApiResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  AssignAssessmentDto,
  AssignAssessmentResponseDto,
} from '../dto/assign-assessment.dto';
import {
  UpdateAuditDateDto,
  UpdateAuditDateResponseDto,
} from '../dto/update-audit-date.dto';

const errorResponseSchema = (
  statusCode: number,
  message: string,
  path: string = '/api/auditors/profile',
) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: path },
  },
});

const AUDITOR_PROFILE_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: '660e8400-e29b-41d4-a716-446655440001',
  first_name: 'John',
  last_name: 'Doe',
  country: 'United States',
  state: 'California',
  city: 'Los Angeles',
  profile_picture:
    'https://res.cloudinary.com/account/image/upload/v123/auditors/profile.jpg',
  signature:
    'https://res.cloudinary.com/account/image/upload/v123/auditors/signature.png',
  assigned_certificates: ['cert-uuid-1', 'cert-uuid-2'],
  status: 'available',
  accountStatus: true,
  created_at: '2026-01-13T12:00:00.000Z',
  updated_at: '2026-01-13T12:00:00.000Z',
};

const GET_PROFILE_RESPONSE = {
  message: 'Profile retrieved successfully',
  data: AUDITOR_PROFILE_EXAMPLE,
};

const UPDATE_PROFILE_RESPONSE = {
  message: 'Profile updated successfully',
  data: AUDITOR_PROFILE_EXAMPLE,
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

const LIST_AUDITORS_RESPONSE = {
  message: 'Auditors retrieved successfully',
  data: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John Doe',
      email: 'john@example.com',
      profile_picture:
        'https://res.cloudinary.com/account/image/upload/v123/auditors/profile.jpg',
      country: 'United States',
      state: 'California',
      city: 'Los Angeles',
      assigned_certificates: ['cert-uuid-1', 'cert-uuid-2'],
      status: 'available',
      accountStatus: true,
    },
  ],
  total: 1,
};

const ASSIGN_CERTIFICATE_RESPONSE = {
  message: 'Certificates assigned successfully',
  data: {
    assigned_certificates: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        certificate_id: 'ISO-9001',
        name: 'ISO 9001 Quality Management',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        certificate_id: 'ISO-14001',
        name: 'ISO 14001 Environmental Management',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        certificate_id: 'ISO-27001',
        name: 'ISO 27001 Information Security',
      },
    ],
  },
};

const UNASSIGN_CERTIFICATE_RESPONSE = {
  message: 'Certificates unassigned successfully',
  data: AUDITOR_PROFILE_EXAMPLE,
};

const AUDITOR_ASSIGNED_ASSESSMENTS_RESPONSE = {
  message: 'Assigned assessments retrieved successfully',
  data: [
    {
      id: 'a7d1b6b0-5c2b-4f0a-9b64-5e8b7c1d2a3f',
      organization_id: 'd8f2c5a1-9b3e-4a2c-8f1d-2e3c4b5a6f7a',
      branch_id: 'f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
      certificate_id: 'c1b2a3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      payment_id: 'p1b2a3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      assessment_type: 'assured',
      badge_id: null,
      is_submitted: true,
      status: 'submitted',
      submitted_at: '2026-02-01T10:00:00.000Z',
      completed_at: null,
      audit_date: '2026-02-10T10:00:00.000Z',
      created_at: '2026-02-01T09:00:00.000Z',
      updated_at: '2026-02-01T10:05:00.000Z',
      score: 92,
      certificate_name: 'Business Assessment',
      organization_name: 'TechCorp Inc',
      branch_name: 'Head Office',
      badge_name: null,
      assurance_id: null,
      total_questions: 12,
      answered_questions: 10,
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
};

export const SwaggerGetAuditorProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get auditor profile',
      description:
        'Retrieve the authenticated auditor profile with all details.',
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
              country: { type: 'string', nullable: true },
              state: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              profile_picture: { type: 'string', nullable: true },
              signature: { type: 'string', nullable: true },
              assigned_certificates: {
                type: 'array',
                items: { type: 'string' },
              },
              status: { type: 'string', enum: ['available', 'busy'] },
              accountStatus: { type: 'boolean' },
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
      description: 'Auditor profile not found',
      schema: errorResponseSchema(404, 'Auditor profile not found'),
    }),
  );

export const SwaggerListAuditors = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'List all auditors (paginated)',
      description:
        'Retrieve a paginated list of all auditors with name, email, location (country, state, city), assigned certificates, status, and account status. Returns all auditors regardless of accountStatus.',
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
      description: 'Auditors retrieved successfully',
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
                country: { type: 'string', nullable: true },
                state: { type: 'string', nullable: true },
                city: { type: 'string', nullable: true },
                assigned_certificates: {
                  type: 'array',
                  items: { type: 'string' },
                },
                status: { type: 'string', enum: ['available', 'busy'] },
                accountStatus: { type: 'boolean' },
              },
            },
          },
          total: { type: 'number', description: 'Total number of auditors' },
        },
        example: LIST_AUDITORS_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

export const SwaggerUpdateAuditorProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update auditor profile',
      description: `Update auditor profile with all fields (name, location, certificates, account status, etc).
- Profile picture URLs must be from Cloudinary
- Email and password changes require OTP verification
- Admin can update any auditor profile by providing auditorId query parameter
- Status is managed by separate endpoint
- **Account Status**: Only admin users can update accountStatus field. Non-admin users will receive an error if they attempt to update it.`,
    }),
    ApiQuery({
      name: 'auditorId',
      required: false,
      type: 'string',
      description:
        'Auditor ID (required for admin to update other auditor profiles)',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          first_name: { type: 'string', example: 'John' },
          last_name: { type: 'string', example: 'Doe' },
          profile_picture_url: {
            type: 'string',
            example:
              'https://res.cloudinary.com/account/image/upload/v123/auditors/profile.jpg',
          },
          signature_url: {
            type: 'string',
            description:
              'Cloudinary URL of the auditor signature. Required before the auditor can finalize an audit decision.',
            example:
              'https://res.cloudinary.com/account/image/upload/v123/auditors/signature.png',
          },
          country: { type: 'string', example: 'United States' },
          state: { type: 'string', example: 'California' },
          city: { type: 'string', example: 'Los Angeles' },
          assigned_certificates: {
            type: 'array',
            items: { type: 'string' },
            example: ['cert-id-1', 'cert-id-2'],
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
      description: 'Auditor profile not found',
      schema: errorResponseSchema(404, 'Auditor profile not found'),
    }),
  );

export const SwaggerUpdateAuditorEmail = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update auditor email (requires OTP)',
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
        example: UPDATE_EMAIL_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid OTP, expired OTP, or email already in use',
      schema: errorResponseSchema(
        400,
        'Invalid OTP for email verification',
        '/api/auditors/email',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized', '/api/auditors/email'),
    }),
  );

export const SwaggerUpdateAuditorPassword = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update auditor password (requires OTP)',
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
        example: UPDATE_PASSWORD_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Current password incorrect or invalid OTP',
      schema: errorResponseSchema(
        400,
        'Current password is incorrect',
        '/api/auditors/password',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/auditors/password',
      ),
    }),
    ApiInternalServerErrorResponse({
      description: 'Failed to update password',
      schema: errorResponseSchema(
        500,
        'Failed to update password',
        '/api/auditors/password',
      ),
    }),
  );

export const SwaggerAssignCertificates = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Assign certificates to auditor (Admin only)',
      description:
        'Add one or more certificates to the specified auditor profile. Duplicate certificates will be ignored. Requires admin role.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['certificate_ids'],
        properties: {
          certificate_ids: {
            type: 'array',
            items: { type: 'string' },
            example: [
              '550e8400-e29b-41d4-a716-446655440001',
              '550e8400-e29b-41d4-a716-446655440002',
            ],
            description: 'Array of certificate IDs to assign',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Certificates assigned successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              assigned_certificates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      format: 'uuid',
                      description: 'Certificate UUID (used by backend)',
                    },
                    certificate_id: {
                      type: 'string',
                      description: 'Certificate identifier (e.g., ISO-9001)',
                    },
                    name: {
                      type: 'string',
                      description: 'Certificate display name',
                    },
                  },
                },
              },
            },
          },
        },
        example: ASSIGN_CERTIFICATE_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Certificate IDs are required',
      schema: errorResponseSchema(
        400,
        'Certificate IDs are required',
        '/api/auditors/:auditorId/certificates/assign',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/auditors/:auditorId/certificates/assign',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Auditor profile not found',
      schema: errorResponseSchema(
        404,
        'Auditor profile not found',
        '/api/auditors/:auditorId/certificates/assign',
      ),
    }),
  );

export const SwaggerUnassignCertificates = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Unassign certificates from auditor (Admin only)',
      description:
        'Remove one or more certificates from the specified auditor profile. Requires admin role.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['certificate_ids'],
        properties: {
          certificate_ids: {
            type: 'array',
            items: { type: 'string' },
            example: [
              '550e8400-e29b-41d4-a716-446655440001',
              '550e8400-e29b-41d4-a716-446655440002',
            ],
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Certificates unassigned successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
          },
        },
        example: UNASSIGN_CERTIFICATE_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Certificate IDs are required',
      schema: errorResponseSchema(
        400,
        'Certificate IDs are required',
        '/api/auditors/:auditorId/certificates/unassign',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/auditors/:auditorId/certificates/unassign',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Auditor profile not found',
      schema: errorResponseSchema(
        404,
        'Auditor profile not found',
        '/api/auditors/:auditorId/certificates/unassign',
      ),
    }),
  );

// Swagger decorator for DELETE /auditors/profile
export const SwaggerDeleteAuditorProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Delete auditor profile',
      description:
        'Delete the auditor profile and mark user account as deleted.',
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
      description: 'Auditor profile not found',
      schema: errorResponseSchema(404, 'Auditor profile not found'),
    }),
  );

export const SwaggerUpdateAuditorStatus = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update auditor status (Auditor only)',
      description:
        'Update your availability status. Only "available" or "busy" are allowed. This endpoint is for auditors to update their own status.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['available', 'busy'],
            example: 'available',
            description: 'Auditor availability status',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Status updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Status updated successfully' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              status: { type: 'string', enum: ['available', 'busy'] },
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid status value',
      schema: errorResponseSchema(
        400,
        'Status must be either "available" or "busy"',
        '/api/auditors/status',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized', '/api/auditors/status'),
    }),
    ApiNotFoundResponse({
      description: 'Auditor profile not found',
      schema: errorResponseSchema(
        404,
        'Auditor profile not found',
        '/api/auditors/status',
      ),
    }),
  );

export const SwaggerUpdateAuditorAccountStatus = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update auditor account status (Admin only)',
      description:
        'Activate or deactivate an auditor account. Only admins can manage account status. true = active, false = inactive.',
    }),
    ApiParam({
      name: 'auditorId',
      type: 'string',
      format: 'uuid',
      description: 'Auditor ID to update',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['accountStatus'],
        properties: {
          accountStatus: {
            type: 'boolean',
            example: true,
            description: 'Account status. true = active, false = inactive',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Account status updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Account status updated successfully',
          },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              accountStatus: { type: 'boolean' },
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid request',
      schema: errorResponseSchema(
        400,
        'Invalid request',
        '/api/auditors/:auditorId/account-status',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/auditors/:auditorId/account-status',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Auditor profile not found',
      schema: errorResponseSchema(
        404,
        'Auditor profile not found',
        '/api/auditors/:auditorId/account-status',
      ),
    }),
  );

export const SwaggerGetAuditorAssignedAssessments = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get assessments assigned to an auditor',
      description:
        'Retrieve a paginated list of assessments assigned to the authenticated auditor. Admins can pass auditorId to fetch another auditor’s assignments.',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number for pagination (default: 1)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of results per page (default: 10)',
      example: 10,
    }),
    ApiQuery({
      name: 'status',
      required: false,
      type: String,
      description: 'Filter assessments by status',
      example: 'in-progress',
    }),
    ApiQuery({
      name: 'auditorId',
      required: false,
      type: String,
      description: 'Auditor ID (admin only)',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiQuery({
      name: 'assignedBy',
      required: false,
      type: String,
      description: 'Filter by user ID who assigned the assessment',
      example: '550e8400-e29b-41d4-a716-446655440999',
    }),
    ApiOkResponse({
      description: 'Assigned assessments retrieved successfully',
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
                branch_id: { type: 'string', format: 'uuid', nullable: true },
                certificate_id: { type: 'string', format: 'uuid' },
                payment_id: { type: 'string', format: 'uuid' },
                assessment_type: { type: 'string' },
                badge_id: { type: 'string', format: 'uuid', nullable: true },
                is_submitted: { type: 'boolean' },
                status: { type: 'string' },
                submitted_at: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                },
                completed_at: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                },
                audit_date: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                },
                assigned_by: { type: 'string', format: 'uuid', nullable: true },
                created_at: { type: 'string', format: 'date-time' },
                updated_at: { type: 'string', format: 'date-time' },
                score: { type: 'number', nullable: true },
                certificate_name: { type: 'string', nullable: true },
                organization_name: { type: 'string', nullable: true },
                branch_name: { type: 'string', nullable: true },
                badge_name: { type: 'string', nullable: true },
                assurance_id: {
                  type: 'string',
                  format: 'uuid',
                  nullable: true,
                },
                total_questions: { type: 'number', nullable: true },
                answered_questions: { type: 'number', nullable: true },
              },
            },
          },
          total: { type: 'number' },
          page: { type: 'number' },
          limit: { type: 'number' },
        },
        example: AUDITOR_ASSIGNED_ASSESSMENTS_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/auditors/assigned-assessments',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Auditor not found',
      schema: errorResponseSchema(
        404,
        'Auditor not found',
        '/api/auditors/assigned-assessments',
      ),
    }),
  );

export function SwaggerAssignAuditorToAssessment() {
  return applyDecorators(
    ApiExtraModels(AssignAssessmentDto, AssignAssessmentResponseDto),
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Assign auditor to assessment',
      description: `
Assigns or unassigns an auditor to/from an assessment with an optional audit date.

**Required Roles**: \`subadmin\`, \`reviewer\`, or \`admin\`

**Behavior:**
- For \`admin\`, \`subadmin\`, and \`reviewer\`: passing \`auditorId\` sends an invitation first
- Auditor must accept invitation before final assignment is applied
- Pass \`null\` for \`auditorId\` to unassign the current auditor
- The auditor must exist in the system
- The assessment must exist
- \`auditDate\`: Optional scheduled audit date (ISO 8601)
      `,
    }),
    ApiBody({
      type: AssignAssessmentDto,
      description:
        'Assessment and auditor assignment details with optional audit date',
      examples: {
        assignWithAuditDate: {
          summary: 'Assign auditor with audit date',
          value: {
            assessmentId: '123e4567-e89b-12d3-a456-426614174000',
            auditorId: '123e4567-e89b-12d3-a456-426614174001',
            auditDate: '2026-02-10T10:00:00.000Z',
          },
        },
        unassign: {
          summary: 'Unassign auditor',
          value: {
            assessmentId: '123e4567-e89b-12d3-a456-426614174000',
            auditorId: null,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description:
        'Invitation sent or auditor assigned/unassigned successfully',
      type: AssignAssessmentResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment or auditor not found',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Assessment not found' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid request data',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
        },
      },
    }),
  );
}

export function SwaggerUpdateAuditorAuditDate() {
  return applyDecorators(
    ApiExtraModels(UpdateAuditDateDto, UpdateAuditDateResponseDto),
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update auditor audit date',
      description: `
Updates the scheduled audit date for an assessment assigned to the auditor.

**Required Roles**: \`auditor\`

**Behavior:**
- Only auditors assigned to the assessment can update the review date
- \`auditDate\`: Required scheduled audit date (ISO 8601 format)
- Auditor must be the assigned auditor for the assessment
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'UUID of the assessment',
      required: true,
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({
      type: UpdateAuditDateDto,
      description: 'Audit date to set',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Audit date updated successfully',
      type: UpdateAuditDateResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Assessment not found' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Auditor not assigned to this assessment or invalid date',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: {
            type: 'string',
            example: 'You are not assigned as the auditor for this assessment',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - JWT token missing or invalid',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Unauthorized' },
          statusCode: { type: 'number', example: 401 },
        },
      },
    }),
  );
}
