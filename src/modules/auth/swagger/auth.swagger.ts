import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ResendCredentialsDto } from '../dto/resend-credentials.dto';
import { ResendCredentialsResponseDto } from '../dto/resend-credentials-response.dto';

const USER_RESPONSE_SCHEMA_PROPERTIES = {
  id: { type: 'string', format: 'uuid' },
  email: { type: 'string', format: 'email' },
  role: {
    type: 'string',
    enum: [
      'admin',
      'subadmin',
      'organization',
      'organization_member',
      'auditor',
      'reviewer',
    ],
  },
  is_active: { type: 'boolean' },
  is_deleted: { type: 'boolean' },
  login_attempts: { type: 'number' },
  created_at: { type: 'string', format: 'date-time' },
  updated_at: { type: 'string', format: 'date-time' },
  last_login: { type: 'string', format: 'date-time', nullable: true },
  is_verified: { type: 'boolean' },
  email_verified: { type: 'boolean', nullable: true },
};

const TOKENS_RESPONSE_SCHEMA_PROPERTIES = {
  access_token: { type: 'string' },
  refresh_token: { type: 'string' },
};

const LOGIN_RESPONSE_SCHEMA_PROPERTIES = {
  user: {
    type: 'object',
    properties: USER_RESPONSE_SCHEMA_PROPERTIES,
  },
  tokens: {
    type: 'object',
    properties: TOKENS_RESPONSE_SCHEMA_PROPERTIES,
  },
};

// Error response schema
const errorResponseSchema = (statusCode: number, message: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: '/api/auth/endpoint' },
  },
});

// Response examples
export const ADMIN_REGISTER_RESPONSE_EXAMPLE = {
  message:
    'Admin account created successfully. You can now login with your credentials.',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@example.com',
  role: 'admin',
};

export const AUDITOR_REVIEWER_REGISTER_RESPONSE_EXAMPLE = {
  message:
    'Auditor registered successfully. Email and auto-generated password sent to user email. User is verified and can login immediately.',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'auditor@example.com',
  role: 'auditor',
  profile: {
    id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    first_name: 'John',
    last_name: 'Doe',
    country: 'United States',
    state: 'California',
    city: 'Los Angeles',
    assigned_certificates: ['cert-uuid-1', 'cert-uuid-2'],
    status: 'available',
    accountStatus: true,
    tags: [],
    profile_picture: null,
    created_at: '2026-01-13T12:00:00.000Z',
    updated_at: '2026-01-13T12:00:00.000Z',
  },
};

export const SUBADMIN_REGISTER_RESPONSE_EXAMPLE = {
  message:
    'Subadmin registered successfully. Email and auto-generated password sent to user email. User is verified and can login immediately.',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'subadmin@example.com',
  role: 'subadmin',
  profile: {
    id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    first_name: 'Jane',
    last_name: 'Smith',
    profile_picture: null,
    created_at: '2026-01-13T12:00:00.000Z',
    updated_at: '2026-01-13T12:00:00.000Z',
  },
};

export const ORGANIZATION_REGISTER_RESPONSE_EXAMPLE = {
  message:
    'Organization registered successfully. OTP sent to your email. Please verify your email within 2 minutes.',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'org@example.com',
  organization: {
    id: '770e8400-e29b-41d4-a716-446655440002',
    name: 'TechCorp Inc',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    industry_ids: [
      'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      'b2c3d4e5-f6a7-48b9-c0d1-e2f3a4b5c6d7',
    ],
    business_id: 'BIZ-2024-001',
    legal_country: 'United States',
    legal_state: 'California',
    legal_city: 'San Francisco',
    description:
      'A leading technology company specializing in innovative solutions',
    contact_no: '+1-555-123-4567',
    total_branches: 0,
    created_at: '2026-01-13T12:00:00.000Z',
    updated_at: '2026-01-13T12:00:00.000Z',
  },
};

