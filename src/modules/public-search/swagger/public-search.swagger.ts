import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

// ──────────────────────────────────────────────────────────
// Error response schema helper
// ──────────────────────────────────────────────────────────
const errorResponseSchema = (statusCode: number, message: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    statusCode: { type: 'number', example: statusCode },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: '/api/search' },
  },
});

// ──────────────────────────────────────────────────────────
// Response examples
// ──────────────────────────────────────────────────────────
export const ORGANIZATION_PROFILE_EXAMPLE = {
  organization_name: 'GreenStay Dubai Marina',
  legal_registered_name: 'GreenStay Holdings LLC',
  industry_type: null,
  headquarters_location: 'Dubai, UAE',
  total_employees: 120,
  website: null,
  about_organization: 'Sustainable hospitality group focused on eco-friendly practices.',
  is_verified: true,
};

export const ORGANIZATION_PROFILE_RESPONSE_EXAMPLE = {
  message: 'Organization retrieved successfully',
  data: ORGANIZATION_PROFILE_EXAMPLE,
};

export const ORGANIZATION_METRICS_EXAMPLE = {
  total_branches: 6,
  certified_branches: 1,
  assured_certificates: 1,
  self_disclosures: 34,
};

export const ORGANIZATION_METRICS_RESPONSE_EXAMPLE = {
  message: 'Organization metrics retrieved successfully',
  data: ORGANIZATION_METRICS_EXAMPLE,
};

export const BRANCH_CERTIFICATE_EXAMPLE = {
  id: '770e8400-e29b-41d4-a716-446655440010',
  certificate_name: 'Workplace - Human Rights',
  certificate_number: 'ACES-2026-000007',
  issued_at: '2026-04-10T12:10:05.215Z',
  expiry_date: '2027-04-10T00:00:00.000Z',
  audited: true,
  reviewed: true,
  type: 'assured',
  status: 'active',
};

export const BRANCH_WITH_CERTIFICATES_EXAMPLE = {
  id: '660e8400-e29b-41d4-a716-446655440005',
  name: 'GreenStay Dubai Marina',
  city: 'Dubai',
  country: 'United Arab Emirates',
  status: 'active',
  is_main: true,
  certifications_count: 3,
  assured_certificates_count: 2,
  self_disclosure_certificates_count: 1,
  certificates: [
    BRANCH_CERTIFICATE_EXAMPLE,
    {
      ...BRANCH_CERTIFICATE_EXAMPLE,
      id: '770e8400-e29b-41d4-a716-446655440011',
      certificate_number: 'ACES-2026-000008',
      issued_at: '2026-03-15T00:00:00.000Z',
      expiry_date: '2027-03-15T00:00:00.000Z',
      audited: false,
      reviewed: false,
      type: 'self_disclosure',
    },
  ],
};

export const ORGANIZATION_BRANCHES_RESPONSE_EXAMPLE = {
  message: 'Organization branches retrieved successfully',
  data: [
    BRANCH_WITH_CERTIFICATES_EXAMPLE,
    {
      id: '660e8400-e29b-41d4-a716-446655440006',
      name: 'GreenStay Abu Dhabi',
      city: 'Abu Dhabi',
      country: 'United Arab Emirates',
      status: 'active',
      is_main: false,
      certifications_count: 0,
      assured_certificates_count: 0,
      self_disclosure_certificates_count: 0,
      certificates: [],
    },
  ],
  pagination: {
    total: 4,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  },
};

export const CERTIFICATE_DETAIL_EXAMPLE = {
  id: '770e8400-e29b-41d4-a716-446655440010',
  certificate_number: 'ACES-2024-TC-001',
  certificate_name: 'Workplace - Human Rights',
  certificate_id: 'CERT-WH-001',
  organization_id: '550e8400-e29b-41d4-a716-446655440001',
  organization_name: 'TechCorp Industries',
  organization_logo:
    'https://res.cloudinary.com/account/image/upload/v123/org/logo.png',
  branch_id: '660e8400-e29b-41d4-a716-446655440005',
  branch_name: 'GreenStay Dubai Marina',
  scope: 'Work Human Rights',
  badge_name: 'Gold',
  badge_color: '#FFD700',
  review_score: 85,
  issued_at: '2024-02-01T00:00:00.000Z',
  expiry_date: '2026-02-01T00:00:00.000Z',
  audit_start: '2024-01-15T00:00:00.000Z',
  audit_end: '2024-01-30T00:00:00.000Z',
  is_blocked: false,
  status: 'active',
  auditor_signature:
    'https://res.cloudinary.com/account/image/upload/v123/auditors/signature.png',
  reviewer_signature:
    'https://res.cloudinary.com/account/image/upload/v123/reviewers/signature.png',
  assurance_details: [
    {
      id: '880e8400-e29b-41d4-a716-446655440020',
      type: 'audit',
      status: 'completed',
      details: 'All compliance criteria met. No major findings.',
    },
  ],
};

