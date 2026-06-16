import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';

const PAGINATION_SCHEMA = {
  type: 'object',
  properties: {
    page: { type: 'number', example: 1 },
    limit: { type: 'number', example: 10 },
    total: { type: 'number', example: 25 },
    total_pages: { type: 'number', example: 3 },
  },
};

const ASSESSMENT_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    organization_id: { type: 'string', format: 'uuid' },
    organization_name: { type: 'string', example: 'Acme Corp' },
    branch_id: { type: 'string', format: 'uuid', nullable: true },
    branch_name: { type: 'string', nullable: true, example: 'Main Branch' },
    certificate_id: { type: 'string', format: 'uuid' },
    certificate_name: { type: 'string', example: 'ISO 27001' },
    assessment_type: { type: 'string', enum: ['self_disclosure', 'assured'] },
    status: { type: 'string', example: 'in_progress' },
    score: { type: 'number', nullable: true, example: 85.5 },
    badge_name: { type: 'string', nullable: true, example: 'Gold' },
    submitted_at: { type: 'string', format: 'date-time', nullable: true },
    completed_at: { type: 'string', format: 'date-time', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    total_questions: {
      type: 'number',
      nullable: true,
      example: 120,
      description:
        'Total number of questions on the certificate. Populated only for self-disclosure rows in the in-progress bucket; null otherwise.',
    },
    answered_questions: {
      type: 'number',
      nullable: true,
      example: 42,
      description:
        'Number of questions answered so far. Populated only for self-disclosure rows in the in-progress bucket; null otherwise.',
    },
    answered_percent: {
      type: 'number',
      nullable: true,
      example: 35,
      description:
        'answered_questions / total_questions × 100 (rounded). Populated only for self-disclosure rows in the in-progress bucket; null otherwise.',
    },
  },
};

const ISSUED_CERT_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    assessment_id: { type: 'string', format: 'uuid' },
    certificate_id: { type: 'string', format: 'uuid' },
    certificate_name: { type: 'string', example: 'ISO 27001' },
    organization_id: { type: 'string', format: 'uuid' },
    organization_name: { type: 'string', example: 'Acme Corp' },
    branch_id: { type: 'string', format: 'uuid', nullable: true },
    branch_name: { type: 'string', nullable: true, example: 'Main Branch' },
    badge_name: { type: 'string', nullable: true, example: 'Gold' },
    badge_color: { type: 'string', nullable: true, example: '#FFD700' },
    certificate_number: { type: 'string', example: 'CERT-0001' },
    review_score: { type: 'number', nullable: true, example: 92.0 },
    issued_at: { type: 'string', format: 'date-time' },
    expiry_date: { type: 'string', format: 'date-time', nullable: true },
    is_blocked: { type: 'boolean', example: false },
  },
};

const SECTION_SCHEMA = (itemSchema: object) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: itemSchema },
    pagination: PAGINATION_SCHEMA,
  },
});

export function SwaggerGetCertificationOverview() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get certification overview',
      description: `Aggregates certification status data across organizations, branches, assessments, and certificates.

Returns four independently paginated sections:
- **in_progress**: Self-disclosure assessments (in_progress/submitted/ai_reviewing/completed/improvement_requested) and assured assessments (any status except completed). Excludes combinations where an active issued certificate already exists.
- **active**: Issued certificates that are not expired and not blocked.
- **failed**: Assessments with status failed or rejected.
- **expired**: Issued certificates whose expiry_date has passed.

Each section supports independent pagination via query parameters (e.g. in_progress_page, in_progress_limit, active_page, active_limit, etc.).

**Edge cases handled:**
- Self-disclosure completed but assured not started: appears in in_progress
- Certificate issued but assessments still exist: assessments excluded from in_progress
- Expired certificates: appear in expired, not active
- Failed assessments mixed with active ones: correctly separated
- Empty results: returns empty data array with pagination showing total=0
- Pagination overflow: returns empty data with correct total_pages`,
    }),
    ApiOkResponse({
      description: 'Certification overview retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Certification overview retrieved successfully' },
          data: {
            type: 'object',
            properties: {
              in_progress: SECTION_SCHEMA(ASSESSMENT_ITEM_SCHEMA),
              active: SECTION_SCHEMA(ISSUED_CERT_ITEM_SCHEMA),
              failed: SECTION_SCHEMA(ASSESSMENT_ITEM_SCHEMA),
              expired: SECTION_SCHEMA(ISSUED_CERT_ITEM_SCHEMA),
            },
          },
          statusCode: { type: 'number', example: 200 },
          timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid query parameters',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          timestamp: { type: 'string' },
          path: { type: 'string' },
        },
      },
    }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' }),
    ApiInternalServerErrorResponse({ description: 'Internal server error' }),
  );
}