export const USER_RESPONSE_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'jane@example.com',
  role: 'organization',
  is_active: true,
  is_deleted: false,
  login_attempts: 0,
  created_at: '2026-01-13T12:00:00.000Z',
  updated_at: '2026-01-13T12:00:00.000Z',
  last_login: '2026-01-13T12:00:00.000Z',
  is_verified: true,
  email_verified: true,
};

export const LOGIN_RESPONSE_EXAMPLE = {
  user: USER_RESPONSE_EXAMPLE,
  tokens: {
    access_token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImphbmVAZXhhbXBsZS5jb20iLCJyb2xlIjoib3JnYW5pemF0aW9uIiwiaWF0IjoxNzA1MTQ0MDAwfQ.example',
    refresh_token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImphbmVAZXhhbXBsZS5jb20iLCJyb2xlIjoib3JnYW5pemF0aW9uIiwiaWF0IjoxNzA1MTQ0MDAwfQ.refresh_example',
  },
};

export const LOGOUT_RESPONSE_EXAMPLE = {
  message: 'Logged out successfully',
};

export const OTP_RESPONSE_EXAMPLE = {
  message: 'OTP sent successfully to your email',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'user@example.com',
};

export const VERIFY_OTP_RESPONSE_EXAMPLE = {
  message: 'Email verified successfully',
  user: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    role: 'organization',
    is_active: true,
    is_deleted: false,
    is_verified: true,
    email_verified: true,
    login_attempts: 0,
    last_login: null,
    created_at: '2026-01-13T12:00:00.000Z',
    updated_at: '2026-01-13T12:00:00.000Z',
  },
};

export const VERIFY_OTP_RESPONSE_WITH_TOKENS_EXAMPLE = {
  ...VERIFY_OTP_RESPONSE_EXAMPLE,
  tokens: LOGIN_RESPONSE_EXAMPLE.tokens,
};

export const UPDATE_PASSWORD_RESPONSE_EXAMPLE = {
  message: 'Password updated successfully. Please log in again.',
};

// Swagger decorator for POST /auth/register-admin-public
export const SwaggerRegisterAdminPublic = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Public Admin Registration (FOR DEVELOPMENT ONLY)',
      description:
        'Create a new admin account without authentication. This endpoint should be removed before production deployment. Only use during development for initial admin setup. The admin account is automatically marked as verified.',
    }),
    ApiBody({
      description: 'Admin registration data',
      schema: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'admin@example.com',
            description: 'Email address for the admin account',
          },
          password: {
            type: 'string',
            minLength: 6,
            example: 'SecurePassword123!',
            description:
              'Password for the admin account (minimum 6 characters)',
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Admin account successfully created',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: ADMIN_REGISTER_RESPONSE_EXAMPLE.message,
          },
          userId: {
            type: 'string',
            format: 'uuid',
            example: ADMIN_REGISTER_RESPONSE_EXAMPLE.userId,
          },
          email: {
            type: 'string',
            format: 'email',
            example: ADMIN_REGISTER_RESPONSE_EXAMPLE.email,
          },
          role: { type: 'string', example: 'admin' },
        },
        example: ADMIN_REGISTER_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Validation error - invalid email or password format',
      schema: errorResponseSchema(
        400,
        'Password must be at least 6 characters long',
      ),
    }),
    ApiConflictResponse({
      description: 'Email already registered',
      schema: errorResponseSchema(409, 'Email already registered'),
    }),
    ApiInternalServerErrorResponse({
      description: 'Failed to create admin account',
      schema: errorResponseSchema(500, 'Failed to create admin account'),
    }),
  );