export const CERTIFICATE_DETAIL_RESPONSE_EXAMPLE = {
  message: 'Certificate retrieved successfully',
  data: CERTIFICATE_DETAIL_EXAMPLE,
};

// ──────────────────────────────────────────────────────────
// GET /search/organizations/:id
// ──────────────────────────────────────────────────────────
export function SwaggerGetOrganizationProfile() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get organization details',
      description:
        'Returns the public-facing organization details for the Organization Details page. Includes verification status (is_verified is organization-level, NOT certificate-based). No authentication required.',
    }),
    ApiParam({
      name: 'id',
      description: 'Organization UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiOkResponse({
      description: 'Organization retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              organization_name: { type: 'string' },
              legal_registered_name: { type: 'string', nullable: true },
              industry_type: { type: 'string', nullable: true },
              headquarters_location: { type: 'string', nullable: true },
              total_employees: { type: 'integer' },
              website: { type: 'string', nullable: true, format: 'uri' },
              about_organization: { type: 'string', nullable: true },
              is_verified: {
                type: 'boolean',
                description:
                  'Organization-level verification status. NOT derived from certificates.',
              },
            },
          },
        },
        example: ORGANIZATION_PROFILE_RESPONSE_EXAMPLE,
      },
    }),
    ApiNotFoundResponse({
      description: 'Organization not found for the given ID',
      schema: errorResponseSchema(404, 'Organization not found'),
    }),
    ApiBadRequestResponse({
      description: 'Invalid UUID format',
      schema: errorResponseSchema(400, 'Validation failed'),
    }),
  );
}

// ──────────────────────────────────────────────────────────
// GET /search/organizations/:id/metrics
// ──────────────────────────────────────────────────────────
export function SwaggerGetOrganizationMetrics() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get organization dashboard metrics',
      description:
        'Returns business-meaningful metrics for the organization public page: total branches, certified branches, assured certificates, and self-assessment count. No authentication required.',
    }),
    ApiParam({
      name: 'id',
      description: 'Organization UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiOkResponse({
      description: 'Organization metrics retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              total_branches: {
                type: 'number',
                description: 'Total number of branches in the organization',
              },
              certified_branches: {
                type: 'number',
                description:
                  'Number of distinct branches that have at least one issued certificate',
              },
              assured_certificates: {
                type: 'number',
                description:
                  'Total number of non-blocked issued certificates of type "assured"',
              },
              self_disclosures: {
                type: 'number',
                description:
                  'Total number of completed self-disclosure assessments for the organization',
              },
            },
          },
        },
        example: ORGANIZATION_METRICS_RESPONSE_EXAMPLE,
      },
    }),
    ApiNotFoundResponse({
      description: 'Organization not found for the given ID',
      schema: errorResponseSchema(404, 'Organization not found'),
    }),
    ApiBadRequestResponse({
      description: 'Invalid UUID format',
      schema: errorResponseSchema(400, 'Validation failed'),
    }),
  );
}

