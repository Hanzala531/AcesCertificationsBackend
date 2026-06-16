import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PublicSearchRepository,
  OrganizationSearchResult,
  OrganizationListItem,
  CertificateSearchResult,
} from './public-search.repository';
import { SearchQueryDto, SearchType } from './dto/search-query.dto';
import type {
  OrganizationProfile,
  OrganizationDetails,
  OrganizationMetrics,
  BranchWithCertificates,
  CertificateDetail,
  PublicCertificateDetail,
} from './types/public-search.types';

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchResponse {
  organizations?: {
    data: OrganizationSearchResult[];
    pagination: PaginationMeta;
  };
  certificates?: {
    data: CertificateSearchResult[];
    pagination: PaginationMeta;
  };
}

@Injectable()
export class PublicSearchService {
  constructor(private searchRepository: PublicSearchRepository) {}

  async listOrganizations(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: OrganizationListItem[];
    pagination: PaginationMeta;
  }> {
    const validLimit = Math.min(Math.max(limit, 1), 100);
    const validPage = Math.max(page, 1);
    const offset = (validPage - 1) * validLimit;

    const { data, total } = await this.searchRepository.listOrganizations(
      validLimit,
      offset,
    );

    return {
      data,
      pagination: {
        total,
        page: validPage,
        pageSize: validLimit,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  async search(dto: SearchQueryDto): Promise<SearchResponse> {
    const type = dto.type ?? SearchType.ALL;
    const limit = Math.min(parseInt(dto.limit || '10', 10) || 10, 100);
    const page = Math.max(parseInt(dto.page || '1', 10) || 1, 1);
    const offset = (page - 1) * limit;

    const filters = {
      q: dto.q?.trim() || undefined,
      country: dto.country?.trim() || undefined,
      industry_id: dto.industry_id,
      organization_id: dto.organization_id,
      certificate_id: dto.certificate_id,
    };

    const result: SearchResponse = {};

    if (type === SearchType.ALL || type === SearchType.ORGANIZATION) {
      const orgs = await this.searchRepository.searchOrganizations(
        filters,
        limit,
        offset,
      );
      result.organizations = {
        data: orgs.data,
        pagination: {
          total: orgs.total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(orgs.total / limit),
        },
      };
    }

    if (type === SearchType.ALL || type === SearchType.CERTIFICATE) {
      const certs = await this.searchRepository.searchCertificates(
        filters,
        limit,
        offset,
      );
      result.certificates = {
        data: certs.data,
        pagination: {
          total: certs.total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(certs.total / limit),
        },
      };
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────
  // Organization Profile
  // ──────────────────────────────────────────────────────────
  async getOrganizationProfile(
    organizationId: string,
  ): Promise<OrganizationProfile> {
    const profile =
      await this.searchRepository.getOrganizationProfile(organizationId);
    if (!profile) {
      throw new NotFoundException('Organization not found');
    }

    const branches =
      await this.searchRepository.getOrganizationProfileBranches(
        organizationId,
      );

    return {
      ...profile,
      branches,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Organization Details (public page)
  // ──────────────────────────────────────────────────────────
  async getOrganizationDetails(
    organizationId: string,
  ): Promise<OrganizationDetails> {
    const details =
      await this.searchRepository.getOrganizationDetails(organizationId);
    if (!details) {
      throw new NotFoundException('Organization not found');
    }
    return details;
  }

  // ──────────────────────────────────────────────────────────
  // Organization Metrics
  // ──────────────────────────────────────────────────────────
  async getOrganizationMetrics(
    organizationId: string,
  ): Promise<OrganizationMetrics> {
    const profile =
      await this.searchRepository.getOrganizationProfile(organizationId);
    if (!profile) {
      throw new NotFoundException('Organization not found');
    }
    return this.searchRepository.getOrganizationMetrics(organizationId);
  }

  // ──────────────────────────────────────────────────────────
  // Organization Branches
  // ──────────────────────────────────────────────────────────
  async getOrganizationBranches(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    typeFilter?: string,
    statusFilter?: string,
  ): Promise<{
    data: BranchWithCertificates[];
    pagination: PaginationMeta;
  }> {
    const profile =
      await this.searchRepository.getOrganizationProfile(organizationId);
    if (!profile) {
      throw new NotFoundException('Organization not found');
    }

    const validLimit = Math.min(Math.max(limit, 1), 100);
    const validPage = Math.max(page, 1);
    const offset = (validPage - 1) * validLimit;

    const { data, total } =
      await this.searchRepository.getOrganizationBranches(
        organizationId,
        validLimit,
        offset,
        typeFilter,
        statusFilter,
      );

    return {
      data,
      pagination: {
        total,
        page: validPage,
        pageSize: validLimit,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  // ──────────────────────────────────────────────────────────
  // Certificate Detail by Org + Branch + Certificate ID
  // ──────────────────────────────────────────────────────────
  async getCertificateByIds(
    issuedCertificateId: string,
  ): Promise<PublicCertificateDetail> {
    const cert = await this.searchRepository.getCertificateByIds(issuedCertificateId);
    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }
    return cert;
  }

  // ──────────────────────────────────────────────────────────
  // Certificate by Number
  // ──────────────────────────────────────────────────────────
  async getCertificateByNumber(
    certificateNumber: string,
  ): Promise<CertificateDetail> {
    const cert =
      await this.searchRepository.getCertificateByNumber(certificateNumber);
    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }
    return cert;
  }
}