// Swagger decorator for POST /auth/register-auditor-reviewer
export const SwaggerRegisterAuditorReviewer = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Register new Auditor or Reviewer (Admin only)',
      description:
        'Create a new auditor or reviewer account. Only admins can register auditors/reviewers. A secure password (6-7 characters with letters, numbers, and symbols) is automatically generated and sent via email. The user account and corresponding auditor/reviewer profile are created automatically. User can log in immediately after account creation.',
    }),
    ApiBody({
      description:
        'Auditor/Reviewer registration data. Location fields (country, state, city) are optional for auditors.',
      schema: {
        type: 'object',
        required: ['email', 'role', 'first_name', 'last_name'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'auditor@example.com',
            description: 'Email address for the auditor/reviewer account',
          },
          role: {
            type: 'string',
            enum: ['auditor', 'reviewer'],
            example: 'auditor',
            description: 'Select role: "auditor" or "reviewer"',
          },
          first_name: {
            type: 'string',
            maxLength: 50,
            example: 'John',
            description: 'First name of the auditor/reviewer',
          },
          last_name: {
            type: 'string',
            maxLength: 50,
            example: 'Doe',
            description: 'Last name of the auditor/reviewer',
          },
          country: {
            type: 'string',
            maxLength: 100,
            example: 'United States',
            description:
              'Country of the auditor (optional, for auditor role only)',
          },
          state: {
            type: 'string',
            maxLength: 100,
            example: 'California',
            description:
              'State/Province of the auditor (optional, for auditor role only)',
          },
          city: {
            type: 'string',
            maxLength: 100,
            example: 'Los Angeles',
            description:
              'City of the auditor (optional, for auditor role only)',
          },
          assigned_certificates: {
            type: 'array',
            items: { type: 'string' },
            example: ['cert-1', 'cert-2', 'cert-3'],
            description: 'Array of assigned certificate IDs (for auditor role)',
          },
          status: {
            type: 'string',
            example: 'available',
            enum: ['available', 'busy'],
            description:
              'Status of auditor. Only "available" or "busy" are allowed.',
          },
          accountStatus: {
            type: 'boolean',
            example: true,
            description:
              'Account status. true = active, false = inactive (default: true)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['experienced', 'iso-certified', 'fast'],
            description: 'Array of tags (for reviewer role)',
          },
        },
      },
      examples: {
        auditor: {
          summary: 'Register Auditor',
          description:
            'Creating an auditor account with location, assigned certificates and status',
          value: {
            email: 'john.auditor@example.com',
            role: 'auditor',
            first_name: 'John',
            last_name: 'Doe',
            country: 'United States',
            state: 'California',
            city: 'Los Angeles',
            assigned_certificates: ['cert-uuid-1', 'cert-uuid-2'],
            status: 'available',
            accountStatus: true,
          },
        },
        reviewer: {
          summary: 'Register Reviewer',
          description:
            'Creating a reviewer account with tags (location fields not needed for reviewer)',
          value: {
            email: 'jane.reviewer@example.com',
            role: 'reviewer',
            first_name: 'Jane',
            last_name: 'Smith',
            tags: ['experienced', 'iso-certified', 'responsive'],
          },
        },
      },
    }),
    ApiCreatedResponse({
      description:
        'Auditor/Reviewer successfully registered. Account credentials sent to email.',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['auditor', 'reviewer'] },
          profile: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string', format: 'uuid' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              country: { type: 'string', nullable: true },
              state: { type: 'string', nullable: true },
              city: { type: 'string', nullable: true },
              assigned_certificates: {
                type: 'array',
                items: { type: 'string' },
              },
              status: {
                type: 'string',
                enum: ['available', 'busy'],
                nullable: true,
                description: 'Status field (only for auditor role)',
              },
              accountStatus: { type: 'boolean' },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
              profile_picture: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: AUDITOR_REVIEWER_REGISTER_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'Insufficient permissions - Admin role required',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiBadRequestResponse({
      description: 'Invalid input data or role must be "auditor" or "reviewer"',
      schema: errorResponseSchema(
        400,
        'Role must be either "auditor" or "reviewer"',
      ),
    }),
    ApiConflictResponse({
      description: 'Email already registered',
      schema: errorResponseSchema(409, 'Email already registered'),
    }),
  );

