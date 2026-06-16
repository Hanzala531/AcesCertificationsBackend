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
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { UpdateCertificateDto } from '../dto/update-certificate.dto';
import { UpdateMainSectionDto } from '../dto/update-main-section.dto';
import { UpdateSectionDto } from '../dto/update-section.dto';
import { UpdateSubsectionDto } from '../dto/update-subsection.dto';
import { UpdateQuestionDto } from '../dto/update-question.dto';
import { CreateMainSectionsDto } from '../dto/create-main-sections.dto';
import { CreateSubsectionsDto } from '../dto/create-subsections.dto';
import { AddQuestionsDto } from '../dto/add-questions.dto';
import { BulkAddQuestionsDto } from '../dto/bulk-add-questions.dto';

// Error response schema
const errorResponseSchema = (statusCode: number, message: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: '/api/certificates' },
  },
});

// Response examples
const CREATE_CERTIFICATE_RESPONSE = {
  success: true,
  message: 'Certificate created successfully',
  data: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    certificate_id: 'CERT-2024-001',
  },
  statusCode: 201,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const GET_CERTIFICATES_RESPONSE = {
  success: true,
  message: 'Certificates retrieved successfully',
  data: {
    data: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        certificate_id: 'CERT-2024-001',
        name: 'Safety Compliance Certificate',
        industry_name: 'Construction',
        badges_count: 3,
        sections_count: 5,
        questions_count: 42,
        total_assessments_done: 120,
        total_people_received: 48,
        created_by: {
          id: '8f9f8a7e-8a8f-4f6c-b123-2a88df71b777',
          role: 'admin',
          name: 'John Admin',
        },
      },
    ],
    total: 25,
    page: 1,
    limit: 10,
  },
  statusCode: 200,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const GET_CERTIFICATE_BY_ID_RESPONSE = {
  success: true,
  message: 'Certificate retrieved successfully',
  data: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    certificate_id: 'CERT-2024-001',
    name: 'Safety Compliance Certificate',
    industry_ids: ['a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'],
    disclosure_price: 1500.0,
    assured_price: 2000.0,
    validity_days: 0,
    validity_months: 0,
    validity_years: 1,
    compulsory_docs: ['ISO Certificate', 'Business License'],
    description: 'Annual safety audit certificate',
    is_published: false,
    questions_count: 2,
    created_at: '2026-01-13T12:00:00.000Z',
    updated_at: '2026-01-13T12:00:00.000Z',
    badges: [
      {
        id: 'b1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
        slot: 1,
        name: 'Gold',
        colors: [
          {
            id: 'c1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
            color: '#FFD700',
            min_score: 90,
            max_score: 100,
          },
          {
            id: 'c2b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c7',
            color: '#FFA500',
            min_score: 80,
            max_score: 89,
          },
        ],
      },
      {
        id: 'b2b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c7',
        slot: 2,
        name: 'Silver',
        colors: [
          {
            id: 'c3b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c8',
            color: '#C0C0C0',
            min_score: 70,
            max_score: 79,
          },
        ],
      },
      {
        id: 'b3b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c8',
        slot: 3,
        name: 'Bronze',
        colors: [
          {
            id: 'c4b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c9',
            color: '#CD7F32',
            min_score: 50,
            max_score: 69,
          },
        ],
      },
    ],
    main_sections: [
      {
        id: 'm1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
        name: 'Safety Compliance',
        rank: 1,
        sections: [
          {
            id: 's1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
            name: 'Fire Safety',
            rank: 1,
            questions_count: 1,
            questions: [
              {
                id: 'q1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                certificate_id: '550e8400-e29b-41d4-a716-446655440000',
                main_section_id: 'm1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                section_id: 's1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                sub_section_id: null,
                question: 'Are all fire extinguishers serviced within the last 12 months?',
                hint: 'Check the inspection tag on each extinguisher.',
                type: 'boolean',
                is_third_level: false,
                criteria: 'All extinguishers must have a valid service tag.',
                options: null,
                score: 50,
                rank: 1,
                question_number: 1,
                certificate_question_number: 1,
                parent_question_id: null,
                parent_trigger_value: null,
                section_name: 'Fire Safety',
                sub_section_name: null,
                yes_sub_questions: [
                  {
                    id: 'q1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c7',
                    question: 'How many fire extinguishers are on site?',
                    type: 'number',
                    hint: null,
                    criteria: null,
                    options: null,
                    score: 30,
                    rank: 2,
                    question_number: 2,
                    certificate_question_number: 2,
                    parent_question_id: 'q1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                    parent_trigger_value: 'yes',
                    created_at: '2026-01-13T12:00:00.000Z',
                    updated_at: '2026-01-13T12:00:00.000Z',
                  },
                  {
                    id: 'q1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c8',
                    question: 'Upload the most recent fire extinguisher service report.',
                    type: 'file',
                    hint: null,
                    criteria: null,
                    options: null,
                    score: 40,
                    rank: 3,
                    question_number: 3,
                    certificate_question_number: 3,
                    parent_question_id: 'q1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                    parent_trigger_value: 'yes',
                    created_at: '2026-01-13T12:00:00.000Z',
                    updated_at: '2026-01-13T12:00:00.000Z',
                  },
                ],
                no_sub_questions: [
                  {
                    id: 'q1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c9',
                    question: 'List overdue extinguishers and provide a confirmed service booking date.',
                    type: 'text',
                    hint: null,
                    criteria: 'Booking must be confirmed within 7 days.',
                    options: null,
                    score: 20,
                    rank: 4,
                    question_number: 4,
                    certificate_question_number: 4,
                    parent_question_id: 'q1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                    parent_trigger_value: 'no',
                    created_at: '2026-01-13T12:00:00.000Z',
                    updated_at: '2026-01-13T12:00:00.000Z',
                  },
                ],
                created_at: '2026-01-13T12:00:00.000Z',
                updated_at: '2026-01-13T12:00:00.000Z',
              },
            ],
            sub_sections: [
              {
                id: 'ss1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                name: 'Extinguishers',
                rank: 1,
                questions_count: 1,
                questions: [
                  {
                    id: 'q2b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c7',
                    certificate_id: '550e8400-e29b-41d4-a716-446655440000',
                    main_section_id: 'm1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                    section_id: 's1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                    sub_section_id: 'ss1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
                    question: 'What type of extinguisher is present?',
                    hint: null,
                    type: 'multiple_choice',
                    is_third_level: true,
                    criteria: 'Document the specific type for compliance verification',
                    options: null,
                    score: 30,
                    rank: 1,
                    question_number: 1,
                    certificate_question_number: 5,
                    parent_question_id: null,
                    parent_trigger_value: null,
                    section_name: 'Fire Safety',
                    sub_section_name: 'Extinguishers',
                    yes_sub_questions: [],
                    no_sub_questions: [],
                    created_at: '2026-01-13T12:00:00.000Z',
                    updated_at: '2026-01-13T12:00:00.000Z',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  statusCode: 200,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const DELETE_CERTIFICATE_RESPONSE = {
  success: true,
  message: 'Certificate deleted successfully',
  deletedId: '550e8400-e29b-41d4-a716-446655440000',
  statusCode: 200,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const DELETE_MAIN_SECTION_RESPONSE = {
  success: true,
  message: 'Main section and all its children deleted successfully',
  deletedId: '550e8400-e29b-41d4-a716-446655440001',
  statusCode: 200,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const CREATE_MAIN_SECTIONS_RESPONSE = {
  success: true,
  message: '2 main section(s) created successfully',
  data: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Safety Compliance',
      rank: 1,
      level: 1,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Environmental Standards',
      rank: 2,
      level: 1,
    },
  ],
  statusCode: 201,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const CREATE_SUBSECTIONS_RESPONSE = {
  success: true,
  message: '2 subsection(s) created successfully',
  data: [
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Fire Safety',
      rank: 1,
      level: 2,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Equipment Inspection',
      rank: 2,
      level: 2,
    },
  ],
  nextStep:
    '✅ Created Level 2 sections. Next: Create Level 3 subsections using these IDs with parent_type: "SECTION", OR add questions directly to sections using section_type: "SECTION"',
  hierarchy: {
    createdLevel: 2,
    explanation: 'Level 2 (Sections) - can hold questions or subsections',
    note: 'Hierarchy: Certificate → Main Section → Section → Subsection. Questions can be added to Sections or Subsections.',
  },
  statusCode: 201,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const ADD_QUESTIONS_RESPONSE = {
  success: true,
  message: '1 question(s) added successfully to subsection (is_third_level: true)',
  data: {
    created_count: 1,
    questions: [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        question: 'Are all fire extinguishers serviced within the last 12 months?',
        type: 'boolean',
        rank: 1,
        question_number: 1,
        certificate_question_number: 5,
        score: 50,
        parent_question_id: null,
        parent_trigger_value: null,
        yes_sub_questions: [
          { id: '550e8400-e29b-41d4-a716-446655440012', question: 'How many extinguishers are on site?', type: 'number', rank: 2, question_number: 2, certificate_question_number: 6, score: 30, parent_question_id: '550e8400-e29b-41d4-a716-446655440010', parent_trigger_value: 'yes', hint: null, criteria: null, options: null, created_at: '2026-01-13T12:00:00.000Z', updated_at: '2026-01-13T12:00:00.000Z' },
        ],
        no_sub_questions: [
          { id: '550e8400-e29b-41d4-a716-446655440013', question: 'List overdue extinguishers and booking date.', type: 'text', rank: 3, question_number: 3, certificate_question_number: 7, score: 20, parent_question_id: '550e8400-e29b-41d4-a716-446655440010', parent_trigger_value: 'no', hint: null, criteria: 'Booking within 7 days.', options: null, created_at: '2026-01-13T12:00:00.000Z', updated_at: '2026-01-13T12:00:00.000Z' },
        ],
      },
    ],
  },
  statusCode: 201,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const PUBLISH_CERTIFICATE_RESPONSE = {
  success: true,
  message: 'Certificate published successfully',
  data: {
    certificateId: '550e8400-e29b-41d4-a716-446655440000',
    is_published: true,
  },
  statusCode: 200,
  timestamp: '2026-01-13T12:00:00.000Z',
};

const UNPUBLISH_CERTIFICATE_RESPONSE = {
  success: true,
  message: 'Certificate unpublished successfully',
  data: {
    certificateId: '550e8400-e29b-41d4-a716-446655440000',
    is_published: false,
  },
  statusCode: 200,
  timestamp: '2026-01-13T12:00:00.000Z',
};

//  POST /certificates
export function SwaggerCreateCertificate() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create a new certificate with badges',
      description: `Creates a certificate with exactly 3 badges. Each badge must have 1-4 colors with score ranges.
      
**Validation Rules:**
- Certificate must have exactly 3 badges
- Badge slots must be unique and include 1, 2, and 3
- Badge names must be unique within the certificate
- Each badge can have 1-4 colors
- Colors within a badge must be unique
- min_score must be less than or equal to max_score

**Required Role:** admin`,
    }),
    ApiBody({ type: CreateCertificateDto }),
    ApiCreatedResponse({
      description: 'Certificate created successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              certificate_id: { type: 'string' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: CREATE_CERTIFICATE_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description:
        'Validation error - invalid badge configuration or missing required fields',
      schema: errorResponseSchema(
        400,
        'Certificate must have exactly 3 badges',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - user does not have access to this resource',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiConflictResponse({
      description:
        'Duplicate certificate_id, badge slot, badge name, or badge color',
      schema: errorResponseSchema(409, 'Certificate ID already exists'),
    }),
    ApiInternalServerErrorResponse({
      description: 'Internal server error',
      schema: errorResponseSchema(500, 'Internal server error'),
    }),
  );
}

//  GET /certificates
export function SwaggerGetCertificates() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get all certificates with pagination',
      description: `Returns a paginated list of certificates with badges and sections count. Optionally filter by industry.
      
**Required Role:** Any authenticated user`,
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
    ApiQuery({
      name: 'industry_id',
      required: false,
      type: String,
      description: 'Filter by industry UUID',
    }),
    ApiOkResponse({
      description: 'Certificates retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
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
                    certificate_id: { type: 'string' },
                    name: { type: 'string' },
                    industry_name: { type: 'string', nullable: true },
                    badges_count: { type: 'number' },
                    sections_count: { type: 'number' },
                    questions_count: { type: 'number' },
                    total_assessments_done: { type: 'number' },
                    total_people_received: { type: 'number' },
                    created_by: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string', format: 'uuid', nullable: true },
                        role: { type: 'string', nullable: true },
                        name: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: GET_CERTIFICATES_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - user does not have access to this resource',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
  );
}

//  GET /certificates/lite
export function SwaggerGetCertificatesLite() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all certificates (lite version)',
      description: `Returns a paginated list of certificates with minimal fields: id, name, and product_id.
      
This is a lightweight endpoint suitable for dropdown lists and product catalogs.`,
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
      description: 'Certificates retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      format: 'uuid',
                      description: 'Certificate UUID',
                    },
                    name: { type: 'string', description: 'Certificate name' },
                    product_id: {
                      type: 'string',
                      description: 'Product ID (certificate_id)',
                    },
                  },
                  required: ['id', 'name', 'product_id'],
                },
              },
              total: {
                type: 'number',
                description: 'Total number of certificates',
              },
              page: { type: 'number', description: 'Current page number' },
              limit: { type: 'number', description: 'Items per page' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: {
          success: true,
          message: 'Certificates retrieved successfully',
          data: {
            data: [
              {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Safety Compliance Certificate',
                product_id: 'CERT-2024-001',
              },
              {
                id: '550e8400-e29b-41d4-a716-446655440001',
                name: 'ISO 9001 Certification',
                product_id: 'CERT-2024-002',
              },
            ],
            total: 25,
            page: 1,
            limit: 10,
          },
          statusCode: 200,
          timestamp: '2026-01-13T12:00:00.000Z',
        },
      },
    }),
  );
}

