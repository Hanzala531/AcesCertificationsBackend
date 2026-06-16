import { Test, TestingModule } from '@nestjs/testing';
import { PublicSearchController } from '../public-search.controller';
import { PublicSearchService } from '../public-search.service';
import { PublicSearchRepository } from '../public-search.repository';
import { SearchType } from '../dto/search-query.dto';

/**
 * Regression tests: ensure existing search endpoints continue to work
 * after adding new organization profile / certificate detail endpoints.
 */
describe('PublicSearch - Regression', () => {
  let controller: PublicSearchController;
  let service: PublicSearchService;
  let repository: jest.Mocked<PublicSearchRepository>;

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
      controllers: [PublicSearchController],
      providers: [
        PublicSearchService,
        { provide: PublicSearchRepository, useValue: mockRepository },
      ],
    }).compile();

    controller = module.get<PublicSearchController>(PublicSearchController);
    service = module.get<PublicSearchService>(PublicSearchService);
    repository = module.get(PublicSearchRepository);
  });

  // ──────────────────────────────────────────────────────────
  // Existing: GET /search/organizations
  // ──────────────────────────────────────────────────────────
  describe('GET /search/organizations (existing)', () => {
    it('should still return paginated organization list', async () => {
      repository.listOrganizations.mockResolvedValue({
        data: [
          { id: 'org-1', name: 'Org One', description: 'desc' },
          { id: 'org-2', name: 'Org Two', description: null },
        ],
        total: 2,
      });

      const result = await controller.listOrganizations('1', '10');

      expect(result.message).toBe('Organizations retrieved successfully');
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should still handle default pagination values', async () => {
      repository.listOrganizations.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.listOrganizations(undefined, undefined);

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(10);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Existing: GET /search
  // ──────────────────────────────────────────────────────────
  describe('GET /search (existing)', () => {
    it('should still return search results for ALL type', async () => {
      repository.searchOrganizations.mockResolvedValue({
        data: [],
        total: 0,
      });
      repository.searchCertificates.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.search({
        type: SearchType.ALL,
        page: '1',
        limit: '10',
      });

      expect(result.message).toBe('Search results retrieved successfully');
      expect(result).toHaveProperty('organizations');
      expect(result).toHaveProperty('certificates');
    });

    it('should still filter by organization type only', async () => {
      repository.searchOrganizations.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.search({
        type: SearchType.ORGANIZATION,
        q: 'TechCorp',
        page: '1',
        limit: '10',
      });

      expect(result).toHaveProperty('organizations');
      expect(result).not.toHaveProperty('certificates');
      expect(repository.searchCertificates).not.toHaveBeenCalled();
    });

    it('should still filter by certificate type only', async () => {
      repository.searchCertificates.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.search({
        type: SearchType.CERTIFICATE,
        q: 'Human Rights',
        page: '1',
        limit: '10',
      });

      expect(result).toHaveProperty('certificates');
      expect(result).not.toHaveProperty('organizations');
      expect(repository.searchOrganizations).not.toHaveBeenCalled();
    });

    it('should still support query text search', async () => {
      repository.searchOrganizations.mockResolvedValue({
        data: [],
        total: 0,
      });
      repository.searchCertificates.mockResolvedValue({
        data: [],
        total: 0,
      });

      await controller.search({ q: 'ISO', page: '1', limit: '10' });

      expect(repository.searchOrganizations).toHaveBeenCalled();
      expect(repository.searchCertificates).toHaveBeenCalled();
    });

    it('should still respect pagination limits', async () => {
      repository.searchOrganizations.mockResolvedValue({
        data: [],
        total: 0,
      });
      repository.searchCertificates.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.search({
        page: '3',
        limit: '25',
      });

      expect(result.organizations!.pagination.page).toBe(3);
      expect(result.organizations!.pagination.pageSize).toBe(25);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Data structure compatibility
  // ──────────────────────────────────────────────────────────
  describe('Response structure compatibility', () => {
    it('organization search result should retain same fields', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'TechCorp',
        description: 'desc',
        logo: 'logo.png',
        legal_city: 'SF',
        legal_state: 'CA',
        legal_country: 'USA',
        contact_no: '+1234',
        email: 'test@test.com',
        website: 'https://test.com',
        industries: [{ id: 'ind-1', name: 'Tech' }],
        total_certificates: 5,
      };
      repository.searchOrganizations.mockResolvedValue({
        data: [mockOrg],
        total: 1,
      });
      repository.searchCertificates.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.search({ page: '1', limit: '10' });
      const org = result.organizations!.data[0];

      // Validate all original fields still present
      expect(org).toHaveProperty('id');
      expect(org).toHaveProperty('name');
      expect(org).toHaveProperty('description');
      expect(org).toHaveProperty('logo');
      expect(org).toHaveProperty('legal_city');
      expect(org).toHaveProperty('legal_state');
      expect(org).toHaveProperty('legal_country');
      expect(org).toHaveProperty('industries');
      expect(org).toHaveProperty('total_certificates');
    });

    it('certificate search result should retain same fields', async () => {
      const mockCert = {
        id: 'cert-1',
        certificate_name: 'Workplace',
        certificate_number: 'ACES-001',
        certificate_id: 'CERT-001',
        organization_id: 'org-1',
        organization_name: 'TechCorp',
        organization_logo: null,
        branch_id: 'br-1',
        branch_name: 'Main',
        badge_name: 'Gold',
        badge_color: '#FFD700',
        review_score: 85,
        issued_at: new Date(),
        expiry_date: new Date('2026-01-01'),
        is_blocked: false,
      };
      repository.searchOrganizations.mockResolvedValue({
        data: [],
        total: 0,
      });
      repository.searchCertificates.mockResolvedValue({
        data: [mockCert],
        total: 1,
      });

      const result = await controller.search({ page: '1', limit: '10' });
      const cert = result.certificates!.data[0];

      // Validate all original fields still present
      expect(cert).toHaveProperty('id');
      expect(cert).toHaveProperty('certificate_name');
      expect(cert).toHaveProperty('certificate_number');
      expect(cert).toHaveProperty('organization_name');
      expect(cert).toHaveProperty('badge_name');
      expect(cert).toHaveProperty('badge_color');
      expect(cert).toHaveProperty('review_score');
      expect(cert).toHaveProperty('issued_at');
      expect(cert).toHaveProperty('expiry_date');
      expect(cert).toHaveProperty('is_blocked');
    });
  });
});
