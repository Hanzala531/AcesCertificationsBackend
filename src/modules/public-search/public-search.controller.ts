import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicSearchService } from './public-search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { BranchesQueryDto } from './dto/organization-profile-query.dto';
import {
  SwaggerGetOrganizationProfile,
  SwaggerGetOrganizationMetrics,
  SwaggerGetOrganizationBranches,
  SwaggerGetCertificateByNumber,
  SwaggerGetCertificateByIds,
  SwaggerListOrganizations,
  SwaggerSearch,
} from './swagger/public-search.swagger';

@ApiTags('🔍 Public Search')
@Controller('search')
export class PublicSearchController {
  constructor(private searchService: PublicSearchService) {}

  // ──────────────────────────────────────────────────────────
  // Existing endpoints
  // ──────────────────────────────────────────────────────────

  @Get('organizations')
  @SwaggerListOrganizations()
  async listOrganizations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.searchService.listOrganizations(
      parseInt(page || '1', 10) || 1,
      parseInt(limit || '10', 10) || 10,
    );

    return {
      message: 'Organizations retrieved successfully',
      ...result,
    };
  }

  @Get('certificate-detail')
  @SwaggerGetCertificateByIds()
  async getCertificateByIds(
    @Query('certificate_id') issuedCertificateId: string,
  ) {
    const data = await this.searchService.getCertificateByIds(issuedCertificateId);

    return {
      message: 'Certificate details retrieved successfully',
      data,
    };
  }

  @Get('certificates/:certificateNumber')
  @SwaggerGetCertificateByNumber()
  async getCertificateByNumber(
    @Param('certificateNumber') certificateNumber: string,
  ) {
    const data = await this.searchService.getCertificateByNumber(
      certificateNumber,
    );

    return {
      message: 'Certificate retrieved successfully',
      data,
    };
  }

  @Get('organizations/:id/metrics')
  @SwaggerGetOrganizationMetrics()
  async getOrganizationMetrics(@Param('id') id: string) {
    const data = await this.searchService.getOrganizationMetrics(id);

    return {
      message: 'Organization metrics retrieved successfully',
      data,
    };
  }

  @Get('organizations/:id/branches')
  @SwaggerGetOrganizationBranches()
  async getOrganizationBranches(
    @Param('id') id: string,
    @Query() query: BranchesQueryDto,
  ) {
    const page = parseInt(query.page || '1', 10) || 1;
    const limit = parseInt(query.limit || '10', 10) || 10;

    const result = await this.searchService.getOrganizationBranches(
      id,
      page,
      limit,
      query.type,
      query.status,
    );

    return {
      message: 'Organization branches retrieved successfully',
      ...result,
    };
  }

  @Get('organizations/:id')
  @SwaggerGetOrganizationProfile()
  async getOrganizationProfile(@Param('id') id: string) {
    const data = await this.searchService.getOrganizationDetails(id);

    return {
      message: 'Organization retrieved successfully',
      data,
    };
  }

  // ──────────────────────────────────────────────────────────
  // General search (must be last — catch-all route)
  // ──────────────────────────────────────────────────────────

  @Get()
  @SwaggerSearch()
  async search(@Query() dto: SearchQueryDto) {
    const result = await this.searchService.search(dto);

    return {
      message: 'Search results retrieved successfully',
      ...result,
    };
  }
}