//  GET /certificates/:certificateId
export function SwaggerGetCertificateById() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get certificate by ID with full details',
      description: `Returns a certificate with all badges, colors, sections hierarchy, and questions.
      
**Hierarchy Structure:**
- Certificate
  - Badges (with colors)
  - Main Sections (Level 1)
    - Sections (Level 2) - can have direct questions (is_third_level: false)
      - Sub Sections (Level 3) - can have questions (is_third_level: true)

**Question Fields:**
- \`criteria\` - Text description of evaluation criteria

**Include Parameter:**
- \`sections\` - Include section details
- \`subsections\` or \`sub_sections\` - Include subsection details
- \`questions\` - Include full question details with answers
- Examples: \`?include=sections\`, \`?include=sections,subsections\`, \`?include=sections,subsections,questions\`

**Required Role:** Any authenticated user`,
    }),
    ApiParam({
      name: 'certificateId',
      description: 'Certificate UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiQuery({
      name: 'include',
      required: false,
      type: 'string',
      description:
        'Comma-separated list of fields to include: sections, subsections (or sub_sections), questions',
      example: 'sections,subsections,questions',
    }),
    ApiOkResponse({
      description: 'Certificate retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            description: 'Full certificate with badges and section hierarchy',
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: GET_CERTIFICATE_BY_ID_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - user does not have access to this resource',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate not found',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
  );
}

