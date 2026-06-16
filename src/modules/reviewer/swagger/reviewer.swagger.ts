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
  ApiExtraModels,
  ApiResponse,
} from '@nestjs/swagger';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import {
  AssignAssessmentDto,
  AssignAssessmentResponseDto,
} from '../dto/assign-assessment.dto';
import {
  ReviewerAiFlagsQueryDto,
  ReviewFlagActionDto,
  SubmitReviewerReviewDto,
  AssignReviewerToFlaggedDto,
} from '../dto/reviewer-ai-flags.dto';

// Error response schema
const errorResponseSchema = (
  statusCode: number,
  message: string,
  path: string = '/api/reviewers/profile',
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
const REVIEWER_PROFILE_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: '660e8400-e29b-41d4-a716-446655440001',
  first_name: 'Jane',
  last_name: 'Smith',
  profile_picture:
    'https://res.cloudinary.com/account/image/upload/v123/reviewers/profile.jpg',
  signature:
    'https://res.cloudinary.com/account/image/upload/v123/reviewers/signature.png',
  tags: ['iso-certified', 'experienced'],
  accountStatus: true,
  created_at: '2026-01-13T12:00:00.000Z',
  updated_at: '2026-01-13T12:00:00.000Z',
};

const GET_PROFILE_RESPONSE = {
  message: 'Profile retrieved successfully',
  data: REVIEWER_PROFILE_EXAMPLE,
};

const UPDATE_PROFILE_RESPONSE = {
  message: 'Profile updated successfully',
  data: REVIEWER_PROFILE_EXAMPLE,
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

const ADD_TAGS_RESPONSE = {
  message: 'Tags added successfully',
  data: {
    ...REVIEWER_PROFILE_EXAMPLE,
    tags: ['iso-certified', 'experienced', 'new-tag'],
  },
};

const REMOVE_TAGS_RESPONSE = {
  message: 'Tags removed successfully',
  data: {
    ...REVIEWER_PROFILE_EXAMPLE,
    tags: ['iso-certified'],
  },
};

// Swagger decorator for GET /reviewers/profile
export const SwaggerGetReviewerProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get reviewer profile',
      description:
        'Retrieve the authenticated reviewer profile with all details.',
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
              signature: { type: 'string', nullable: true },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
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
      description: 'Reviewer profile not found',
      schema: errorResponseSchema(404, 'Reviewer profile not found'),
    }),
  );

// Swagger decorator for PUT /reviewers/profile
export const SwaggerUpdateReviewerProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update reviewer profile',
      description: `Update reviewer profile information (first name, last name, profile picture URL, tags, account status).

**Constraints:**
- Profile picture URLs must be from Cloudinary (pattern: https://res.cloudinary.com/...)
- Email and password changes require OTP verification via separate endpoints
- Admin can update any reviewer by providing reviewerId query parameter
- **Account Status**: Only admin users can update accountStatus field. Non-admin users will receive an error if they attempt to update it.`,
    }),
    ApiQuery({
      name: 'reviewerId',
      required: false,
      type: 'string',
      description:
        'Reviewer ID (optional, required only when admin updates another reviewer). Must be a valid UUID.',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiExtraModels(UpdateProfileDto),
    ApiBody({
      type: UpdateProfileDto,
      schema: {
        type: 'object',
        properties: {
          first_name: { type: 'string', example: 'Jane' },
          last_name: { type: 'string', example: 'Smith' },
          profile_picture_url: {
            type: 'string',
            example:
              'https://res.cloudinary.com/account/image/upload/v123/reviewers/profile.jpg',
          },
          signature_url: {
            type: 'string',
            description:
              'Cloudinary URL of the reviewer signature. Required before the reviewer can finalize a review decision.',
            example:
              'https://res.cloudinary.com/account/image/upload/v123/reviewers/signature.png',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['iso-certified', 'experienced'],
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
              signature: { type: 'string', nullable: true },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
              accountStatus: { type: 'boolean' },
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
      description: 'Reviewer profile not found',
      schema: errorResponseSchema(404, 'Reviewer profile not found'),
    }),
  );

// Swagger decorator for PUT /reviewers/email
export const SwaggerUpdateReviewerEmail = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update reviewer email (requires OTP)',
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
        '/api/reviewers/email',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized', '/api/reviewers/email'),
    }),
  );

// Swagger decorator for PUT /reviewers/password
export const SwaggerUpdateReviewerPassword = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update reviewer password (requires OTP)',
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
        '/api/reviewers/password',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/password',
      ),
    }),
    ApiInternalServerErrorResponse({
      description: 'Failed to update password due to server error',
      schema: errorResponseSchema(
        500,
        'Failed to update password',
        '/api/reviewers/password',
      ),
    }),
  );

