import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

export function SwaggerGetRecommendedCertificates() {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    ApiOperation({
      summary: 'Get recommended certificates for organization',
      description:
        'Retrieve certificates recommended for an organization based on matching industry types. Certificates are ordered by the number of matching industries (most relevant first).',
    })(target, propertyName, descriptor);

    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      example: 1,
      description: 'Page number (default: 1)',
    })(target, propertyName, descriptor);

    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 10,
      description: 'Number of certificates per page (default: 10)',
    })(target, propertyName, descriptor);

    ApiResponse({
      status: 200,
      description: 'Recommended certificates retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: 'Recommended certificates retrieved successfully',
          },
          data: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: 'uuid' },
                    certificate_id: { type: 'string', example: 'CERT-001' },
                    name: {
                      type: 'string',
                      example: 'ISO 27001 Information Security Management',
                    },
                    industry_ids: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['uuid1', 'uuid2'],
                    },
                    industry_names: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['Technology', 'Finance'],
                    },
                    disclosure_price: { type: 'number', example: 500.0 },
                    assured_price: {
                      type: 'number',
                      example: 1000.0,
                      nullable: true,
                    },
                    validity_days: { type: 'number', example: 0 },
                    validity_months: { type: 'number', example: 0 },
                    validity_years: { type: 'number', example: 3 },
                    description: {
                      type: 'string',
                      example: 'Certificate description',
                      nullable: true,
                    },
                    is_published: { type: 'boolean', example: true },
                    created_at: {
                      type: 'string',
                      example: '2024-01-01T00:00:00.000Z',
                    },
                    matching_industries_count: { type: 'number', example: 2 },
                  },
                },
              },
              total: { type: 'number', example: 25 },
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 10 },
            },
          },
          statusCode: { type: 'number', example: 200 },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    })(target, propertyName, descriptor);

    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
    })(target, propertyName, descriptor);

    ApiResponse({
      status: 403,
      description: 'Forbidden - User does not have the required role',
    })(target, propertyName, descriptor);

    ApiResponse({
      status: 404,
      description: 'Organization not found for the user',
    })(target, propertyName, descriptor);

    ApiResponse({
      status: 500,
      description: 'Internal server error',
    })(target, propertyName, descriptor);
  };
}