// Swagger decorator for POST /auth/register-subadmin
export const SwaggerRegisterSubadmin = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Register new subadmin (Admin only)',
      description:
        'Create a new subadmin account. Only admins can register new subadmins. A secure password (6-7 characters with letters, numbers, and symbols) is automatically generated and sent via email. The subadmin role is assigned automatically. User can log in immediately after account creation.',
    }),
    ApiBody({
      description: 'Subadmin registration data',
      schema: {
        type: 'object',
        required: ['email', 'first_name', 'last_name'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'subadmin@example.com',
            description: 'Email address for the subadmin account',
          },
          first_name: {
            type: 'string',
            example: 'Jane',
            description: 'First name of the subadmin',
          },
          last_name: {
            type: 'string',
            example: 'Smith',
            description: 'Last name of the subadmin',
          },
        },
      },
    }),
    ApiCreatedResponse({
      description:
        'Subadmin successfully registered. Account credentials sent to email.',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', example: 'subadmin' },
          profile: {
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
        example: SUBADMIN_REGISTER_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'Insufficient permissions - Admin role required',
      schema: errorResponseSchema(403, 'Insufficient permissions'),
    }),
    ApiBadRequestResponse({
      description: 'Invalid input data or validation errors',
      schema: errorResponseSchema(400, 'email must be a valid email'),
    }),
    ApiConflictResponse({
      description: 'Email already registered',
      schema: errorResponseSchema(409, 'Email already registered'),
    }),
  );

// Swagger decorator for POST /auth/register-organization
export const SwaggerRegisterOrganization = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Register new organization',
      description:
        'Create a new organization account with organization details. Password must be provided in the request body. An OTP will be sent to the organization email for verification. Organization must verify the OTP within 2 minutes before login.',
    }),
    ApiBody({
      description: 'Organization registration data',
      schema: {
        type: 'object',
        required: [
          'email',
          'password',
          'organization_name',
          'industry_ids',
          'business_id',
          'country',
          'state',
          'city',
        ],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'org@example.com',
            description: 'Email address for the organization account',
          },
          password: {
            type: 'string',
            minLength: 6,
            example: 'SecurePassword123!',
            description:
              'Password for the organization account (minimum 6 characters)',
          },
          organization_name: {
            type: 'string',
            maxLength: 255,
            example: 'TechCorp Inc',
            description: 'Name of the organization (2-255 characters)',
          },
          industry_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
            maxItems: 5,
            example: ['a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'],
            description: 'Array of 1-5 industry UUIDs',
          },
          business_id: {
            type: 'string',
            maxLength: 100,
            example: 'BIZ-2024-001',
            description: 'Unique business identifier',
          },
          country: {
            type: 'string',
            maxLength: 100,
            example: 'United States',
            description: 'Country where the organization is legally registered',
          },
          state: {
            type: 'string',
            maxLength: 100,
            example: 'California',
            description: 'State where the organization is legally registered',
          },
          city: {
            type: 'string',
            maxLength: 100,
            example: 'San Francisco',
            description: 'City where the organization is legally registered',
          },
          description: {
            type: 'string',
            maxLength: 1000,
            example:
              'A leading technology company specializing in innovative solutions',
            description:
              'Brief description of the organization (10-1000 characters)',
          },
          contact_no: {
            type: 'string',
            maxLength: 20,
            example: '+1-555-123-4567',
            description: 'Contact phone number for the organization (optional)',
          },
        },
      },
    }),
    ApiCreatedResponse({
      description:
        'Organization successfully registered. OTP sent to email for verification.',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          organization: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              user_id: { type: 'string', format: 'uuid' },
              industry_ids: {
                type: 'array',
                items: { type: 'string', format: 'uuid' },
              },
              business_id: { type: 'string' },
              legal_country: { type: 'string' },
              legal_state: { type: 'string' },
              legal_city: { type: 'string' },
              description: { type: 'string' },
              contact_no: { type: 'string', nullable: true },
              total_branches: { type: 'number' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: ORGANIZATION_REGISTER_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Validation error or industry not found',
      schema: errorResponseSchema(
        400,
        'Industry with ID a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6 not found',
      ),
    }),
    ApiConflictResponse({
      description: 'Email or business ID already registered',
      schema: errorResponseSchema(
        409,
        'Organization with this business ID already exists',
      ),
    }),
    ApiInternalServerErrorResponse({
      description: 'Failed to register organization',
      schema: errorResponseSchema(500, 'Failed to register organization'),
    }),
  );