const UPDATE_CERTIFICATE_RESPONSE = {
  success: true,
  message: 'Certificate updated successfully',
  data: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    certificate_id: 'CERT-2024-001',
  },
  statusCode: 200,
  timestamp: '2026-01-13T12:00:00.000Z',
};

//  PUT /certificates/:certificateId
export function SwaggerUpdateCertificate() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update a certificate',
      description: `Updates certificate fields. All fields are optional - only provided fields will be updated.
      
**Badge Updates:**
- If \`badges\` is provided, all existing badges and their colors will be deleted and replaced with the new badges
- Badge validation rules apply (exactly 3 badges, unique slots, unique names, etc.)

**Validation Rules (when badges are provided):**
- Certificate must have exactly 3 badges
- Badge slots must be unique and include 1, 2, and 3
- Badge names must be unique within the certificate
- Each badge can have 1-4 colors
- Colors within a badge must be unique
- min_score must be less than or equal to max_score

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'certificateId',
      description: 'Certificate UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({ type: UpdateCertificateDto }),
    ApiOkResponse({
      description: 'Certificate updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              certificate_id: { type: 'string' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: UPDATE_CERTIFICATE_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description:
        'Validation error - invalid badge configuration or invalid field values',
      schema: errorResponseSchema(
        400,
        'Certificate must have exactly 3 badges',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate not found',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
    ApiInternalServerErrorResponse({
      description: 'Internal server error',
      schema: errorResponseSchema(500, 'Internal server error'),
    }),
  );
}

//  PUT /main-sections/:mainSectionId
export function SwaggerUpdateMainSection() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update a main section',
      description: `Updates main section fields. All fields are optional - only provided fields will be updated.
      