// ──────────────────────────────────────────────────────────
// GET /search/organizations/:id/branches
// ──────────────────────────────────────────────────────────
export function SwaggerGetOrganizationBranches() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get organization branches with certifications',
      description:
        'Returns a paginated list of branches belonging to the organization. Each branch includes its nested issued certificates with badge details, status (active/expired/blocked), and review score. Supports filtering by branch type (main/sub) and status. No authentication required.',
    }),
    ApiParam({
      name: 'id',
      description: 'Organization UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
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
      description: 'Results per page (default: 10, max: 100)',
      example: 10,
    }),
    ApiQuery({
      name: 'type',
      required: false,
      enum: ['all', 'main', 'sub'],
      description:
        'Filter by branch type. "main" returns only the main/HQ branch; "sub" returns non-main branches; "all" returns both (default: all)',
      example: 'all',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: ['all', 'active', 'inactive'],
      description: 'Filter by branch status (default: all)',
      example: 'all',
    }),
    ApiOkResponse({
      description: 'Organization branches retrieved successfully',
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
                city: { type: 'string', nullable: true },
                country: { type: 'string', nullable: true },
                status: {
                  type: 'string',
                  enum: ['active', 'inactive'],
                },
                is_main: {
                  type: 'boolean',
                  description:
                    'True if this is the main/HQ branch of the organization',
                },
                certifications_count: {
                  type: 'number',
                  description:
                    'Number of non-blocked issued certificates for this branch',
                },
                assured_certificates_count: {
                  type: 'number',
                  description: 'Number of assured certificates for this branch',
                },
                self_disclosure_certificates_count: {
                  type: 'number',
                  description: 'Number of self-disclosure certificates for this branch',
                },
                certificates: {
                  type: 'array',
                  description: 'Issued certificates belonging to this branch',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      certificate_name: {
                        type: 'string',
                        description:
                          'Name of the certification (e.g. Workplace - Human Rights)',
                      },
                      certificate_number: {
                        type: 'string',
                        description:
                          'Unique certificate number (e.g. ACES-2024-TC-001)',
                      },
                      issued_at: { type: 'string', format: 'date-time' },
                      expiry_date: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                      },
                      audited: {
                        type: 'boolean',
                        description: 'Whether an auditor was assigned to this certificate',
                      },
                      reviewed: {
                        type: 'boolean',
                        description: 'Whether a reviewer was assigned to this certificate',
                      },
                      type: {
                        type: 'string',
                        enum: ['assured', 'self_disclosure'],
                        description: 'Certificate assessment type',
                      },
                      status: {
                        type: 'string',
                        enum: ['active', 'expired'],
                        description:
                          'Derived status: expired if expiry_date < now, otherwise active (blocked certificates are filtered out)',
                      },
                    },
                  },
                },
              },
            },
          },
          pagination: {
            type: 'object',
            properties: {
              total: {
                type: 'number',
                description: 'Total number of branches matching filters',
              },
              page: { type: 'number' },
              pageSize: { type: 'number' },
              totalPages: { type: 'number' },
            },
          },
        },
        example: ORGANIZATION_BRANCHES_RESPONSE_EXAMPLE,
      },
    }),
    ApiNotFoundResponse({
      description: 'Organization not found for the given ID',
      schema: errorResponseSchema(404, 'Organization not found'),
    }),
    ApiBadRequestResponse({
      description: 'Invalid UUID format or invalid query parameters',
      schema: errorResponseSchema(400, 'Validation failed'),
    }),
  );
}

// ──────────────────────────────────────────────────────────
// GET /search/certificates/:certificateNumber
// ──────────────────────────────────────────────────────────
export function SwaggerGetCertificateByNumber() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get certificate detail by certificate number',
      description:
        'Returns the full certificate verification page data including organization info, branch, badge tier, audit/review period, derived status (active/expired/blocked), and assurance details. This is the endpoint used for QR code certificate verification. No authentication required.',
    }),
    ApiParam({
      name: 'certificateNumber',
      description:
        'Unique certificate number printed on the certificate (e.g. ACES-2024-TC-001)',
      type: 'string',
      example: 'ACES-2024-TC-001',
    }),
    ApiOkResponse({
      description: 'Certificate retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              certificate_number: {
                type: 'string',
                description:
                  'Unique certificate number (e.g. ACES-2024-TC-001)',
              },
              certificate_name: {
                type: 'string',
                description:
                  'Certification type name (e.g. Workplace - Human Rights)',
              },
              certificate_id: {
                type: 'string',
                description:
                  'Certificate definition ID from the certificates table',
              },
              organization_id: { type: 'string', format: 'uuid' },
              organization_name: { type: 'string' },
              organization_logo: {
                type: 'string',
                nullable: true,
                description: 'Cloudinary URL of organization logo',
              },
              branch_id: {
                type: 'string',
                format: 'uuid',
                nullable: true,
              },
              branch_name: { type: 'string', nullable: true },
              scope: {
                type: 'string',
                description: 'Certification scope / area of focus',
              },
              badge_name: {
                type: 'string',
                nullable: true,
                description: 'Badge tier (e.g. Gold, Silver, Bronze)',
              },
              badge_color: {
                type: 'string',
                nullable: true,
                description: 'Hex color of the badge',
              },
              review_score: {
                type: 'number',
                nullable: true,
                description: 'Audit review score (0-100)',
              },
              issued_at: {
                type: 'string',
                format: 'date-time',
                description: 'Date the certificate was issued',
              },
              expiry_date: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                description: 'Expiry date of the certificate',
              },
              audit_start: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                description: 'Start date of the audit period',
              },
              audit_end: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                description: 'End date of the audit/review period',
              },
              is_blocked: {
                type: 'boolean',
                description: 'Whether the certificate has been blocked',
              },
              status: {
                type: 'string',
                enum: ['active', 'expired', 'blocked'],
                description:
                  'Derived status: blocked if is_blocked=true, expired if expiry_date < now, otherwise active',
              },
              auditor_signature: {
                type: 'string',
                nullable: true,
                description:
                  'Cloudinary URL of the assigned auditor signature',
              },
              reviewer_signature: {
                type: 'string',
                nullable: true,
                description: 'Cloudinary URL of the reviewer signature',
              },
              assurance_details: {
                type: 'array',
                description:
                  'Assurance and verification records from audits',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    type: {
                      type: 'string',
                      description:
                        'Audit lifecycle type (e.g. audit, review)',
                    },
                    status: {
                      type: 'string',
                      description:
                        'Status of the assurance step (e.g. completed, pending)',
                    },
                    details: {
                      type: 'string',
                      nullable: true,
                      description: 'Audit summary or notes',
                    },
                  },
                },
              },
            },
          },
        },
        example: CERTIFICATE_DETAIL_RESPONSE_EXAMPLE,
      },
    }),
    ApiNotFoundResponse({
      description: 'No certificate found with the given certificate number',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
    ApiBadRequestResponse({
      description: 'Invalid certificate number format',
      schema: errorResponseSchema(400, 'Validation failed'),
    }),
  );
}

