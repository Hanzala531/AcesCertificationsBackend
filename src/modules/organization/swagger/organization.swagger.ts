import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
} from '@nestjs/swagger';

// Error response schema
const errorResponseSchema = (statusCode: number, message: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: '/api/organization/profile' },
  },
});

// Response examples
export const ORGANIZATION_PROFILE_RESPONSE_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'TechCorp Inc',
  user_id: '660e8400-e29b-41d4-a716-446655440001',
  email: null,
  contact_no: '+1-555-123-4567',
  company_size: null,
  website: 'https://techcorp.com',
  logo: null,
  industry_ids: [
    'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
    'b2c3d4e5-f6a7-48b9-c0d1-e2f3a4b5c6d7',
  ],
  total_branches: 0,
  organization_type: null,
  business_id: 'BIZ-2024-001',
  legal_city: 'San Francisco',
  legal_state: 'California',
  legal_country: 'United States',
  description:
    'A leading technology company specializing in innovative solutions',
  legal_document_url: null,
  created_at: '2026-01-13T12:00:00.000Z',
  updated_at: '2026-01-13T12:00:00.000Z',
};

export const ORGANIZATION_GET_PROFILE_RESPONSE_EXAMPLE = {
  message: 'Organization profile retrieved successfully',
  data: ORGANIZATION_PROFILE_RESPONSE_EXAMPLE,
};

export const ORGANIZATION_UPDATED_RESPONSE_EXAMPLE = {
  message: 'Organization profile updated successfully',
  data: {
    ...ORGANIZATION_PROFILE_RESPONSE_EXAMPLE,
    name: 'TechCorp Inc Updated',
    contact_no: '+1-555-987-6543',
    website: 'https://updated-techcorp.com',
    logo: 'https://res.cloudinary.com/account/image/upload/v123/org/logo.png',
    total_branches: 5,
    organization_type: 'Technology',
    legal_document_url: 'https://s3.amazonaws.com/bucket/legal.pdf',
    updated_at: '2026-01-13T13:00:00.000Z',
  },
};

// Swagger decorator for GET /organization/profile
export const SwaggerGetOrganizationProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get organization profile',
      description:
        "Retrieve the authenticated user's organization profile. User must have an associated organization.",
    }),
    ApiOkResponse({
      description: 'Organization profile retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              user_id: { type: 'string', format: 'uuid' },
              email: { type: 'string', nullable: true },
              contact_no: { type: 'string', nullable: true },
              company_size: { type: 'string', nullable: true },
              website: { type: 'string', nullable: true },
              logo: { type: 'string', nullable: true },
              industry_ids: {
                type: 'array',
                items: { type: 'string', format: 'uuid' },
              },
              total_branches: { type: 'number' },
              organization_type: { type: 'string', nullable: true },
              business_id: { type: 'string', nullable: true },
              legal_city: { type: 'string', nullable: true },
              legal_state: { type: 'string', nullable: true },
              legal_country: { type: 'string', nullable: true },
              description: { type: 'string', nullable: true },
              legal_document_url: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: ORGANIZATION_GET_PROFILE_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Organization profile not found for this user',
      schema: errorResponseSchema(404, 'Organization profile not found'),
    }),
  );

// Swagger decorator for PUT /organization/profile
export const SwaggerUpdateOrganizationProfile = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update organization profile',
      description:
        'Update organization profile information. All fields are optional. Logo URLs must be from Cloudinary (use /uploads/images endpoint). Document URLs must be from S3 (use /uploads/documents endpoint).',
    }),
    ApiOkResponse({
      description: 'Organization profile updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              user_id: { type: 'string', format: 'uuid' },
              email: { type: 'string', nullable: true },
              contact_no: { type: 'string', nullable: true },
              company_size: { type: 'string', nullable: true },
              website: { type: 'string', nullable: true },
              logo: { type: 'string', nullable: true },
              industry_ids: {
                type: 'array',
                items: { type: 'string', format: 'uuid' },
              },
              total_branches: { type: 'number' },
              organization_type: { type: 'string', nullable: true },
              business_id: { type: 'string', nullable: true },
              legal_city: { type: 'string', nullable: true },
              legal_state: { type: 'string', nullable: true },
              legal_country: { type: 'string', nullable: true },
              description: { type: 'string', nullable: true },
              legal_document_url: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        example: ORGANIZATION_UPDATED_RESPONSE_EXAMPLE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Organization profile not found',
      schema: errorResponseSchema(404, 'Organization profile not found'),
    }),
    ApiBadRequestResponse({
      description:
        'Invalid URL format - logo must be from Cloudinary, documents from S3',
      schema: errorResponseSchema(400, 'Logo URL must be from Cloudinary'),
    }),
  );

// Swagger decorator for PUT /organization/profile/email
export const SwaggerUpdateOrganizationEmail = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update organization email',
      description:
        'Update the organization email address. Requires OTP verification sent to the current email address. Maximum 5 OTP attempts allowed before OTP is invalidated.',
    }),
    ApiOkResponse({
      description: 'Email updated successfully',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Email updated successfully',
          },
          userId: {
            type: 'string',
            format: 'uuid',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'newemail@example.com',
          },
        },
        example: {
          message: 'Email updated successfully',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'newemail@example.com',
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Organization profile not found',
      schema: errorResponseSchema(404, 'Organization profile not found'),
    }),
    ApiBadRequestResponse({
      description:
        'Invalid OTP, expired OTP, email already in use, maximum attempts exceeded, or validation error',
      schema: errorResponseSchema(400, 'Invalid OTP code'),
    }),
  );