// Swagger decorator for POST /auth/login
export const SwaggerLogin = () =>
  applyDecorators(
    ApiOperation({
      summary: 'User login',
      description:
        'Authenticate user with email and password. Returns user data and JWT tokens. Sets HTTP-only cookies for token storage. Tracks login attempts and locks account for 30 minutes after 5 failed attempts. Lockout is automatic and expires after 30 minutes.',
    }),
    ApiBody({
      description: 'User login credentials',
      schema: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'jane@example.com',
            description: 'User email address',
          },
          password: {
            type: 'string',
            minLength: 6,
            example: 'SecurePassword123!',
            description: 'User password (minimum 6 characters)',
          },
        },
      },
    }),
    ApiOkResponse({
      description:
        'User successfully logged in. Tokens are set as HTTP-only cookies and returned in response body.',
      schema: {
        type: 'object',
        properties: LOGIN_RESPONSE_SCHEMA_PROPERTIES,
        example: LOGIN_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description:
        'User not verified, account inactive/deleted, or account locked',
      schema: errorResponseSchema(
        400,
        'Please verify your email with OTP before login. Use /auth/send-otp to request a new OTP.',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid credentials. Login attempts counter incremented.',
      schema: errorResponseSchema(401, 'Invalid credentials'),
    }),
  );

// Swagger decorator for POST /auth/refresh-token
export const SwaggerRefreshToken = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Refresh access token',
      description:
        'Generate new access and refresh tokens using a valid refresh token. Updates last login timestamp. Old refresh token is invalidated.',
    }),
    ApiBody({
      description: 'Refresh token',
      schema: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: {
            type: 'string',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            description: 'Valid refresh token from previous login or refresh',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'New tokens generated successfully. Sets HTTP-only cookies.',
      schema: {
        type: 'object',
        properties: LOGIN_RESPONSE_SCHEMA_PROPERTIES,
        example: LOGIN_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or expired refresh token',
      schema: errorResponseSchema(401, 'Invalid refresh token'),
    }),
  );

// Swagger decorator for POST /auth/logout
export const SwaggerLogout = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'User logout',
      description:
        'Log out user by clearing refresh token from database and removing HTTP-only cookies. User ID is extracted from JWT token.',
    }),
    ApiOkResponse({
      description: 'User successfully logged out. Cookies cleared.',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Logged out successfully' },
        },
        example: LOGOUT_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

// Swagger decorator for POST /auth/logout-all
export const SwaggerLogoutAll = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Logout from all sessions',
      description:
        'Clears the stored refresh token, invalidating all active refresh-based sessions. Active access tokens expire naturally within the JWT window.',
    }),
    ApiOkResponse({
      description: 'Logged out from all sessions. Cookies cleared.',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Logged out from all sessions successfully',
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

// Swagger decorator for POST /auth/send-otp
export const SwaggerSendOtp = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Send OTP to email',
      description:
        'Send a 6-character alphanumeric OTP to the user email for verification. OTP expires in 10 minutes. Purpose defaults to "email_verification" if not specified. In development mode, the OTP is returned in the response.',
    }),
    ApiBody({
      description: 'Email address and OTP purpose',
      schema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
            description: 'Email address to send OTP to',
          },
          purpose: {
            type: 'string',
            enum: ['email_verification', 'password_reset'],
            example: 'email_verification',
            description: 'Purpose of OTP (default: email_verification)',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'OTP sent successfully',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'OTP sent successfully to your email',
          },
          userId: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          otp: {
            type: 'string',
            description: 'Only returned in development mode',
            example: 'ABC123',
          },
        },
        example: OTP_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'User not found',
      schema: errorResponseSchema(400, 'User not found'),
    }),
  );