**Required Role:** admin`,
    }),
    ApiParam({
      name: 'mainSectionId',
      description: 'Main section UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiBody({ type: UpdateMainSectionDto }),
    ApiOkResponse({
      description: 'Main section updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              rank: { type: 'number' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Main section not found',
      schema: errorResponseSchema(404, 'Main section not found'),
    }),
  );
}

//  DELETE /main-sections/:mainSectionId
export function SwaggerDeleteMainSection() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Delete a main section',
      description: `Deletes a main section and all its children (sections, subsections, and questions) via cascade.
      
**Warning:** This operation is irreversible and will delete:
- All sections under this main section
- All subsections under those sections
- All questions in those sections and subsections

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'mainSectionId',
      description: 'Main section UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiOkResponse({
      description: 'Main section and all its children deleted successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          deletedId: { type: 'string', format: 'uuid' },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: DELETE_MAIN_SECTION_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Main section not found',
      schema: errorResponseSchema(404, 'Main section not found'),
    }),
  );
}

//  PUT /sections/:sectionId
export function SwaggerUpdateSection() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update a section',
      description: `Updates section fields. All fields are optional - only provided fields will be updated.
      
**Required Role:** admin`,
    }),
    ApiParam({
      name: 'sectionId',
      description: 'Section UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiBody({ type: UpdateSectionDto }),
    ApiOkResponse({
      description: 'Section updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              rank: { type: 'number' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Section not found',
      schema: errorResponseSchema(404, 'Section not found'),
    }),
  );
}

//  PUT /subsections/:subSectionId
export function SwaggerUpdateSubsection() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update a subsection',
      description: `Updates subsection fields. All fields are optional - only provided fields will be updated.
      
**Required Role:** admin`,
    }),
    ApiParam({
      name: 'subSectionId',
      description: 'Subsection UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440003',
    }),
    ApiBody({ type: UpdateSubsectionDto }),
    ApiOkResponse({
      description: 'Subsection updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              rank: { type: 'number' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Subsection not found',
      schema: errorResponseSchema(404, 'Subsection not found'),
    }),
  );
}

//  PUT /questions/:questionId
export function SwaggerUpdateQuestion() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Update a question',
      description: `Updates question fields. All fields are optional - only provided fields will be updated.
      
**Question Fields:**
- \`question\` - Question text
- \`type\` - Question type (boolean, text, multiple_choice, rating, number, file, checkbox)
- \`hint\` - Optional hint or guidance text
- \`criteria\` - Evaluation criteria text
- \`ai_review_enabled\`, \`ai_review_criteria\`, \`ai_review_score\` - AI review settings
- \`yes_score\`, \`no_score\` - Boolean scoring fields
- \`conditional_logic_enabled\` - Enables yes/no conditional actions
- \`conditional_logic.yes.redirect_to\` / \`conditional_logic.no.redirect_to\` - Redirect target for each boolean answer
- \`conditional_logic.yes.allowed_sections\` / \`conditional_logic.no.allowed_sections\` - Targets to enable for each boolean answer
- \`conditional_logic.yes.blocked_sections\` / \`conditional_logic.no.blocked_sections\` - Targets to disable for each boolean answer
- \`yes_sub_questions\`, \`no_sub_questions\` - Nested boolean follow-up questions
- \`rank\` - Question rank/order
- \`score\` - Question score value (0-999). Used for final percentage calculation.
- \`options\` - Array of option strings (required for checkbox type questions)

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'questionId',
      description: 'Question UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440010',
    }),
    ApiBody({
      type: UpdateQuestionDto,
      examples: {
        booleanConditionalLogic: {
          summary: 'Boolean question with YES/NO conditional actions',
          value: {
            type: 'boolean',
            yes_score: 100,
            no_score: 0,
            conditional_logic_enabled: true,
            conditional_logic: {
              yes: {
                redirect_to: {
                  target_type: 'section',
                  target_id: '550e8400-e29b-41d4-a716-446655440001',
                },
                allowed_sections: [
                  {
                    target_type: 'sub_section',
                    target_id: '550e8400-e29b-41d4-a716-446655440002',
                  },
                ],
                blocked_sections: [
                  {
                    target_type: 'question',
                    target_id: '550e8400-e29b-41d4-a716-446655440003',
                  },
                ],
              },
              no: {
                redirect_to: {
                  target_type: 'main_section',
                  target_id: '550e8400-e29b-41d4-a716-446655440004',
                },
              },
            },
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Question updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              question: { type: 'string' },
              rank: { type: 'number' },
              score: { type: 'number', example: 10 },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Question not found',
      schema: errorResponseSchema(404, 'Question not found'),
    }),
  );
}

//  DELETE /certificates/:certificateId
export function SwaggerDeleteCertificate() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Delete a certificate',
      description: `Deletes a certificate and all related data (badges, sections, questions) via cascade.
      