// Swagger decorator for POST /reviewers/tags
export const SwaggerAddTags = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Add tags to reviewer profile',
      description:
        'Add one or more tags to the reviewer profile. Tags are used for categorization and filtering.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['tags'],
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['iso-certified', 'experienced'],
            description: 'Array of tag strings to add',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Tags added successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        example: ADD_TAGS_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid tags format',
      schema: errorResponseSchema(400, 'Tags must be an array of strings'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Reviewer profile not found',
      schema: errorResponseSchema(404, 'Reviewer profile not found'),
    }),
  );

// Swagger decorator for DELETE /reviewers/tags
export const SwaggerRemoveTags = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Remove tags from reviewer profile',
      description:
        'Remove one or more tags from the reviewer profile. Only tags that exist will be removed.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['tags'],
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['new-tag'],
            description: 'Array of tag strings to remove',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Tags removed successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        example: REMOVE_TAGS_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid tags format',
      schema: errorResponseSchema(400, 'Tags must be an array of strings'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Reviewer profile not found',
      schema: errorResponseSchema(404, 'Reviewer profile not found'),
    }),
  );

// Swagger decorator for DELETE /reviewers/profile
export const SwaggerDeleteReviewerProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Delete reviewer profile',
      description:
        'Delete the reviewer profile. The associated user account will be marked as deleted.',
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
      description: 'Reviewer profile not found',
      schema: errorResponseSchema(404, 'Reviewer profile not found'),
    }),
  );

// Swagger decorator for PUT /reviewers/:reviewerId/account-status
export const SwaggerUpdateReviewerAccountStatus = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update reviewer account status',
      description:
        'Update the account status of a reviewer (active/inactive). Admin only.',
    }),
    ApiParam({
      name: 'reviewerId',
      type: 'string',
      format: 'uuid',
      description: 'Reviewer ID',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['accountStatus'],
        properties: {
          accountStatus: {
            type: 'boolean',
            example: false,
            description: 'Account status (true = active, false = inactive)',
          },
        },
      },
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
        example: {
          message: 'Account status updated successfully',
          data: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            user_id: '660e8400-e29b-41d4-a716-446655440001',
            first_name: 'Jane',
            last_name: 'Smith',
            accountStatus: false,
            created_at: '2026-01-13T12:00:00.000Z',
            updated_at: '2026-01-13T12:00:00.000Z',
          },
        },
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
      description: 'Reviewer profile not found',
      schema: errorResponseSchema(
        404,
        'Reviewer profile not found',
        '/api/reviewers/:reviewerId/account-status',
      ),
    }),
  );

// Swagger decorator for GET /reviewers
const LIST_REVIEWERS_RESPONSE = {
  message: 'Reviewers retrieved successfully',
  data: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      profile_picture:
        'https://res.cloudinary.com/account/image/upload/v123/reviewers/profile.jpg',
      tags: ['iso-certified', 'experienced'],
      accountStatus: true,
    },
  ],
  total: 1,
};

const REVIEWER_ASSIGNED_ASSESSMENTS_RESPONSE = {
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

export const SwaggerListReviewers = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'List all reviewers',
      description:
        'Retrieve a paginated list of all reviewers with name, email, tags, and account status. Returns all reviewers regardless of accountStatus (true or false).',
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
      description: 'Reviewers retrieved successfully',
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
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                },
                accountStatus: { type: 'boolean' },
              },
            },
          },
          total: { type: 'number', description: 'Total number of reviewers' },
        },
        example: LIST_REVIEWERS_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