// Swagger decorator for POST /auth/verify-otp
export const SwaggerVerifyOtp = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Verify OTP',
      description:
        'Verify the OTP code sent to user email. Once verified, the user account is marked as verified. If this is the first time the user is verifying, it will also return login tokens. Maximum 5 attempts allowed before OTP is invalidated.',
    }),
    ApiBody({
      description: 'Email, OTP code, and purpose',
      schema: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
            description: 'Email address of the user',
          },
          otp: {
            type: 'string',
            minLength: 6,
            maxLength: 6,
            example: 'ABC123',
            description: 'OTP code (6 characters)',
          },
          purpose: {
            type: 'string',
            enum: ['email_verification', 'password_reset'],
            example: 'email_verification',
            description: 'Purpose of OTP (default: email_verification)',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'OTP verified successfully. User is now verified.',
      schema: {
        oneOf: [
          {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Email verified successfully',
              },
              user: {
                type: 'object',
                properties: USER_RESPONSE_SCHEMA_PROPERTIES,
              },
            },
            example: VERIFY_OTP_RESPONSE_EXAMPLE,
          },
          {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Email verified successfully',
              },
              user: {
                type: 'object',
                properties: USER_RESPONSE_SCHEMA_PROPERTIES,
              },
              tokens: {
                type: 'object',
                properties: TOKENS_RESPONSE_SCHEMA_PROPERTIES,
              },
            },
            example: VERIFY_OTP_RESPONSE_WITH_TOKENS_EXAMPLE,
          },
        ],
      },
    }),
    ApiBadRequestResponse({
      description:
        'Invalid, expired, or already used OTP, or maximum attempts exceeded',
      schema: errorResponseSchema(400, 'Invalid or expired OTP'),
    }),
  );

// Swagger decorator for POST /auth/resend-otp
export const SwaggerResendOtp = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Resend OTP',
      description:
        'Resend a new OTP code to the user email. Can be used if the previous OTP expired or was not received. User must not already be verified.',
    }),
    ApiBody({
      description: 'Email address and OTP purpose',
      schema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
            description: 'Email address to send OTP to',
          },
          purpose: {
            type: 'string',
            enum: ['email_verification', 'password_reset'],
            example: 'email_verification',
            description: 'Purpose of OTP (default: email_verification)',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'OTP resent successfully',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'OTP resent successfully to your email',
          },
          userId: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          otp: {
            type: 'string',
            description: 'Only returned in development mode',
            example: 'DEF456',
          },
        },
        example: {
          ...OTP_RESPONSE_EXAMPLE,
          message: 'OTP resent successfully to your email',
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'User not found or already verified',
      schema: errorResponseSchema(400, 'User is already verified'),
    }),
  );

// Swagger decorator for PUT /auth/update-password
export const SwaggerUpdatePassword = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update user password',
      description:
        "Update the authenticated user's password. Requires current password for verification. All active sessions will be invalidated (refresh token cleared).",
    }),
    ApiBody({
      description: 'Current and new password',
      schema: {
        type: 'object',
        required: ['oldPassword', 'newPassword'],
        properties: {
          oldPassword: {
            type: 'string',
            example: 'currentPassword123!',
            description: 'Current password for verification',
          },
          newPassword: {
            type: 'string',
            minLength: 6,
            maxLength: 50,
            example: 'newSecurePassword456!',
            description: 'New password to set (6-50 characters)',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Password updated successfully. User must log in again.',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Password updated successfully. Please log in again.',
          },
        },
        example: UPDATE_PASSWORD_RESPONSE_EXAMPLE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Current password incorrect or new password same as current',
      schema: errorResponseSchema(400, 'Current password is incorrect'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

// Swagger decorator for POST /auth/forgot-password
export const SwaggerForgotPassword = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reset password using OTP',
      description:
        'Reset user password by providing email, OTP (received via /auth/send-otp with purpose=password_reset), and new password. OTP must be verified and valid. After successful reset, user can log in with the new password.',
    }),
    ApiBody({
      description: 'Forgot password data with OTP verification',
      schema: {
        type: 'object',
        required: ['email', 'otp', 'newPassword'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
            description: 'Email address associated with the account',
          },
          otp: {
            type: 'string',
            example: '123456',
            description: 'OTP received via email for password reset',
          },
          newPassword: {
            type: 'string',
            minLength: 6,
            example: 'NewSecurePassword123!',
            description: 'New password to set (minimum 6 characters)',
          },
        },
      },
    }),
    ApiOkResponse({
      description:
        'Password reset successfully. User can now log in with new password.',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example:
              'Password reset successfully. Please log in with your new password.',
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description:
        'Invalid email, OTP expired, invalid OTP, or validation errors',
      schema: errorResponseSchema(400, 'Invalid OTP'),
    }),
    ApiInternalServerErrorResponse({
      description: 'Internal server error during password reset',
      schema: errorResponseSchema(500, 'Failed to reset password'),
    }),
  );