**Required Role:** admin`,
    }),
    ApiParam({
      name: 'certificateId',
      description: 'Certificate UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      description: 'Certificate deleted successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          deletedId: { type: 'string', format: 'uuid' },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: DELETE_CERTIFICATE_RESPONSE,
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate not found',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
  );
}

//  POST /main-sections
export function SwaggerCreateMainSections() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create main sections for a certificate',
      description: `Creates one or more main sections (Level 1) for a certificate.
      
**Behavior:**
- Rank is auto-computed if not provided (next available rank)
- Multiple sections can be created in one request
- Returns level: 1 for all created sections

**Next Steps:**
After creating main sections, use POST /sections/{parentId}/subsections with parent_type: "main" to create Level 2 sections.

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'certificateId',
      description: 'Certificate UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({ type: CreateMainSectionsDto }),
    ApiCreatedResponse({
      description: 'Main sections created successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                rank: { type: 'number' },
                level: { type: 'number', example: 1 },
              },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: CREATE_MAIN_SECTIONS_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Validation error',
      schema: errorResponseSchema(400, 'sections should not be empty'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate not found',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
    ApiConflictResponse({
      description: 'Duplicate rank for this certificate',
      schema: errorResponseSchema(
        409,
        'Rank already exists for this parent section',
      ),
    }),
  );
}

//  POST /subsections
export function SwaggerCreateSubsections() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create sections or subsections under a parent',
      description: `Creates sections/subsections beneath a parent. 
      
**Supported parent_type values:**
- \`main\` → Creates Sections (Level 2) under a Main Section (Level 1)
- \`section\` → Creates Subsections (Level 3) under a Section (Level 2)

**Hierarchy Limit:**
The API does NOT create deeper levels. Maximum depth is:
Certificate → Main Section → Section → Subsection

**Behavior:**
- Rank is optional and auto-computed if omitted
- Returns level indicator (2 or 3) for each created item
- Includes nextStep guidance in response

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'parentId',
      description: 'Parent section UUID (main_section or section)',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiBody({ type: CreateSubsectionsDto }),
    ApiCreatedResponse({
      description: 'Subsections created successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                rank: { type: 'number' },
                level: { type: 'number' },
              },
            },
          },
          nextStep: { type: 'string' },
          hierarchy: {
            type: 'object',
            properties: {
              createdLevel: { type: 'number' },
              explanation: { type: 'string' },
              note: { type: 'string' },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: CREATE_SUBSECTIONS_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid parent_type or validation error',
      schema: errorResponseSchema(
        400,
        'Invalid parent_type. Must be "MAIN" or "SECTION". Hierarchy is limited to: Certificate → Main Section → Section → Subsection',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Parent section not found',
      schema: errorResponseSchema(404, 'Main section not found'),
    }),
    ApiConflictResponse({
      description: 'Duplicate rank for this parent',
      schema: errorResponseSchema(
        409,
        'Rank already exists for this parent section',
      ),
    }),
  );
}

//  POST /questions
export function SwaggerAddQuestions() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Add questions to a section or subsection',
      description: `Adds one or more questions to a section or subsection.