export const SwaggerGetReviewerAssignedAssessments = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get assessments assigned to the authenticated reviewer',
      description:
        'Retrieve a paginated list of assessments assigned to the authenticated reviewer. Admins can pass reviewerId to fetch another reviewer’s assignments.',
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
      example: 'submitted',
    }),
    ApiQuery({
      name: 'reviewerId',
      required: false,
      type: String,
      description: 'Reviewer ID (admin only)',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiQuery({
      name: 'assignedByRole',
      required: false,
      type: String,
      description:
        'Filter assessments by the role of who assigned them (admin, subadmin, or reviewer)',
      example: 'admin',
    }),
    ApiQuery({
      name: 'assessmentType',
      required: false,
      type: String,
      enum: ['self_disclosure', 'assured'],
      description:
        'Filter assessments by type (self_disclosure or assured)',
      example: 'assured',
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
        example: REVIEWER_ASSIGNED_ASSESSMENTS_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/assigned-assessments',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Reviewer not found',
      schema: errorResponseSchema(
        404,
        'Reviewer not found',
        '/api/reviewers/assigned-assessments',
      ),
    }),
  );

const DASHBOARD_ANALYTICS_RESPONSE = {
  success: true,
  message: 'Dashboard analytics retrieved successfully',
  data: {
    self_disclosure: {
      total_certificates: 52,
      pending_review_ai_flags: 11,
      completed: 19,
    },
    assured: {
      total_certificates: 96,
      sent_to_auditor: 34,
      accepted_by_auditor: 41,
      pending_reviews: 41,
      clarifications_pending: 15,
    },
  },
};

export const SwaggerGetDashboardAnalytics = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get reviewer dashboard analytics',
      description:
        'Returns aggregated counts for the reviewer dashboard, split by self-disclosure and assured assessment types.',
    }),
    ApiOkResponse({
      description: 'Dashboard analytics retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              self_disclosure: {
                type: 'object',
                properties: {
                  total_certificates: { type: 'number' },
                  pending_review_ai_flags: { type: 'number' },
                  completed: { type: 'number' },
                },
              },
              assured: {
                type: 'object',
                properties: {
                  total_certificates: { type: 'number' },
                  sent_to_auditor: { type: 'number' },
                  accepted_by_auditor: { type: 'number' },
                  pending_reviews: { type: 'number' },
                  clarifications_pending: { type: 'number' },
                },
              },
            },
          },
        },
        example: DASHBOARD_ANALYTICS_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/dashboard-analytics',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Reviewer not found',
      schema: errorResponseSchema(
        404,
        'Reviewer not found',
        '/api/reviewers/dashboard-analytics',
      ),
    }),
  );

const CERTIFICATE_ASSESSMENTS_RESPONSE = {
  message: 'Certificate assessments retrieved successfully',
  items: [
    {
      organizationId: 'd8f2c5a1-9b3e-4a2c-8f1d-2e3c4b5a6f7a',
      organizationName: 'TechCorp Inc',
      branchId: 'f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
      branchName: 'Head Office',
      certificateId: 'c1b2a3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      certificateName: 'ISO 9001:2015 Quality Management',
      productId: null,
      totalAiFlags: 3,
      status: 'under_reviewer',
      assignedDate: '2026-02-01T10:00:00.000Z',
    },
  ],
  total: 25,
  page: 1,
  limit: 10,
  totalPages: 3,
};