// Swagger decorator for POST /auth/resend-credentials
export const SwaggerResendCredentials = () =>
  applyDecorators(
    ApiExtraModels(ResendCredentialsDto, ResendCredentialsResponseDto),
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Resend account credentials',
      description: `
Resets the user password and sends credentials email with new auto-generated password.

**Access Control:**
- **Admin**: Can resend credentials for any user account
- **Organization**: Can only resend credentials for their own account (email must match authenticated user)

**Process:**
1. Validates user exists and account is not deleted
2. Generates a new secure random password
3. Updates password in database
4. Sends credentials email with new password

**Required Role**: \`admin\` or \`organization\`
      `,
    }),
    ApiBody({
      type: ResendCredentialsDto,
      description: 'Email of the user whose credentials should be resent',
      examples: {
        admin: {
          summary: 'Admin resending for any user',
          value: {
            email: 'user@example.com',
          },
        },
        organization: {
          summary: 'Organization resending for own account',
          value: {
            email: 'org@example.com',
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Credentials reset and sent successfully',
      type: ResendCredentialsResponseDto,
    }),
    ApiBadRequestResponse({
      description: 'User not found, account deleted, or email sending failed',
      schema: errorResponseSchema(400, 'User not found'),
    }),
    ApiUnauthorizedResponse({
      description:
        'Unauthorized - Invalid token or organization trying to resend for another user',
      schema: errorResponseSchema(
        401,
        'You can only resend credentials for your own account',
      ),
    }),
    ApiForbiddenResponse({
      description:
        'Forbidden - Insufficient permissions (not admin or organization)',
      schema: errorResponseSchema(403, 'Forbidden'),
    }),
  );

// Swagger decorator for GET /auth/me
export const SwaggerGetMyProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get authenticated user profile',
      description: `
Returns the complete profile of the authenticated user based on their role.

**Supported User Roles:**
- \`admin\`: Returns user account information
- \`subadmin\`: Returns subadmin profile with first_name, last_name, etc.
- \`organization\`: Returns organization profile with company details
- \`organization_member\`: Returns employee profile with position, department, etc.
- \`auditor\`: Returns auditor profile with assigned certificates, status, etc.
- \`reviewer\`: Returns reviewer profile with tags, account status, etc.

**Response Format:**
The response includes all profile-specific fields plus user email and role.

**Authentication**: Required (JWT token)
      `,
    }),
    ApiOkResponse({
      description: 'Profile retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Profile retrieved successfully',
          },
          data: {
            type: 'object',
            description: 'Profile data varies based on user role',
            additionalProperties: true,
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiBadRequestResponse({
      description: 'User not found',
      schema: errorResponseSchema(400, 'Bad Request'),
    }),
    ApiNotFoundResponse({
      description: 'Profile not found for the user',
      schema: errorResponseSchema(404, 'Not Found'),
    }),
  );