**Section Types:**
- \`section\` → Add questions to a Section (Level 2). Sets is_third_level = false
- \`sub_section\` → Add questions to a Subsection (Level 3). Sets is_third_level = true

**Question Types:**
- \`boolean\` - Yes/No question
- \`text\` - Free text answer
- \`multiple_choice\` - Multiple choice options
- \`rating\` - Rating scale
- \`number\` - Numeric answer
- \`file\` - File upload question (respond with PDF URL using response_type: "pdf")
- \`checkbox\` - Multiple selection question (requires \`options\` array)

**Optional Fields:**
- \`hint\` - Help text for the question
- \`criteria\` - Text description of evaluation criteria
- \`rank\` - Auto-computed if not provided
- \`score\` - Question score value (0-999). Used for final percentage calculation.
- \`options\` - Array of option strings (required for checkbox type questions)
- \`ai_review_enabled\`, \`ai_review_criteria\`, \`ai_review_score\` - AI review settings
- \`yes_score\`, \`no_score\` - Boolean scoring fields
- \`conditional_logic_enabled\` - Enables yes/no conditional actions
- \`conditional_logic.yes.redirect_to\` / \`conditional_logic.no.redirect_to\` - Redirect target for each boolean answer
- \`conditional_logic.yes.allowed_sections\` / \`conditional_logic.no.allowed_sections\` - Targets to enable for each boolean answer
- \`conditional_logic.yes.blocked_sections\` / \`conditional_logic.no.blocked_sections\` - Targets to disable for each boolean answer

**Nested Sub-Questions (boolean only):**
Boolean questions support \`yes_sub_questions\` and \`no_sub_questions\` arrays.
Each sub-question supports all types (text, number, file, checkbox, multiple_choice) but cannot be nested further.
Sub-questions are shown to users based on their answer to the parent boolean question.

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'sectionId',
      description: 'Section or Subsection UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440003',
    }),
    ApiBody({
      type: AddQuestionsDto,
      examples: {
        withAiReview: {
          summary: 'Question with AI toggle enabled',
          value: {
            section_type: 'sub_section',
            questions: [
              {
                question:
                  'Describe how hazardous waste is identified, stored, and reviewed.',
                type: 'text',
                hint: 'Include labels, storage controls, and review frequency.',
                criteria:
                  'Answer should mention labeling, segregation, secure storage, and review ownership.',
                score: 50,
                ai_review_enabled: true,
                ai_review_criteria:
                  'Award full marks only when the answer clearly covers labeling, segregation, storage controls, and review responsibility.',
                ai_review_score: 50,
              },
            ],
          },
        },
        booleanWithConditionalLogic: {
          summary: 'Boolean question with YES/NO conditional logic',
          value: {
            section_type: 'section',
            questions: [
              {
                question: 'Do you have a fire safety plan?',
                type: 'boolean',
                yes_score: 100,
                no_score: 0,
                conditional_logic_enabled: true,
                conditional_logic: {
                  yes: {
                    redirect_to: {
                      target_type: 'section',
                      target_id: '550e8400-e29b-41d4-a716-446655440001',
                    },
                    allowed_sections: [
                      {
                        target_type: 'sub_section',
                        target_id: '550e8400-e29b-41d4-a716-446655440002',
                      },
                    ],
                  },
                  no: {
                    blocked_sections: [
                      {
                        target_type: 'question',
                        target_id: '550e8400-e29b-41d4-a716-446655440003',
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        booleanWithSubQuestions: {
          summary: 'Boolean question with nested sub-questions',
          value: {
            section_type: 'sub_section',
            questions: [
              {
                question:
                  'Are all fire extinguishers serviced within the last 12 months?',
                type: 'boolean',
                hint: 'Check the inspection tag on each extinguisher.',
                criteria: 'All extinguishers must have a valid service tag.',
                score: 50,
                ai_review_enabled: true,
                ai_review_criteria:
                  'The evidence should confirm all extinguishers are within their service validity period.',
                yes_sub_questions: [
                  {
                    question: 'How many fire extinguishers are on site?',
                    type: 'number',
                    hint: 'Enter total count.',
                    score: 30,
                  },
                  {
                    question: 'Upload the most recent service report.',
                    type: 'file',
                    score: 40,
                  },
                ],
                no_sub_questions: [
                  {
                    question:
                      'List overdue extinguishers and provide a confirmed booking date.',
                    type: 'text',
                    criteria: 'Booking must be within 7 days.',
                    score: 20,
                  },
                ],
              },
            ],
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Questions added successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              created_count: { type: 'number' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    question: { type: 'string' },
                    rank: { type: 'number' },
                    score: { type: 'number', example: 10 },
                  },
                },
              },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: ADD_QUESTIONS_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid section_type or question validation failed',
      schema: errorResponseSchema(
        400,
        'Invalid section_type. Must be "SECTION" or "SUB_SECTION". Questions can be attached to sections (is_third_level=false) or subsections (is_third_level=true).',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Section or subsection not found',
      schema: errorResponseSchema(
        404,
        'Section with ID "uuid" not found. Make sure you\'re using a valid section ID and that section_type is set to "SECTION" in the request body.',
      ),
    }),
  );
}

//  PUT /certificates/:certificateId/publish
export function SwaggerPublishCertificate() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Publish a certificate',
      description: `Publishes a certificate, making it visible and usable.
      
**Error Conditions:**
- Certificate not found → 404
- Certificate is already published → 400

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'certificateId',
      description: 'Certificate UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      description: 'Certificate published successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              certificateId: { type: 'string', format: 'uuid' },
              is_published: { type: 'boolean', example: true },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: PUBLISH_CERTIFICATE_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Certificate is already published',
      schema: errorResponseSchema(400, 'Certificate is already published'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate not found',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
  );
}

//  PUT /certificates/:certificateId/unpublish
export function SwaggerUnpublishCertificate() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Unpublish a certificate',
      description: `Unpublishes a certificate, making it hidden and unusable.
      
**Error Conditions:**
- Certificate not found → 404
- Certificate is already unpublished → 400

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'certificateId',
      description: 'Certificate UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      description: 'Certificate unpublished successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              certificateId: { type: 'string', format: 'uuid' },
              is_published: { type: 'boolean', example: false },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        example: UNPUBLISH_CERTIFICATE_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'Certificate is already unpublished',
      schema: errorResponseSchema(400, 'Certificate is already unpublished'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate not found',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
  );
}

//  PUT /certificates/:certificateId/publish-status
export function SwaggerSetPublishCertificate() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Set publish status for a certificate',
      description: `Sets the published status of a certificate. Pass { is_published: true } to publish or { is_published: false } to unpublish.

**Error Conditions:**
- Certificate not found → 404
- Certificate is already in the requested published state → 400

**Required Role:** admin`,
    }),
    ApiParam({
      name: 'certificateId',
      description: 'Certificate UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          is_published: { type: 'boolean', example: true },
        },
        required: ['is_published'],
      },
    }),
    ApiOkResponse({
      description: 'Certificate publish status updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              certificateId: { type: 'string', format: 'uuid' },
              is_published: { type: 'boolean', example: true },
            },
          },
          statusCode: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
    ApiBadRequestResponse({
      description:
        'Certificate already in the requested state or invalid request',
      schema: errorResponseSchema(
        400,
        'Certificate already published or unpublished',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate not found',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
  );
}

// POST /certificates/:certificateId/questions/bulk
export function SwaggerBulkAddQuestions() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Bulk add questions to multiple sections/subsections',
      description: `Adds questions to multiple sections and/or subsections in a single atomic transaction.
All entries succeed or all fail together — if any section/subsection is invalid, nothing is saved.

