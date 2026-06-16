import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  GetOrganizationBadgesApiResponse,
  GetBadgeByIdApiResponse,
  BadgeNotFoundErrorDto,
} from '../dto/badge-response.dto';

export function SwaggerGetOrganizationBadges() {
  return applyDecorators(
    ApiExtraModels(GetOrganizationBadgesApiResponse),
    ApiOperation({
      summary: 'Get organization badges',
      description: `
Retrieves all badges allocated to an organization or branch.

**Query Parameters:**
- \`branchId\`: Optional branch ID to filter badges for a specific branch

**Required Role**: Any authenticated user
      `,
    }),
    ApiParam({
      name: 'organizationId',
      description: 'Organization UUID',
      type: 'string',
      format: 'uuid',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'branchId',
      required: false,
      type: String,
      description: 'Optional branch ID (UUID) to filter badges',
      example: '123e4567-e89b-12d3-a456-426614174001',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Badges retrieved successfully',
      type: GetOrganizationBadgesApiResponse,
    }),
  );
}

export function SwaggerGetBadgeById() {
  return applyDecorators(
    ApiExtraModels(GetBadgeByIdApiResponse, BadgeNotFoundErrorDto),
    ApiOperation({
      summary: 'Get badge by ID',
      description: `
Retrieves detailed information about a specific badge including organization, branch, and certificate details.

**Required Role**: Any authenticated user
      `,
    }),
    ApiParam({
      name: 'id',
      description: 'Badge UUID',
      type: 'string',
      format: 'uuid',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Badge retrieved successfully',
      type: GetBadgeByIdApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Badge not found',
      type: BadgeNotFoundErrorDto,
    }),
  );
}
