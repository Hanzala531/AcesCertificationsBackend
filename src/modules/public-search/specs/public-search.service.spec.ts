import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PublicSearchService } from '../public-search.service';
import { PublicSearchRepository } from '../public-search.repository';
import {
  OrganizationProfile,
  OrganizationMetrics,
  BranchWithCertificates,
  CertificateDetail,
} from '../types/public-search.types';

describe('PublicSearchService', () => {
  let service: PublicSearchService;
  let repository: jest.Mocked<PublicSearchRepository>;

  const mockOrgId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCertNumber = 'ACES-2024-TC-001';

  const mockOrgProfile: OrganizationProfile = {
    id: mockOrgId,
    name: 'TechCorp Industries',
    description: 'A leading technology company',
    logo: 'https://example.com/logo.png',
    company_size: '2,500',
    organization_type: 'corporation',
    website: 'https://techcorp.example.com',
    email: 'info@techcorp.com',
    contact_no: '+1234567890',
    legal_city: 'San Francisco',
    legal_state: 'California',
    legal_country: 'United States',
    industries: [
      { id: 'ind-1', name: 'Technology' },
      { id: 'ind-2', name: 'Hospitality' },
    ],
    total_certificates: 4,
    branches: [],
    created_at: new Date('2024-01-15'),
  };

  const mockMetrics: OrganizationMetrics = {
    total_branches: 4,
    certified_branches: 1,
    assured_certificates: 1,
    self_disclosures: 34,
  };

  const mockBranches: BranchWithCertificates[] = [
    {
      id: 'branch-1',
      name: 'GreenStay Dubai Marina',
      city: 'Dubai',
      country: 'United Arab Emirates',
      status: 'active',
      is_main: true,
      certifications_count: 3,
      assured_certificates_count: 1,
      self_disclosure_certificates_count: 1,
      certificates: [
        {
          id: 'cert-1',
          certificate_name: 'Workplace - Human Rights',
          certificate_number: 'ACES-2024-TC-001',
          issued_at: new Date('2024-02-01'),
          expiry_date: new Date('2026-02-01'),
          audited: true,
          reviewed: true,
          type: 'assured',
          status: 'active',
        },
        {
          id: 'cert-2',
          certificate_name: 'Workplace - Human Rights',
          certificate_number: 'ACES-2024-TC-002',
          issued_at: new Date('2024-03-15'),
          expiry_date: new Date('2025-03-15'),
          audited: false,
          reviewed: false,
          type: 'self_disclosure',
          status: 'active',
        },
      ],
    },
    {
      id: 'branch-2',
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
  ];

  const mockCertDetail: CertificateDetail = {
    id: 'cert-1',
    certificate_number: mockCertNumber,
    certificate_name: 'Workplace - Human Rights',
    certificate_id: 'CERT-WH-001',
    organization_id: mockOrgId,
    organization_name: 'TechCorp Industries',
    organization_logo: 'https://example.com/logo.png',
    branch_id: 'branch-1',
    branch_name: 'GreenStay Dubai Marina',
    scope: 'Work Human Rights',
    badge_name: 'Gold',
    badge_color: '#FFD700',
    review_score: 85,
    issued_at: new Date('2024-02-01'),
    expiry_date: new Date('2026-02-01'),
    audit_start: new Date('2024-01-15'),
    audit_end: new Date('2024-01-30'),
    is_blocked: false,
    status: 'active',
    auditor_signature: null,
    reviewer_signature: null,
    assurance_details: [],
  };

  beforeEach(async () => {
    const mockRepository = {
      listOrganizations: jest.fn(),
      searchOrganizations: jest.fn(),
      searchCertificates: jest.fn(),
      getOrganizationProfile: jest.fn(),
      getOrganizationProfileBranches: jest.fn(),
      getOrganizationMetrics: jest.fn(),
      getOrganizationBranches: jest.fn(),
      getCertificateByNumber: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicSearchService,
        { provide: PublicSearchRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<PublicSearchService>(PublicSearchService);
    repository = module.get(PublicSearchRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────
  // getOrganizationProfile
  // ──────────────────────────────────────────────────────────
  describe('getOrganizationProfile', () => {
    it('should return full organization profile', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationProfileBranches.mockResolvedValue(mockBranches);

      const result = await service.getOrganizationProfile(mockOrgId);

      expect(result).toEqual({
        ...mockOrgProfile,
        branches: mockBranches,
      });
      expect(repository.getOrganizationProfile).toHaveBeenCalledWith(mockOrgId);
      expect(repository.getOrganizationProfileBranches).toHaveBeenCalledWith(
        mockOrgId,
      );
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      repository.getOrganizationProfile.mockResolvedValue(null);

      await expect(
        service.getOrganizationProfile('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include industries array', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationProfileBranches.mockResolvedValue(mockBranches);

      const result = await service.getOrganizationProfile(mockOrgId);

      expect(result.industries).toHaveLength(2);
      expect(result.industries[0]).toHaveProperty('id');
      expect(result.industries[0]).toHaveProperty('name');
    });

    it('should include verification-related fields', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationProfileBranches.mockResolvedValue(mockBranches);

      const result = await service.getOrganizationProfile(mockOrgId);

      expect(result).toHaveProperty('total_certificates');
      expect(result).toHaveProperty('company_size');
      expect(result).toHaveProperty('website');
      expect(result).toHaveProperty('branches');
    });

    it('should handle organization with null optional fields', async () => {
      const minimalProfile: OrganizationProfile = {
        ...mockOrgProfile,
        description: null,
        logo: null,
        company_size: null,
        website: null,
        email: null,
        contact_no: null,
        legal_city: null,
        industries: [],
        total_certificates: 0,
      };
      repository.getOrganizationProfile.mockResolvedValue(minimalProfile);
      repository.getOrganizationProfileBranches.mockResolvedValue([]);

      const result = await service.getOrganizationProfile(mockOrgId);

      expect(result.description).toBeNull();
      expect(result.logo).toBeNull();
      expect(result.industries).toEqual([]);
      expect(result.total_certificates).toBe(0);
      expect(result.branches).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────
  // getOrganizationMetrics
  // ──────────────────────────────────────────────────────────
  describe('getOrganizationMetrics', () => {
    it('should return organization metrics', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationMetrics.mockResolvedValue(mockMetrics);

      const result = await service.getOrganizationMetrics(mockOrgId);

      expect(result).toEqual(mockMetrics);
      expect(result.total_branches).toBe(4);
      expect(result.certified_branches).toBe(1);
      expect(result.assured_certificates).toBe(1);
      expect(result.self_disclosures).toBe(34);
    });

    it('should throw NotFoundException for non-existent organization', async () => {
      repository.getOrganizationProfile.mockResolvedValue(null);

      await expect(
        service.getOrganizationMetrics('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return zero metrics for new organization', async () => {
      const zeroMetrics: OrganizationMetrics = {
        total_branches: 0,
        certified_branches: 0,
        assured_certificates: 0,
        self_disclosures: 0,
      };
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationMetrics.mockResolvedValue(zeroMetrics);

      const result = await service.getOrganizationMetrics(mockOrgId);

      expect(result.total_branches).toBe(0);
      expect(result.self_disclosures).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // getOrganizationBranches
  // ──────────────────────────────────────────────────────────
  describe('getOrganizationBranches', () => {
    it('should return branches with certificates and pagination', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: mockBranches,
        total: 2,
      });

      const result = await service.getOrganizationBranches(mockOrgId, 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(10);
    });

    it('should throw NotFoundException for non-existent organization', async () => {
      repository.getOrganizationProfile.mockResolvedValue(null);

      await expect(
        service.getOrganizationBranches('nonexistent-id', 1, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include certificates nested inside each branch', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: mockBranches,
        total: 2,
      });

      const result = await service.getOrganizationBranches(mockOrgId, 1, 10);

      const branchWithCerts = result.data[0];
      expect(branchWithCerts.certificates).toHaveLength(2);
      expect(branchWithCerts.certifications_count).toBe(3);
      expect(branchWithCerts.certificates[0]).toHaveProperty('certificate_name');
      expect(branchWithCerts.certificates[0]).toHaveProperty('status');
    });

    it('should handle branch with zero certificates', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: [mockBranches[1]],
        total: 1,
      });

      const result = await service.getOrganizationBranches(mockOrgId, 1, 10);

      expect(result.data[0].certificates).toEqual([]);
      expect(result.data[0].certifications_count).toBe(0);
    });

    it('should cap limit at 100', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: [],
        total: 0,
      });

      await service.getOrganizationBranches(mockOrgId, 1, 500);

      expect(repository.getOrganizationBranches).toHaveBeenCalledWith(
        mockOrgId,
        100,
        0,
        undefined,
        undefined,
      );
    });

    it('should enforce minimum page of 1', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: [],
        total: 0,
      });

      await service.getOrganizationBranches(mockOrgId, -5, 10);

      expect(repository.getOrganizationBranches).toHaveBeenCalledWith(
        mockOrgId,
        10,
        0,
        undefined,
        undefined,
      );
    });

    it('should calculate correct pagination metadata', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockOrgProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: mockBranches,
        total: 25,
      });

      const result = await service.getOrganizationBranches(mockOrgId, 2, 10);

      expect(result.pagination).toEqual({
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // getCertificateByNumber
  // ──────────────────────────────────────────────────────────
  describe('getCertificateByNumber', () => {
    it('should return full certificate detail', async () => {
      repository.getCertificateByNumber.mockResolvedValue(mockCertDetail);

      const result = await service.getCertificateByNumber(mockCertNumber);

      expect(result).toEqual(mockCertDetail);
      expect(result.certificate_number).toBe(mockCertNumber);
      expect(result.organization_name).toBe('TechCorp Industries');
    });

    it('should throw NotFoundException for non-existent certificate', async () => {
      repository.getCertificateByNumber.mockResolvedValue(null);

      await expect(
        service.getCertificateByNumber('INVALID-CERT-NUMBER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include audit period dates', async () => {
      repository.getCertificateByNumber.mockResolvedValue(mockCertDetail);

      const result = await service.getCertificateByNumber(mockCertNumber);

      expect(result).toHaveProperty('audit_start');
      expect(result).toHaveProperty('audit_end');
    });

    it('should include badge information', async () => {
      repository.getCertificateByNumber.mockResolvedValue(mockCertDetail);

      const result = await service.getCertificateByNumber(mockCertNumber);

      expect(result.badge_name).toBe('Gold');
      expect(result.badge_color).toBe('#FFD700');
    });

    it('should derive correct status for active certificate', async () => {
      repository.getCertificateByNumber.mockResolvedValue(mockCertDetail);

      const result = await service.getCertificateByNumber(mockCertNumber);

      expect(result.status).toBe('active');
      expect(result.is_blocked).toBe(false);
    });

    it('should return blocked certificate with blocked status', async () => {
      const blockedCert: CertificateDetail = {
        ...mockCertDetail,
        is_blocked: true,
        status: 'blocked',
      };
      repository.getCertificateByNumber.mockResolvedValue(blockedCert);

      const result = await service.getCertificateByNumber(mockCertNumber);

      expect(result.is_blocked).toBe(true);
      expect(result.status).toBe('blocked');
    });

    it('should return expired status when expiry_date is past', async () => {
      const expiredCert: CertificateDetail = {
        ...mockCertDetail,
        expiry_date: new Date('2020-01-01'),
        status: 'expired',
      };
      repository.getCertificateByNumber.mockResolvedValue(expiredCert);

      const result = await service.getCertificateByNumber(mockCertNumber);

      expect(result.status).toBe('expired');
    });

    it('should include organization and branch details', async () => {
      repository.getCertificateByNumber.mockResolvedValue(mockCertDetail);

      const result = await service.getCertificateByNumber(mockCertNumber);

      expect(result.organization_name).toBe('TechCorp Industries');
      expect(result.organization_logo).toBeTruthy();
      expect(result.branch_name).toBe('GreenStay Dubai Marina');
    });

    it('should include QR-code-relevant data (certificate_number)', async () => {
      repository.getCertificateByNumber.mockResolvedValue(mockCertDetail);

      const result = await service.getCertificateByNumber(mockCertNumber);

      expect(result.certificate_number).toBe(mockCertNumber);
      expect(result.certificate_number).toMatch(/^ACES-/);
    });
  });
});