**Each entry requires:**
- \`section_id\` — UUID of the target section or sub-section
- \`section_type\` — \`"section"\` (Level 2) or \`"sub_section"\` (Level 3)
- \`questions\` — array of at least 1 question

**Validation:**
- All section/sub-section IDs must belong to the specified certificate
- Each question must have a valid \`question\` string and \`type\`
- \`rank\`, \`question_number\`, and \`certificate_question_number\` are auto-assigned if omitted`,
    }),
    ApiParam({
      name: 'certificateId',
      type: String,
      format: 'uuid',
      description: 'UUID of the certificate',
    }),
    ApiBody({
      type: BulkAddQuestionsDto,
      examples: {
        multiEntryWithConditionalLogic: {
          summary: 'Bulk add with boolean conditional logic fields',
          value: {
            entries: [
              {
                section_id: '550e8400-e29b-41d4-a716-446655440001',
                section_type: 'section',
                questions: [
                  {
                    question: 'Do you have a fire safety plan?',
                    type: 'boolean',
                    hint: 'Check if a written plan exists',
                    criteria: 'A documented fire safety plan must be present',
                    yes_score: 100,
                    no_score: 0,
                    conditional_logic_enabled: true,
                    conditional_logic: {
                      yes: {
                        redirect_to: {
                          target_type: 'sub_section',
                          target_id: '550e8400-e29b-41d4-a716-446655440002',
                        },
                        allowed_sections: [
                          {
                            target_type: 'question',
                            target_id: '550e8400-e29b-41d4-a716-446655440003',
                          },
                        ],
                      },
                      no: {
                        blocked_sections: [
                          {
                            target_type: 'section',
                            target_id: '550e8400-e29b-41d4-a716-446655440004',
                          },
                        ],
                      },
                    },
                    score: 100,
                  },
                ],
              },
              {
                section_id: '550e8400-e29b-41d4-a716-446655440005',
                section_type: 'sub_section',
                questions: [
                  {
                    question: 'Describe your fire safety procedures in detail',
                    type: 'text',
                    hint: 'Include evacuation routes, assembly points, and roles',
                    criteria: 'Must cover all floors and be reviewed annually',
                    ai_review_enabled: true,
                    ai_review_criteria:
                      'Award full marks only when routes, roles, and review frequency are all covered.',
                    ai_review_score: 150,
                    score: 150,
                  },
                ],
              },
            ],
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'All questions added successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: '3 question(s) added across 2 section(s)',
          },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                section_id: { type: 'string', format: 'uuid' },
                section_type: {
                  type: 'string',
                  enum: ['section', 'sub_section'],
                },
                questions_added: { type: 'integer', example: 2 },
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      question: { type: 'string' },
                      rank: { type: 'integer' },
                      question_number: { type: 'integer', nullable: true },
                      certificate_question_number: {
                        type: 'integer',
                        nullable: true,
                      },
                      criteria: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
          },
          statusCode: { type: 'integer', example: 201 },
          timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
        },
      },
    }),
    ApiBadRequestResponse({
      description:
        'Invalid section_type, validation error, or section does not belong to this certificate',
      schema: errorResponseSchema(
        400,
        'Section "uuid" does not belong to certificate "uuid"',
      ),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin or subadmin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate, section, or sub-section not found',
      schema: errorResponseSchema(404, 'Section with ID "uuid" not found'),
    }),
  );
}

