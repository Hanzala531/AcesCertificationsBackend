import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicSearchController } from '../public-search.controller';
import { PublicSearchService } from '../public-search.service';
import { PublicSearchRepository } from '../public-search.repository';
import type {
  OrganizationProfile,
  OrganizationMetrics,
  OrganizationDetails,
  BranchWithCertificates,
  CertificateDetail,
} from '../types/public-search.types';

/**
 * E2E-style tests that validate the full HTTP request → response flow
 * using the NestJS testing module (no real DB — repository is mocked).
 */
describe('PublicSearch E2E', () => {
  let app: INestApplication;
  let repository: jest.Mocked<PublicSearchRepository>;

  const mockOrgId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCertNumber = 'ACES-2024-TC-001';

  const mockProfile: OrganizationProfile = {
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
    industries: [{ id: 'ind-1', name: 'Technology' }],
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

  const mockDetails: OrganizationDetails = {
    organization_name: 'TechCorp Industries',
    legal_registered_name: 'TechCorp Industries LLC',
    industry_type: 'Technology',
    headquarters_location: 'San Francisco, United States',
    total_employees: 2500,
    website: 'https://techcorp.example.com',
    about_organization: 'A leading technology company',
    is_verified: true,
  };

  const mockBranches: BranchWithCertificates[] = [
    {
      id: 'branch-1',
      name: 'GreenStay Dubai Marina',
      city: 'Dubai',
      country: 'UAE',
      status: 'active',
      is_main: true,
      certifications_count: 2,
      assured_certificates_count: 1,
      self_disclosure_certificates_count: 0,
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
      ],
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

  beforeAll(async () => {
    const mockRepo = {
      listOrganizations: jest.fn(),
      searchOrganizations: jest.fn(),
      searchCertificates: jest.fn(),
      getOrganizationProfile: jest.fn(),
      getOrganizationProfileBranches: jest.fn(),
      getOrganizationDetails: jest.fn(),
      getOrganizationMetrics: jest.fn(),
      getOrganizationBranches: jest.fn(),
      getCertificateByNumber: jest.fn(),
      getCertificateByIds: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PublicSearchController],
      providers: [
        PublicSearchService,
        { provide: PublicSearchRepository, useValue: mockRepo },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    repository = moduleFixture.get(PublicSearchRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────
  // Full flow: Fetch org → metrics → branches → certificate
  // ──────────────────────────────────────────────────────────
  describe('Full data flow', () => {
    it('should fetch organization profile', async () => {
      repository.getOrganizationDetails.mockResolvedValue(mockDetails);

      const res = await request(app.getHttpServer())
        .get(`/search/organizations/${mockOrgId}`)
        .expect(200);

      expect(res.body.message).toBe('Organization retrieved successfully');
      expect(res.body.data.organization_name).toBe('TechCorp Industries');
      expect(res.body.data.industry_type).toBe('Technology');
      expect(res.body.data.headquarters_location).toBe(
        'San Francisco, United States',
      );
      expect(res.body.data.total_employees).toBe(2500);
      expect(res.body.data.is_verified).toBe(true);
    });

    it('should fetch organization metrics', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockProfile);
      repository.getOrganizationMetrics.mockResolvedValue(mockMetrics);

      const res = await request(app.getHttpServer())
        .get(`/search/organizations/${mockOrgId}/metrics`)
        .expect(200);

      expect(res.body.message).toBe('Organization metrics retrieved successfully');
      expect(res.body.data.total_branches).toBe(4);
      expect(res.body.data.certified_branches).toBe(1);
    });

    it('should fetch organization branches with certifications', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: mockBranches,
        total: 1,
      });

      const res = await request(app.getHttpServer())
        .get(`/search/organizations/${mockOrgId}/branches`)
        .expect(200);

      expect(res.body.message).toBe('Organization branches retrieved successfully');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].certificates).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('should fetch certificate detail by number', async () => {
      repository.getCertificateByNumber.mockResolvedValue(mockCertDetail);

      const res = await request(app.getHttpServer())
        .get(`/search/certificates/${mockCertNumber}`)
        .expect(200);

      expect(res.body.message).toBe('Certificate retrieved successfully');
      expect(res.body.data.certificate_number).toBe(mockCertNumber);
      expect(res.body.data.organization_name).toBe('TechCorp Industries');
      expect(res.body.data.badge_name).toBe('Gold');
    });
  });

  // ──────────────────────────────────────────────────────────
  // Error scenarios
  // ──────────────────────────────────────────────────────────
  describe('Error handling', () => {
    it('should return 404 for non-existent organization profile', async () => {
      repository.getOrganizationDetails.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/search/organizations/550e8400-e29b-41d4-a716-446655440099`)
        .expect(404);
    });

    it('should return 404 for non-existent organization metrics', async () => {
      repository.getOrganizationProfile.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/search/organizations/550e8400-e29b-41d4-a716-446655440099/metrics`)
        .expect(404);
    });

    it('should return 404 for non-existent certificate number', async () => {
      repository.getCertificateByNumber.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/search/certificates/INVALID-CERT')
        .expect(404);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Branches pagination & filtering
  // ──────────────────────────────────────────────────────────
  describe('Branches query params', () => {
    it('should support pagination via query params', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: [],
        total: 50,
      });

      const res = await request(app.getHttpServer())
        .get(`/search/organizations/${mockOrgId}/branches?page=2&limit=5`)
        .expect(200);

      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.pageSize).toBe(5);
      expect(res.body.pagination.totalPages).toBe(10);
    });

    it('should support type filter', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get(`/search/organizations/${mockOrgId}/branches?type=main`)
        .expect(200);
    });

    it('should support status filter', async () => {
      repository.getOrganizationProfile.mockResolvedValue(mockProfile);
      repository.getOrganizationBranches.mockResolvedValue({
        data: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get(`/search/organizations/${mockOrgId}/branches?status=active`)
        .expect(200);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Existing endpoints still work
  // ──────────────────────────────────────────────────────────
  describe('Existing endpoints (regression)', () => {
    it('GET /search/organizations should still work', async () => {
      repository.listOrganizations.mockResolvedValue({
        data: [{ id: 'org-1', name: 'Org', description: null }],
        total: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/search/organizations')
        .expect(200);

      expect(res.body.message).toBe('Organizations retrieved successfully');
    });

    it('GET /search should still work', async () => {
      repository.searchOrganizations.mockResolvedValue({
        data: [],
        total: 0,
      });
      repository.searchCertificates.mockResolvedValue({
        data: [],
        total: 0,
      });

      const res = await request(app.getHttpServer())
        .get('/search?q=test')
        .expect(200);

      expect(res.body.message).toBe('Search results retrieved successfully');
    });
  });
});