// ──────────────────────────────────────────────────────────
// GET /search/certificate-detail
// ──────────────────────────────────────────────────────────
export function SwaggerGetCertificateByIds() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get certificate details by issued certificate ID',
      description:
        'Returns full certificate details for a specific issued certificate. Expiry date is taken from the record if set, otherwise computed from issued_at + certificate validity period. Includes badge tier, score, validity label, auditor, reviewer, branch info, and assurance details. No authentication required.',
    }),
    ApiQuery({
      name: 'certificate_id',
      required: true,
      type: String,
      description: 'Issued certificate UUID (issued_certificates.id)',
      example: '770e8400-e29b-41d4-a716-446655440010',
    }),
    ApiOkResponse({
      description: 'Certificate details retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              certificate_number: { type: 'string' },
              certificate_name: { type: 'string' },
              certificate_id: { type: 'string' },
              organization_id: { type: 'string', format: 'uuid' },
              organization_name: { type: 'string' },
              organization_logo: { type: 'string', nullable: true },
              branch_id: { type: 'string', format: 'uuid', nullable: true },
              branch_name: { type: 'string', nullable: true },
              branch_city: { type: 'string', nullable: true },
              branch_country: { type: 'string', nullable: true },
              scope: { type: 'string' },
              badge_name: { type: 'string', nullable: true },
              badge_color: { type: 'string', nullable: true },
              review_score: { type: 'number', nullable: true },
              issued_at: { type: 'string', format: 'date-time' },
              expiry_date: { type: 'string', format: 'date-time', nullable: true },
              audit_start: { type: 'string', format: 'date-time', nullable: true },
              audit_end: { type: 'string', format: 'date-time', nullable: true },
              assessment_type: { type: 'string', enum: ['assured', 'self_disclosure'] },
              is_blocked: { type: 'boolean' },
              status: { type: 'string', enum: ['active', 'expired', 'blocked'] },
              validity_days: { type: 'number', nullable: true },
              validity_months: { type: 'number', nullable: true },
              validity_years: { type: 'number', nullable: true },
              validity_label: { type: 'string', nullable: true, description: 'Human-readable validity period e.g. "2 Years", "6 Months, 15 Days"' },
              auditor: {
                nullable: true,
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  signature: {
                    type: 'string',
                    nullable: true,
                    description:
                      'Cloudinary URL of the auditor signature (null if none uploaded yet)',
                  },
                },
              },
              reviewer: {
                nullable: true,
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  signature: {
                    type: 'string',
                    nullable: true,
                    description:
                      'Cloudinary URL of the reviewer signature (null if none uploaded yet)',
                  },
                },
              },
              assurance_details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    type: { type: 'string' },
                    status: { type: 'string' },
                    details: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
        example: {
          message: 'Certificate details retrieved successfully',
          data: {
            ...CERTIFICATE_DETAIL_EXAMPLE,
            branch_city: 'Dubai',
            branch_country: 'United Arab Emirates',
            assessment_type: 'assured',
            validity_days: null,
            validity_months: null,
            validity_years: 2,
            auditor: {
              id: '880e8400-e29b-41d4-a716-446655440030',
              first_name: 'John',
              last_name: 'Smith',
              signature:
                'https://res.cloudinary.com/account/image/upload/v123/auditors/signature.png',
            },
            reviewer: {
              id: '880e8400-e29b-41d4-a716-446655440031',
              first_name: 'Jane',
              last_name: 'Doe',
              signature:
                'https://res.cloudinary.com/account/image/upload/v123/reviewers/signature.png',
            },
          },
        },
      },
    }),
    ApiNotFoundResponse({
      description: 'No issued certificate found for the given combination',
      schema: errorResponseSchema(404, 'Certificate not found'),
    }),
    ApiBadRequestResponse({
      description: 'Missing or invalid query parameters',
      schema: errorResponseSchema(400, 'Validation failed'),
    }),
  );
}