// PATCH /certificates/:certificateId/reorder
export function SwaggerReorderItem() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Reorder hierarchy items (move or change_rank)',
      description:
        'Supports two payload modes. operation=move (default) handles in-place move, cross-parent move, and promote/demote conversions. operation=change_rank only changes rank inside current parent. For move payloads, new_rank is optional and item is appended to end when omitted. All sibling ranks are normalized and certificate_question_number values are recalculated in DFS pre-order.',
    }),
    ApiParam({ name: 'certificateId', type: 'string', format: 'uuid' }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['item_type', 'item_id'],
        properties: {
          operation: {
            type: 'string',
            enum: ['move', 'change_rank'],
            description:
              'Operation mode. move is default when omitted. change_rank only repositions item within current parent.',
            example: 'move',
          },
          item_type: {
            type: 'string',
            enum: ['main_section', 'section', 'sub_section', 'question'],
            description: 'Type of item being moved',
            example: 'section',
          },
          item_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID of the item to move',
            example: '550e8400-e29b-41d4-a716-446655440002',
          },
          new_parent_id: {
            type: 'string',
            format: 'uuid',
            description: 'Move mode only. UUID of the target parent. Optional for in-place move (keeps existing parent). For section: main_section id. For sub_section: section id. For question: section or sub_section id.',
            example: '550e8400-e29b-41d4-a716-446655440001',
          },
          new_parent_type: {
            type: 'string',
            enum: ['main_section', 'section', 'sub_section'],
            description: 'Move mode only. Optional for questions; API can infer from new_parent_id when omitted.',
            example: 'section',
          },
          new_item_type: {
            type: 'string',
            enum: ['main_section', 'section', 'sub_section', 'question'],
            description: 'Move mode only. Target type for promote/demote conversion.',
            example: 'main_section',
          },
          new_rank: {
            type: 'integer',
            minimum: 1,
            description: 'Required for operation=change_rank. Optional for move; if omitted in move mode, item is placed at end.',
            example: 2,
          },
        },
      },
      examples: {
        move_section_cross_parent: {
          summary: 'Move section to another main section',
          description: 'Move mode without rank. Section is appended to end in target main section.',
          value: {
            operation: 'move',
            item_type: 'section',
            item_id: '550e8400-e29b-41d4-a716-446655440002',
            new_parent_id: '550e8400-e29b-41d4-a716-446655440001',
          },
        },
        move_subsection_cross_parent: {
          summary: 'Move sub-section to another section',
          description: 'Move mode without rank. Child questions cascade their section/main references.',
          value: {
            operation: 'move',
            item_type: 'sub_section',
            item_id: '550e8400-e29b-41d4-a716-446655440004',
            new_parent_id: '550e8400-e29b-41d4-a716-446655440003',
          },
        },
        move_question_to_section_auto: {
          summary: 'Move question to section (auto parent detection)',
          description: 'Move mode. Parent type is inferred from new_parent_id.',
          value: {
            operation: 'move',
            item_type: 'question',
            item_id: '550e8400-e29b-41d4-a716-446655440010',
            new_parent_id: '550e8400-e29b-41d4-a716-446655440003',
          },
        },
        move_question_to_subsection_explicit: {
          summary: 'Move question to sub-section (explicit type)',
          description: 'Move mode with explicit new_parent_type.',
          value: {
            operation: 'move',
            item_type: 'question',
            item_id: '550e8400-e29b-41d4-a716-446655440010',
            new_parent_id: '550e8400-e29b-41d4-a716-446655440004',
            new_parent_type: 'sub_section',
          },
        },
        move_in_place_to_end: {
          summary: 'Move within same parent to end',
          description: 'Move mode in-place reorder. Parent is omitted and existing parent is reused.',
          value: {
            operation: 'move',
            item_type: 'section',
            item_id: '550e8400-e29b-41d4-a716-446655440002',
          },
        },
        promote_section_to_main: {
          summary: 'Promote section → main section',
          description: 'Converts a section into a main section. All child sub-sections and questions are reassigned to the new main section.',
          value: {
            operation: 'move',
            item_type: 'section',
            item_id: '550e8400-e29b-41d4-a716-446655440002',
            new_parent_id: '550e8400-e29b-41d4-a716-000000000000',
            new_item_type: 'main_section',
          },
        },
        demote_main_to_section: {
          summary: 'Demote main section → section',
          description: 'Converts a main section into a section under another main section. All children are reassigned.',
          value: {
            operation: 'move',
            item_type: 'main_section',
            item_id: '550e8400-e29b-41d4-a716-446655440001',
            new_parent_id: '550e8400-e29b-41d4-a716-446655440099',
            new_item_type: 'section',
          },
        },
        promote_subsection_to_section: {
          summary: 'Promote sub-section → section',
          description: 'Converts a sub-section into a section under a main section. Questions flip to is_third_level=false.',
          value: {
            operation: 'move',
            item_type: 'sub_section',
            item_id: '550e8400-e29b-41d4-a716-446655440004',
            new_parent_id: '550e8400-e29b-41d4-a716-446655440001',
            new_item_type: 'section',
          },
        },
        demote_section_to_subsection: {
          summary: 'Demote section → sub-section',
          description: 'Converts a section into a sub-section under another section. Questions flip to is_third_level=true.',
          value: {
            operation: 'move',
            item_type: 'section',
            item_id: '550e8400-e29b-41d4-a716-446655440002',
            new_parent_id: '550e8400-e29b-41d4-a716-446655440003',
            new_item_type: 'sub_section',
          },
        },
        change_rank_main_section: {
          summary: 'Change rank for a main section',
          description: 'change_rank mode only alters rank inside current parent.',
          value: {
            operation: 'change_rank',
            item_type: 'main_section',
            item_id: '550e8400-e29b-41d4-a716-446655440001',
            new_rank: 2,
          },
        },
        change_rank_section: {
          summary: 'Change rank for a section',
          description: 'change_rank mode with section payload.',
          value: {
            operation: 'change_rank',
            item_type: 'section',
            item_id: '550e8400-e29b-41d4-a716-446655440002',
            new_rank: 1,
          },
        },
        change_rank_subsection: {
          summary: 'Change rank for a sub-section',
          description: 'change_rank mode with sub-section payload.',
          value: {
            operation: 'change_rank',
            item_type: 'sub_section',
            item_id: '550e8400-e29b-41d4-a716-446655440004',
            new_rank: 3,
          },
        },
        change_rank_question: {
          summary: 'Change rank for a question',
          description: 'change_rank mode with question payload.',
          value: {
            operation: 'change_rank',
            item_type: 'question',
            item_id: '550e8400-e29b-41d4-a716-446655440010',
            new_rank: 1,
          },
        },
      },
    }),
    ApiOkResponse({
      description: 'Item reordered successfully. All certificate_question_number values are recalculated in DFS pre-order.',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Item reordered successfully' },
          data: { type: 'object', nullable: true, example: null },
          statusCode: { type: 'integer', example: 200 },
          timestamp: { type: 'string', format: 'date-time', example: '2026-04-01T12:00:00.000Z' },
        },
        example: {
          success: true,
          message: 'Item reordered successfully',
          data: null,
          statusCode: 200,
          timestamp: '2026-04-01T12:00:00.000Z',
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Validation error — invalid payload for operation mode, invalid parent/type conversion, or cross-certificate move.',
      schema: errorResponseSchema(400, 'new_rank is required when operation is "change_rank"'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have admin or subadmin role',
      schema: errorResponseSchema(403, 'Forbidden resource'),
    }),
    ApiNotFoundResponse({
      description: 'Certificate, item, or new parent not found',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
  );
}