export const SwaggerGetCertificateAssessments = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'List certificate assessments assigned to reviewer',
      description: `Retrieve a paginated list of self/assured certificate assessments assigned to the logged-in reviewer.
Each item includes a runtime-derived **status** with deterministic precedence:
1. \`blocked\` – assessment or issued certificate is blocked
2. \`approved\` – issued certificate exists and is not blocked
3. \`audit_completed\` – audit lifecycle is reviewer_submitted or completed
4. \`assigned_to_auditor\` – an auditor has been assigned
5. \`under_reviewer\` – default when reviewer is assigned
6. \`ai_flagged\` – AI review has flags > 0`,
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (default: 1)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Items per page (default: 10, max: 100)',
      example: 10,
    }),
    ApiQuery({
      name: 'assessmentType',
      required: false,
      type: String,
      enum: ['self_disclosure', 'assured'],
      description: 'Filter by assessment type (self_disclosure or assured)',
      example: 'assured',
    }),
    ApiOkResponse({
      description: 'Certificate assessments retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                assessmentId: { type: 'string', format: 'uuid' },
                organizationId: { type: 'string', format: 'uuid' },
                organizationName: { type: 'string' },
                branchId: {
                  type: 'string',
                  format: 'uuid',
                  nullable: true,
                },
                branchName: { type: 'string', nullable: true },
                certificateId: { type: 'string', format: 'uuid' },
                certificateName: { type: 'string' },
                productId: {
                  type: 'string',
                  format: 'uuid',
                  nullable: true,
                },
                totalAiFlags: { type: 'number' },
                status: {
                  type: 'string',
                  enum: [
                    'ai_flagged',
                    'under_reviewer',
                    'assigned_to_auditor',
                    'audit_completed',
                    'approved',
                    'blocked',
                  ],
                },
                assignedDate: { type: 'string', format: 'date-time' },
              },
            },
          },
          total: { type: 'number' },
          page: { type: 'number' },
          limit: { type: 'number' },
          totalPages: { type: 'number' },
        },
        example: CERTIFICATE_ASSESSMENTS_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/certificate-assessments',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Reviewer not found',
      schema: errorResponseSchema(
        404,
        'Reviewer not found',
        '/api/reviewers/certificate-assessments',
      ),
    }),
  );

const REVIEWER_AUDITS_RESPONSE = {
  success: true,
  message: 'Reviewer audits retrieved successfully',
  data: {
    items: [
      {
        assessment_id: 'a7d1b6b0-5c2b-4f0a-9b64-5e8b7c1d2a3f',
        assessment_type: 'assured',
        assessment_status: 'submitted',
        organization_name: 'TechCorp Inc',
        certificate_name: 'ISO 9001:2015',
        audit_date: '2026-02-10T10:00:00.000Z',
        audit_id: 'aud-1234',
        audit_lifecycle_status: 'submitted',
        audit_status: 'approved',
        review_status: null,
        score: 85,
        review_score: null,
        audit_created_at: '2026-02-05T10:00:00.000Z',
        audit_updated_at: '2026-02-10T10:00:00.000Z',
        computed_status: 'submitted',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
  statusCode: 200,
  timestamp: '2026-03-01T12:00:00.000Z',
};

export const SwaggerGetReviewerAudits = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'List audits assigned to the reviewer',
      description: `Returns all audits assigned to the authenticated reviewer, with assessment and lifecycle details.

**Optional filter:** \`lifecycleStatus\` to filter by computed audit status (pending, in_progress, submitted, rejected, completed).

**Computed status logic:**
- \`rejected\` – review_status is rejected
- \`completed\` – both audit status and review_status are set
- \`submitted\` – audit status is set (but no review yet)
- \`in_progress\` – audit has summary/description/doc but no status
- \`pending\` – no audit work started`,
    }),
    ApiQuery({
      name: 'lifecycleStatus',
      required: false,
      enum: ['pending', 'in_progress', 'submitted', 'rejected', 'completed'],
      description: 'Filter by computed audit status',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      example: 1,
      description: 'Page number (default: 1)',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 10,
      description: 'Items per page (default: 10)',
    }),
    ApiOkResponse({
      description: 'Reviewer audits retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    assessment_id: { type: 'string', format: 'uuid' },
                    assessment_type: { type: 'string' },
                    assessment_status: { type: 'string' },
                    organization_name: { type: 'string' },
                    certificate_name: { type: 'string' },
                    audit_date: { type: 'string', format: 'date-time', nullable: true },
                    audit_id: { type: 'string', format: 'uuid', nullable: true },
                    audit_lifecycle_status: { type: 'string', nullable: true },
                    audit_status: { type: 'string', nullable: true },
                    review_status: { type: 'string', nullable: true },
                    score: { type: 'number', nullable: true },
                    review_score: { type: 'number', nullable: true },
                    audit_created_at: { type: 'string', format: 'date-time', nullable: true },
                    audit_updated_at: { type: 'string', format: 'date-time', nullable: true },
                    computed_status: {
                      type: 'string',
                      enum: ['pending', 'in_progress', 'submitted', 'rejected', 'completed'],
                    },
                  },
                },
              },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
              totalPages: { type: 'number' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: REVIEWER_AUDITS_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/audits',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Reviewer not found',
      schema: errorResponseSchema(
        404,
        'Reviewer not found',
        '/api/reviewers/audits',
      ),
    }),
  );

