import { Test, TestingModule } from '@nestjs/testing';
import { PublicSearchRepository } from '../public-search.repository';
import { DatabaseService } from '../../../database/database.service';

describe('PublicSearchRepository', () => {
  let repository: PublicSearchRepository;
  let db: { query: jest.MockedFunction<(...args: any[]) => Promise<any>> };

  const mockOrgId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCertNumber = 'ACES-2024-TC-001';

  beforeEach(async () => {
    const mockDb = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicSearchRepository,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    repository = module.get<PublicSearchRepository>(PublicSearchRepository);
    db = module.get(DatabaseService);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────
  // getOrganizationDetails
  // ──────────────────────────────────────────────────────────
  describe('getOrganizationDetails', () => {
    it('should return null when organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await repository.getOrganizationDetails('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return all required fields with correct types', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            organization_name: 'GreenStay Dubai Marina',
            legal_registered_name: 'GreenStay Holdings LLC',
            website: null,
            about_organization: 'Sustainable hospitality group.',
            is_verified: true,
            total_employees: 125,
            legal_city: 'Dubai',
            legal_state: null,
            legal_country: 'UAE',
            industry_type: 'Hospitality',
          },
        ],
      });

      const result = await repository.getOrganizationDetails(mockOrgId);

      expect(result).not.toBeNull();
      expect(result!.organization_name).toBe('GreenStay Dubai Marina');
      expect(result!.legal_registered_name).toBe('GreenStay Holdings LLC');
      expect(result!.industry_type).toBe('Hospitality');
      expect(result!.headquarters_location).toBe('Dubai, UAE');
      expect(result!.total_employees).toBe(125);
      expect(result!.website).toBeNull();
      expect(result!.about_organization).toBe('Sustainable hospitality group.');
      expect(result!.is_verified).toBe(true);
    });

    it('should build headquarters_location from city and country', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            organization_name: 'Org',
            legal_registered_name: null,
            website: null,
            about_organization: null,
            is_verified: false,
            total_employees: '0',
            legal_city: 'Abu Dhabi',
            legal_state: null,
            legal_country: 'UAE',
            industry_type: null,
          },
        ],
      });

      const result = await repository.getOrganizationDetails(mockOrgId);

      expect(result!.headquarters_location).toBe('Abu Dhabi, UAE');
    });

    it('should return null headquarters_location when both city and country are null', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            organization_name: 'Org',
            legal_registered_name: null,
            website: null,
            about_organization: null,
            is_verified: false,
            total_employees: '0',
            legal_city: null,
            legal_state: null,
            legal_country: null,
            industry_type: null,
          },
        ],
      });

      const result = await repository.getOrganizationDetails(mockOrgId);

      expect(result!.headquarters_location).toBeNull();
    });

    it('should count all employees across org and all branches', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            organization_name: 'Org',
            legal_registered_name: null,
            website: null,
            about_organization: null,
            is_verified: false,
            total_employees: 42,
            legal_city: null,
            legal_state: null,
            legal_country: null,
            industry_type: null,
          },
        ],
      });

      const result = await repository.getOrganizationDetails(mockOrgId);

      expect(result!.total_employees).toBe(42);
    });

    it('should return 0 total_employees when org has no employees', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            organization_name: 'Org',
            legal_registered_name: null,
            website: null,
            about_organization: null,
            is_verified: false,
            total_employees: 0,
            legal_city: null,
            legal_state: null,
            legal_country: null,
            industry_type: null,
          },
        ],
      });

      const result = await repository.getOrganizationDetails(mockOrgId);

      expect(result!.total_employees).toBe(0);
    });

    it('should cast is_verified to boolean', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            organization_name: 'Org',
            legal_registered_name: null,
            website: null,
            about_organization: null,
            is_verified: false,
            total_employees: '0',
            legal_city: null,
            legal_state: null,
            legal_country: null,
            industry_type: null,
          },
        ],
      });

      const result = await repository.getOrganizationDetails(mockOrgId);

      expect(typeof result!.is_verified).toBe('boolean');
      expect(result!.is_verified).toBe(false);
    });

    it('should query organization, employee, and organization_industries tables', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await repository.getOrganizationDetails(mockOrgId);

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('organization');
      expect(query).toContain('employee');
      expect(query).toContain('organization_industries');
    });
  });

  // ──────────────────────────────────────────────────────────
  // getOrganizationProfile
  // ──────────────────────────────────────────────────────────
  describe('getOrganizationProfile', () => {
    it('should query organization with industries and certificate count', async () => {
      const mockRow = {
        id: mockOrgId,
        name: 'TechCorp Industries',
        description: 'A leading tech company',
        logo: null,
        company_size: '2,500',
        organization_type: 'corporation',
        website: 'https://techcorp.example.com',
        email: 'info@techcorp.com',
        contact_no: '+1234567890',
        legal_city: 'San Francisco',
        legal_state: 'CA',
        legal_country: 'United States',
        industries: [{ id: 'ind-1', name: 'Technology' }],
        total_certificates: '3',
        created_at: new Date(),
      };
      db.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.getOrganizationProfile(mockOrgId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(mockOrgId);
      expect(result!.total_certificates).toBe(3);
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization'),
        [mockOrgId],
      );
    });

    it('should return null when organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await repository.getOrganizationProfile('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should join with organization_industries and industry tables', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await repository.getOrganizationProfile(mockOrgId);

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('organization_industries');
      expect(query).toContain('industry');
    });

    it('should join with issued_certificates for total count', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await repository.getOrganizationProfile(mockOrgId);

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('issued_certificates');
    });
  });

  // ──────────────────────────────────────────────────────────
  // getOrganizationMetrics
  // ──────────────────────────────────────────────────────────
  describe('getOrganizationProfileBranches', () => {
    it('should return branch summaries with nested certificates', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'branch-1',
            name: 'Dubai Marina',
            city: 'Dubai',
            country: 'UAE',
            is_main: true,
            certifications_count: '1',
          },
        ],
      });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-1',
            branch_id: 'branch-1',
            certificate_name: 'Workplace - Human Rights',
            certificate_number: 'ACES-2024-TC-001',
            issued_at: new Date(),
            expiry_date: new Date('2026-01-01'),
            assessment_type: 'assured',
            audited: true,
            reviewed: true,
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getOrganizationProfileBranches(mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0].certifications_count).toBe(1);
      expect(result[0].certificates).toHaveLength(1);
      expect(result[0].certificates[0].type).toBe('assured');
    });

    it('should return empty array when organization has no branches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getOrganizationProfileBranches(mockOrgId);

      expect(result).toEqual([]);
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOrganizationMetrics', () => {
    it('should return aggregated metrics', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            total_branches: '4',
            certified_branches: '1',
            assured_certificates: '1',
            self_disclosures: '34',
          },
        ],
      });

      const result = await repository.getOrganizationMetrics(mockOrgId);

      expect(result.total_branches).toBe(4);
      expect(result.certified_branches).toBe(1);
      expect(result.assured_certificates).toBe(1);
      expect(result.self_disclosures).toBe(34);
    });

    it('should return zero metrics when no data exists', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            total_branches: '0',
            certified_branches: '0',
            assured_certificates: '0',
            self_disclosures: '0',
          },
        ],
      });

      const result = await repository.getOrganizationMetrics(mockOrgId);

      expect(result.total_branches).toBe(0);
      expect(result.self_disclosures).toBe(0);
    });

    it('should query branches, certificates, and assessments tables', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            total_branches: '0',
            certified_branches: '0',
            assured_certificates: '0',
            self_disclosures: '0',
          },
        ],
      });

      await repository.getOrganizationMetrics(mockOrgId);

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('branches');
      expect(query).toContain('issued_certificates');
      expect(query).toContain('certificate_assessments');
    });
  });

  // ──────────────────────────────────────────────────────────
  // getOrganizationBranches
  // ──────────────────────────────────────────────────────────
  describe('getOrganizationBranches', () => {
    it('should return branches with pagination', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total: '2' }],
      });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'branch-1',
            name: 'Dubai Marina',
            city: 'Dubai',
            country: 'UAE',
            is_main: false,
            certifications_count: '3',
          },
          {
            id: 'branch-2',
            name: 'Abu Dhabi',
            city: 'Abu Dhabi',
            country: 'UAE',
            is_main: false,
            certifications_count: '0',
          },
        ],
      });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-1',
            branch_id: 'branch-1',
            certificate_name: 'Workplace - Human Rights',
            certificate_number: 'ACES-2024-TC-001',
            issued_at: new Date(),
            expiry_date: new Date('2026-01-01'),
            assessment_type: 'assured',
            audited: true,
            reviewed: false,
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getOrganizationBranches(
        mockOrgId,
        10,
        0,
      );

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].certificates).toHaveLength(1);
      expect(result.data[1].certificates).toEqual([]);
    });

    it('should correctly map assessment_type to type field', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'branch-1',
            name: 'Branch',
            city: null,
            country: null,
            is_main: false,
            certifications_count: '2',
          },
        ],
      });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-assured',
            branch_id: 'branch-1',
            certificate_name: 'Assured Cert',
            certificate_number: 'ACES-001',
            issued_at: new Date(),
            expiry_date: new Date('2027-01-01'),
            assessment_type: 'assured',
            audited: true,
            reviewed: true,
          },
          {
            id: 'cert-self',
            branch_id: 'branch-1',
            certificate_name: 'Self Disclosure Cert',
            certificate_number: 'ACES-002',
            issued_at: new Date('2019-01-01'),
            expiry_date: null,
            assessment_type: 'self_disclosure',
            audited: false,
            reviewed: false,
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getOrganizationBranches(
        mockOrgId,
        10,
        0,
      );

      expect(result.data[0].certificates[0].type).toBe('assured');
      expect(result.data[0].certificates[0].audited).toBe(true);
      expect(result.data[0].certificates[1].type).toBe('self_disclosure');
      expect(result.data[0].certificates[1].audited).toBe(false);
    });

    it('should attach null-branch certificates to the main branch', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'branch-main',
            name: 'Main Branch',
            city: null,
            country: null,
            is_main: true,
            certifications_count: '1',
          },
        ],
      });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-org',
            branch_id: null,
            certificate_name: 'Org Level Cert',
            certificate_number: 'ACES-ORG-001',
            issued_at: new Date(),
            expiry_date: new Date('2026-01-01'),
            assessment_type: 'assured',
            audited: true,
            reviewed: true,
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getOrganizationBranches(mockOrgId, 10, 0);

      expect(result.data[0].certifications_count).toBe(1);
      expect(result.data[0].certificates).toHaveLength(1);
      expect(result.data[0].certificates[0].certificate_number).toBe(
        'ACES-ORG-001',
      );
    });

    it('should handle empty branches', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getOrganizationBranches(
        mockOrgId,
        10,
        0,
      );

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('should pass filter parameters for type and status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'branch-1',
            name: 'Main Branch',
            city: null,
            country: null,
            is_main: true,
            certifications_count: '0',
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await repository.getOrganizationBranches(mockOrgId, 10, 0, 'main');

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain('is_main');
    });
  });

  // ──────────────────────────────────────────────────────────
  // getCertificateByNumber
  // ──────────────────────────────────────────────────────────
  describe('getCertificateByNumber', () => {
    it('should return certificate detail with all related data', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-1',
            certificate_number: mockCertNumber,
            certificate_name: 'Workplace - Human Rights',
            certificate_id: 'CERT-WH-001',
            organization_id: mockOrgId,
            organization_name: 'TechCorp',
            organization_logo: null,
            branch_id: 'branch-1',
            branch_name: 'Dubai Marina',
            scope: 'Work Human Rights',
            badge_name: 'Gold',
            badge_color: '#FFD700',
            review_score: 85,
            issued_at: new Date(),
            expiry_date: new Date('2026-01-01'),
            audit_start: new Date('2024-01-15'),
            audit_end: new Date('2024-01-30'),
            is_blocked: false,
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getCertificateByNumber(mockCertNumber);

      expect(result).toBeDefined();
      expect(result!.certificate_number).toBe(mockCertNumber);
      expect(result!.organization_name).toBe('TechCorp');
      expect(result!.badge_name).toBe('Gold');
    });

    it('should return null when certificate not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result =
        await repository.getCertificateByNumber('INVALID-NUMBER');

      expect(result).toBeNull();
    });

    it('should join with organization, branch, and assessment tables', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await repository.getCertificateByNumber(mockCertNumber);

      const query = db.query.mock.calls[0][0] as string;
      expect(query).toContain('organization');
      expect(query).toContain('branches');
      expect(query).toContain('issued_certificates');
    });

    it('should compute status based on blocked and expiry', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-1',
            certificate_number: mockCertNumber,
            certificate_name: 'Test',
            certificate_id: 'CERT-001',
            organization_id: mockOrgId,
            organization_name: 'Org',
            organization_logo: null,
            branch_id: null,
            branch_name: null,
            scope: 'Test',
            badge_name: null,
            badge_color: null,
            review_score: null,
            issued_at: new Date(),
            expiry_date: new Date('2020-01-01'),
            audit_start: null,
            audit_end: null,
            is_blocked: false,
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getCertificateByNumber(mockCertNumber);

      expect(result!.status).toBe('expired');
    });

    it('should resolve null branch_id to the main branch details', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-1',
            certificate_number: mockCertNumber,
            certificate_name: 'Test',
            certificate_id: 'CERT-001',
            organization_id: mockOrgId,
            organization_name: 'Org',
            organization_logo: null,
            branch_id: 'branch-main',
            branch_name: 'Main Branch',
            scope: 'Test',
            badge_name: null,
            badge_color: null,
            review_score: null,
            issued_at: new Date(),
            expiry_date: new Date('2026-01-01'),
            audit_start: null,
            audit_end: null,
            is_blocked: false,
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getCertificateByNumber(mockCertNumber);

      expect(result!.branch_id).toBe('branch-main');
      expect(result!.branch_name).toBe('Main Branch');
    });

    it('should mark blocked certificate with blocked status', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'cert-1',
            certificate_number: mockCertNumber,
            certificate_name: 'Test',
            certificate_id: 'CERT-001',
            organization_id: mockOrgId,
            organization_name: 'Org',
            organization_logo: null,
            branch_id: null,
            branch_name: null,
            scope: 'Test',
            badge_name: null,
            badge_color: null,
            review_score: null,
            issued_at: new Date(),
            expiry_date: new Date('2026-01-01'),
            audit_start: null,
            audit_end: null,
            is_blocked: true,
          },
        ],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getCertificateByNumber(mockCertNumber);

      expect(result!.status).toBe('blocked');
    });
  });
});