// ──────────────────────────────────────────────────────────
// GET /search/organizations (existing — adding proper swagger)
// ──────────────────────────────────────────────────────────
export function SwaggerListOrganizations() {
  return applyDecorators(
    ApiOperation({
      summary: 'List organizations',
      description:
        'Returns a lightweight paginated list of all organizations with id, name, and description. No authentication required.',
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
      description: 'Results per page (default: 10, max: 100)',
      example: 10,
    }),
    ApiOkResponse({
      description: 'Organizations listed successfully',
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
                description: { type: 'string', nullable: true },
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
        example: {
          message: 'Organizations retrieved successfully',
          data: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              name: 'TechCorp Industries',
              description: 'A leading technology company',
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440002',
              name: 'GreenStay Group',
              description: null,
            },
          ],
          pagination: {
            total: 25,
            page: 1,
            pageSize: 10,
            totalPages: 3,
          },
        },
      },
    }),
  );
}

// ──────────────────────────────────────────────────────────
// GET /search (existing — adding proper swagger)
// ──────────────────────────────────────────────────────────
export function SwaggerSearch() {
  return applyDecorators(
    ApiOperation({
      summary: 'Search organizations and certificates',
      description:
        'Public search endpoint. Query matches organization name, certificate name, industry name, description, certificate number, etc. Supports filtering by country, industry, organization, and certificate. No authentication required.',
    }),
    ApiOkResponse({
      description: 'Search results returned successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          organizations: {
            type: 'object',
            nullable: true,
            description:
              'Returned when type is "all" or "organization"',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    logo: { type: 'string', nullable: true },
                    legal_city: { type: 'string', nullable: true },
                    legal_state: { type: 'string', nullable: true },
                    legal_country: { type: 'string', nullable: true },
                    contact_no: { type: 'string', nullable: true },
                    email: { type: 'string', nullable: true },
                    website: { type: 'string', nullable: true },
                    industries: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          name: { type: 'string' },
                        },
                      },
                    },
                    total_certificates: { type: 'number' },
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
          },
          certificates: {
            type: 'object',
            nullable: true,
            description:
              'Returned when type is "all" or "certificate"',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    certificate_name: { type: 'string' },
                    certificate_number: { type: 'string' },
                    certificate_id: { type: 'string' },
                    organization_id: { type: 'string', format: 'uuid' },
                    organization_name: { type: 'string' },
                    organization_logo: {
                      type: 'string',
                      nullable: true,
                    },
                    branch_id: {
                      type: 'string',
                      format: 'uuid',
                      nullable: true,
                    },
                    branch_name: { type: 'string', nullable: true },
                    badge_name: { type: 'string', nullable: true },
                    badge_color: { type: 'string', nullable: true },
                    review_score: { type: 'number', nullable: true },
                    issued_at: { type: 'string', format: 'date-time' },
                    expiry_date: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                    },
                    is_blocked: { type: 'boolean' },
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
          },
        },
        example: {
          message: 'Search results retrieved successfully',
          organizations: {
            data: [ORGANIZATION_PROFILE_EXAMPLE],
            pagination: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
          },
          certificates: {
            data: [
              {
                id: '770e8400-e29b-41d4-a716-446655440010',
                certificate_name: 'Workplace - Human Rights',
                certificate_number: 'ACES-2024-TC-001',
                certificate_id: 'CERT-WH-001',
                organization_id: '550e8400-e29b-41d4-a716-446655440001',
                organization_name: 'TechCorp Industries',
                organization_logo: null,
                branch_id: '660e8400-e29b-41d4-a716-446655440005',
                branch_name: 'GreenStay Dubai Marina',
                badge_name: 'Gold',
                badge_color: '#FFD700',
                review_score: 85,
                issued_at: '2024-02-01T00:00:00.000Z',
                expiry_date: '2026-02-01T00:00:00.000Z',
                is_blocked: false,
              },
            ],
            pagination: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
          },
        },
      },
    }),
  );
}
