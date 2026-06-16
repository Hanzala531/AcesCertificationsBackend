import { Test, TestingModule } from '@nestjs/testing';
import { CertificationOverviewService } from '../services/certification-overview.service';
import {
  CertificationOverviewRepository,
  PaginatedResult,
  OverviewAssessmentRow,
  OverviewIssuedCertRow,
} from '../repositories/certification-overview.repository';
import { CertificationOverviewQueryDto } from '../dto/certification-overview-query.dto';

/**
 * System tests: simulate realistic datasets with multiple organizations,
 * branches, certificates, and mixed assessment states.
 */
describe('CertificationOverview System Tests', () => {
  let service: CertificationOverviewService;
  let repo: jest.Mocked<CertificationOverviewRepository>;

  const orgId = 'org-system-001';

  const makeAssessment = (
    overrides: Partial<OverviewAssessmentRow>,
  ): OverviewAssessmentRow => ({
    id: 'a-' + Math.random().toString(36).slice(2, 8),
    organization_id: orgId,
    organization_name: 'System Test Org',
    branch_id: null,
    branch_name: null,
    certificate_id: 'c1',
    certificate_name: 'Test Cert',
    assessment_type: 'self_disclosure',
    status: 'in_progress',
    score: null,
    badge_name: null,
    submitted_at: null,
    completed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    total_questions: null,
    answered_questions: null,
    answered_percent: null,
    ...overrides,
  });

  const makeIssuedCert = (
    overrides: Partial<OverviewIssuedCertRow>,
  ): OverviewIssuedCertRow => ({
    id: 'ic-' + Math.random().toString(36).slice(2, 8),
    assessment_id: 'a1',
    certificate_id: 'c1',
    certificate_name: 'Test Cert',
    organization_id: orgId,
    organization_name: 'System Test Org',
    branch_id: null,
    branch_name: null,
    badge_name: null,
    badge_color: null,
    certificate_number: 'CERT-S-' + Math.random().toString(36).slice(2, 6),
    review_score: null,
    issued_at: new Date(),
    expiry_date: null,
    is_blocked: false,
    ...overrides,
  });

  const paginate = <T>(data: T[], page = 1, limit = 10): PaginatedResult<T> => ({
    data: data.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total: data.length,
      total_pages: Math.ceil(data.length / limit) || 0,
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationOverviewService,
        {
          provide: CertificationOverviewRepository,
          useValue: {
            getInProgressAssessments: jest.fn(),
            getActiveCertificates: jest.fn(),
            getFailedAssessments: jest.fn(),
            getExpiredCertificates: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CertificationOverviewService);
    repo = module.get(CertificationOverviewRepository);
  });

  describe('Realistic dataset simulation', () => {
    it('should handle organization with multiple branches and certificates', async () => {
      const branches = ['branch-1', 'branch-2', 'branch-3'];
      const certs = ['cert-1', 'cert-2'];

      // In-progress: each branch has SD in_progress for cert-1
      const inProgressData = branches.map((branchId) =>
        makeAssessment({
          branch_id: branchId,
          branch_name: `Branch ${branchId}`,
          certificate_id: certs[0],
          assessment_type: 'self_disclosure',
          status: 'in_progress',
        }),
      );

      // Active: branch-1 has cert-2 issued
      const activeData = [
        makeIssuedCert({
          branch_id: 'branch-1',
          branch_name: 'Branch branch-1',
          certificate_id: certs[1],
          certificate_name: 'Cert 2',
        }),
      ];

      // Failed: branch-2 failed cert-2
      const failedData = [
        makeAssessment({
          branch_id: 'branch-2',
          branch_name: 'Branch branch-2',
          certificate_id: certs[1],
          status: 'failed',
        }),
      ];

      // Expired: branch-3 had cert-2 but expired
      const expiredData = [
        makeIssuedCert({
          branch_id: 'branch-3',
          branch_name: 'Branch branch-3',
          certificate_id: certs[1],
          expiry_date: new Date('2025-06-01'),
        }),
      ];

      repo.getInProgressAssessments.mockResolvedValue(paginate(inProgressData));
      repo.getActiveCertificates.mockResolvedValue(paginate(activeData));
      repo.getFailedAssessments.mockResolvedValue(paginate(failedData));
      repo.getExpiredCertificates.mockResolvedValue(paginate(expiredData));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.in_progress.data).toHaveLength(3);
      expect(result.active.data).toHaveLength(1);
      expect(result.failed.data).toHaveLength(1);
      expect(result.expired.data).toHaveLength(1);
    });

    it('should handle mixed assessment states for same org+branch+certificate', async () => {
      // SD completed, assured in_progress — both should be in_progress
      const sdCompleted = makeAssessment({
        branch_id: 'b1',
        certificate_id: 'c1',
        assessment_type: 'self_disclosure',
        status: 'completed',
      });
      const assuredInProgress = makeAssessment({
        branch_id: 'b1',
        certificate_id: 'c1',
        assessment_type: 'assured',
        status: 'in_progress',
      });

      repo.getInProgressAssessments.mockResolvedValue(
        paginate([sdCompleted, assuredInProgress]),
      );
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());
      expect(result.in_progress.data).toHaveLength(2);
    });

    it('should handle large paginated datasets across sections', async () => {
      // Simulate 50 in-progress, 30 active, 20 failed, 10 expired
      const inProgressAll = Array.from({ length: 50 }, (_, i) =>
        makeAssessment({ id: `ip-${i}`, status: 'in_progress' }),
      );
      const activeAll = Array.from({ length: 30 }, (_, i) =>
        makeIssuedCert({ id: `ac-${i}` }),
      );
      const failedAll = Array.from({ length: 20 }, (_, i) =>
        makeAssessment({ id: `fl-${i}`, status: 'failed' }),
      );
      const expiredAll = Array.from({ length: 10 }, (_, i) =>
        makeIssuedCert({ id: `ex-${i}`, expiry_date: new Date('2025-01-01') }),
      );

      const query = new CertificationOverviewQueryDto();
      query.in_progress_page = 2;
      query.in_progress_limit = 10;
      query.active_page = 1;
      query.active_limit = 5;

      repo.getInProgressAssessments.mockResolvedValue(paginate(inProgressAll, 2, 10));
      repo.getActiveCertificates.mockResolvedValue(paginate(activeAll, 1, 5));
      repo.getFailedAssessments.mockResolvedValue(paginate(failedAll, 1, 10));
      repo.getExpiredCertificates.mockResolvedValue(paginate(expiredAll, 1, 10));

      const result = await service.getOverview(orgId, query);

      expect(result.in_progress.pagination.total).toBe(50);
      expect(result.in_progress.pagination.total_pages).toBe(5);
      expect(result.in_progress.data).toHaveLength(10); // page 2

      expect(result.active.pagination.total).toBe(30);
      expect(result.active.pagination.total_pages).toBe(6);
      expect(result.active.data).toHaveLength(5); // first page, limit 5

      expect(result.failed.pagination.total).toBe(20);
      expect(result.expired.pagination.total).toBe(10);
    });

    it('should handle organization with no assessments and no certificates', async () => {
      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.in_progress.data).toHaveLength(0);
      expect(result.active.data).toHaveLength(0);
      expect(result.failed.data).toHaveLength(0);
      expect(result.expired.data).toHaveLength(0);
    });

    it('should handle certificates with null expiry_date as active', async () => {
      const certNoExpiry = makeIssuedCert({ expiry_date: null });

      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([certNoExpiry]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.active.data).toHaveLength(1);
      expect(result.active.data[0].expiry_date).toBeNull();
      expect(result.expired.data).toHaveLength(0);
    });

    it('should handle assessments with both self_disclosure and assured types', async () => {
      const sdSubmitted = makeAssessment({
        assessment_type: 'self_disclosure',
        status: 'submitted',
        certificate_id: 'c1',
      });
      const assuredAiReview = makeAssessment({
        assessment_type: 'assured',
        status: 'ai_reviewing',
        certificate_id: 'c1',
      });
      const sdFailed = makeAssessment({
        assessment_type: 'self_disclosure',
        status: 'failed',
        certificate_id: 'c2',
      });

      repo.getInProgressAssessments.mockResolvedValue(
        paginate([sdSubmitted, assuredAiReview]),
      );
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([sdFailed]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.in_progress.data).toHaveLength(2);
      expect(result.failed.data).toHaveLength(1);
    });

    it('should handle concurrent sections with different page sizes', async () => {
      repo.getInProgressAssessments.mockResolvedValue(
        paginate(
          Array.from({ length: 100 }, (_, i) =>
            makeAssessment({ id: `ip-${i}` }),
          ),
          1,
          5,
        ),
      );
      repo.getActiveCertificates.mockResolvedValue(
        paginate(
          Array.from({ length: 50 }, (_, i) =>
            makeIssuedCert({ id: `ac-${i}` }),
          ),
          1,
          20,
        ),
      );
      repo.getFailedAssessments.mockResolvedValue(paginate([], 1, 1));
      repo.getExpiredCertificates.mockResolvedValue(paginate([], 1, 100));

      const query = new CertificationOverviewQueryDto();
      query.in_progress_limit = 5;
      query.active_limit = 20;
      query.failed_limit = 1;
      query.expired_limit = 100;

      const result = await service.getOverview(orgId, query);

      expect(result.in_progress.data).toHaveLength(5);
      expect(result.in_progress.pagination.total_pages).toBe(20);

      expect(result.active.data).toHaveLength(20);
      expect(result.active.pagination.total_pages).toBe(3);
    });
  });

  describe('Edge case validation', () => {
    it('should handle duplicate organization+branch entries in results', async () => {
      // Same org+branch but different certificates
      const a1 = makeAssessment({
        branch_id: 'b1',
        certificate_id: 'c1',
        certificate_name: 'Cert 1',
      });
      const a2 = makeAssessment({
        branch_id: 'b1',
        certificate_id: 'c2',
        certificate_name: 'Cert 2',
      });

      repo.getInProgressAssessments.mockResolvedValue(paginate([a1, a2]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());
      expect(result.in_progress.data).toHaveLength(2);
    });

    it('should handle assessment with missing branch (null branch_id)', async () => {
      const assessment = makeAssessment({
        branch_id: null,
        branch_name: null,
      });

      repo.getInProgressAssessments.mockResolvedValue(paginate([assessment]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());
      expect(result.in_progress.data[0].branch_id).toBeNull();
      expect(result.in_progress.data[0].branch_name).toBeNull();
    });

    it('should handle pagination overflow gracefully', async () => {
      repo.getInProgressAssessments.mockResolvedValue({
        data: [],
        pagination: { page: 999, limit: 10, total: 5, total_pages: 1 },
      });
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const query = new CertificationOverviewQueryDto();
      query.in_progress_page = 999;

      const result = await service.getOverview(orgId, query);
      expect(result.in_progress.data).toHaveLength(0);
      expect(result.in_progress.pagination.page).toBe(999);
      expect(result.in_progress.pagination.total).toBe(5);
    });
  });
});