export function SwaggerAssignReviewerToAssessment() {
  return applyDecorators(
    ApiExtraModels(AssignAssessmentDto, AssignAssessmentResponseDto),
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Assign reviewer to assessment',
      description: `
Assigns or unassigns a reviewer to/from an assessment.

**Required Roles**: \`admin\` or \`subadmin\`

**Behavior:**
- Pass \`reviewerId\` to assign a reviewer
- Pass \`null\` for \`reviewerId\` to unassign the current reviewer
- The reviewer must exist in the system
- The assessment must exist
      `,
    }),
    ApiBody({
      type: AssignAssessmentDto,
      description: 'Assessment and reviewer assignment details',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Reviewer assigned/unassigned successfully',
      type: AssignAssessmentResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment or reviewer not found',
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

// ── Reviewer AI Flag Swagger Decorators ──

export function SwaggerGetAssignedAiFlags() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get assigned AI flagged assessments',
      description:
        'Returns paginated list of flagged assessments assigned to the authenticated reviewer. Filterable by flag status.',
    }),
    ApiOkResponse({
      description: 'Assigned AI flags retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'Assigned AI flags retrieved successfully',
          items: [
            {
              reviewId: '550e8400-e29b-41d4-a716-446655440000',
              assessmentId: '660e8400-e29b-41d4-a716-446655440001',
              certificateId: '770e8400-e29b-41d4-a716-446655440002',
              certificateName: 'ISO 9001:2015',
              organizationName: 'TechCorp Inc',
              branchName: 'HQ',
              productId: 'CERT-2024-001',
              assessmentType: 'self_disclosure',
              aiScore: 72.5,
              totalFlags: 3,
              flagStatus: 'open',
              auditor: {
                id: '880e8400-e29b-41d4-a716-446655440003',
                name: 'John Auditor',
                email: 'john@example.com',
              },
              reviewerSubmittedAt: null,
              createdAt: '2026-03-15T10:30:00.000Z',
              updatedAt: '2026-03-15T10:30:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
      },
    }),
    ApiNotFoundResponse({
      description: 'Reviewer not found',
      schema: errorResponseSchema(
        404,
        'Reviewer not found',
        '/api/reviewers/flagged-assessments',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/flagged-assessments',
      ),
    }),
  );
}

export function SwaggerGetAiFlagDetails() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get AI flag review details',
      description:
        'Returns detailed information about a specific flagged assessment including all flagged responses. Only accessible if the review is assigned to the authenticated reviewer.',
    }),
    ApiParam({
      name: 'reviewId',
      type: 'string',
      format: 'uuid',
      description: 'AI review ID',
    }),
    ApiOkResponse({
      description: 'AI flag details retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'AI flag details retrieved successfully',
          data: {
            review: {
              reviewId: '550e8400-e29b-41d4-a716-446655440000',
              certificateName: 'ISO 9001:2015',
              organizationName: 'TechCorp Inc',
              aiScore: 72.5,
              totalFlags: 3,
              flagStatus: 'open',
              auditor: { id: 'uuid', name: 'John Auditor', email: 'john@example.com' },
            },
            flaggedResponses: [
              {
                id: 'response-uuid',
                question_text: 'Describe your safety procedures',
                is_flagged: true,
                flag_reason: 'Response too brief',
                confidence_score: 40,
                risk_level: 'medium',
                applicant_answer: 'We have some procedures',
                reviewer_action: null,
                reviewer_notes: null,
              },
            ],
          },
        },
      },
    }),
    ApiNotFoundResponse({
      description: 'AI flag review not found or not assigned to you',
      schema: errorResponseSchema(
        404,
        'AI flag review not found or not assigned to you',
        '/api/reviewers/flagged-assessments/:reviewId',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/flagged-assessments/:reviewId',
      ),
    }),
  );
}

