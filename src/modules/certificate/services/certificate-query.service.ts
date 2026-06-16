import { Injectable } from '@nestjs/common';
import { CertificateRepository } from '../certificate.repository';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';

@Injectable()
export class CertificateQueryService {
  constructor(
    private readonly certificateRepo: CertificateRepository,
    private readonly organizationRepo: OrganizationRepository,
    private readonly employeeRepo: EmployeeRepository,
  ) {}

  async searchCertificates(
    query: string,
    limit: number = 10,
    industryIds?: string[],
  ) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    return this.certificateRepo.searchCertificates({
      query: query.trim(),
      limit: Math.min(limit, 50),
      industryIds,
    });
  }

  async getRecommendedCertificates(
    organizationIndustryIds: string[],
    page: number,
    limit: number,
  ): Promise<{
    data: Array<{
      id: string;
      certificate_id: string;
      name: string;
      industry_ids: string[];
      industry_names: string[];
      disclosure_price: number;
      assured_price: number | null;
      validity_days: number;
      validity_months: number;
      validity_years: number;
      description: string | null;
      is_published: boolean;
      created_at: string;
      matching_industries_count: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    if (!organizationIndustryIds || organizationIndustryIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    return this.certificateRepo.findRecommendedCertificates({
      industryIds: organizationIndustryIds,
      page,
      limit,
    });
  }

  async getRecommendedCertificatesForUser(
    userId: string,
    userRole: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Array<{
      id: string;
      certificate_id: string;
      name: string;
      industry_ids: string[];
      industry_names: string[];
      disclosure_price: number;
      assured_price: number | null;
      validity_days: number;
      validity_months: number;
      validity_years: number;
      description: string | null;
      is_published: boolean;
      created_at: string;
      matching_industries_count: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    let organizationIndustryIds: string[] = [];

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (org && org.industry_ids) {
        organizationIndustryIds = org.industry_ids;
      }
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (employee && employee.organization_id) {
        const org = await this.organizationRepo.findById(
          employee.organization_id,
        );
        if (org && org.industry_ids) {
          organizationIndustryIds = org.industry_ids;
        }
      }
    }

    return this.getRecommendedCertificates(
      organizationIndustryIds,
      page,
      limit,
    );
  }
}