export function SwaggerReviewFlaggedResponse() {
  return applyDecorators(
    ApiOperation({
      summary: 'Accept or reject a flagged response',
      description:
        'Reviewer accepts (AI was wrong, answer is correct) or rejects (AI was right) a specific flagged question. Optional notes can be provided. Returns whether all flags have been reviewed.',
    }),
    ApiParam({ name: 'reviewId', type: 'string', format: 'uuid', description: 'AI review ID' }),
    ApiParam({ name: 'responseId', type: 'string', format: 'uuid', description: 'AI response ID' }),
    ApiBody({ type: ReviewFlagActionDto }),
    ApiOkResponse({
      description: 'Flag reviewed successfully',
      schema: {
        example: {
          success: true,
          message: 'Flag accepted successfully',
          reviewClosed: false,
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Response is not flagged or review already submitted',
      schema: errorResponseSchema(
        400,
        'This response is not flagged',
        '/api/reviewers/flagged-assessments/:reviewId/responses/:responseId',
      ),
    }),
    ApiNotFoundResponse({
      description: 'Response not found or does not belong to this review',
      schema: errorResponseSchema(
        404,
        'AI response not found for this review',
        '/api/reviewers/flagged-assessments/:reviewId/responses/:responseId',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/flagged-assessments/:reviewId/responses/:responseId',
      ),
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Review not assigned to you',
      schema: errorResponseSchema(
        403,
        'This review is not assigned to you',
        '/api/reviewers/flagged-assessments/:reviewId/responses/:responseId',
      ),
    }),
  );
}

export function SwaggerSubmitReviewerReview() {
  return applyDecorators(
    ApiOperation({
      summary: 'Submit reviewer review and trigger AI re-review',
      description:
        'Submits the completed review. All flagged questions must be accepted/rejected before submitting. Optionally adjust the overall score. Triggers AI re-review — accepted flags are treated as 100% compliant. If new flags appear, the review stays open.',
    }),
    ApiParam({ name: 'reviewId', type: 'string', format: 'uuid', description: 'AI review ID' }),
    ApiBody({ type: SubmitReviewerReviewDto }),
    ApiOkResponse({
      description: 'Review submitted and AI re-review triggered',
      schema: {
        example: {
          success: true,
          message: 'Review submitted and AI re-review triggered',
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Not all flags reviewed, already submitted, or AI re-review failed',
      schema: errorResponseSchema(
        400,
        'All flagged responses must be reviewed before submitting',
        '/api/reviewers/flagged-assessments/:reviewId/submit',
      ),
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Review not assigned to you',
      schema: errorResponseSchema(
        403,
        'This review is not assigned to you',
        '/api/reviewers/flagged-assessments/:reviewId/submit',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/flagged-assessments/:reviewId/submit',
      ),
    }),
  );
}

export function SwaggerAssignReviewerToFlagged() {
  return applyDecorators(
    ApiOperation({
      summary: 'Assign reviewer to a flagged assessment',
      description:
        'Admin assigns a reviewer to handle the AI flags on a specific assessment. The reviewer will then see this assessment in their AI flags dashboard.',
    }),
    ApiParam({
      name: 'assessmentId',
      type: 'string',
      format: 'uuid',
      description: 'The assessment ID to assign a reviewer to',
    }),
    ApiBody({ type: AssignReviewerToFlaggedDto }),
    ApiOkResponse({
      description: 'Reviewer assigned to flagged assessment successfully',
      schema: {
        example: {
          success: true,
          message: 'Reviewer assigned to flagged assessment successfully',
          data: {
            assessmentId: '660e8400-e29b-41d4-a716-446655440001',
            reviewerId: '550e8400-e29b-41d4-a716-446655440000',
            reviewerName: 'Jane Smith',
          },
        },
      },
    }),
    ApiNotFoundResponse({
      description: 'Assessment or reviewer not found',
      schema: errorResponseSchema(
        404,
        'Assessment not found',
        '/api/reviewers/flagged-assessments/:assessmentId/assign-reviewer',
      ),
    }),
    ApiBadRequestResponse({
      description: 'Assessment already assigned to a reviewer',
      schema: errorResponseSchema(
        400,
        'Assessment is already assigned to a reviewer',
        '/api/reviewers/flagged-assessments/:assessmentId/assign-reviewer',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(
        401,
        'Unauthorized',
        '/api/reviewers/flagged-assessments/:assessmentId/assign-reviewer',
      ),
    }),
  );
}
