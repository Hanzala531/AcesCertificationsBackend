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
 * Regression tests: ensure future changes do not break existing behavior.
 * These tests lock down critical business rules.
 */
describe('CertificationOverview Regression', () => {
  let service: CertificationOverviewService;
  let repo: jest.Mocked<CertificationOverviewRepository>;

  const orgId = 'org-regression';

  const makeAssessment = (
    overrides: Partial<OverviewAssessmentRow> = {},
  ): OverviewAssessmentRow => ({
    id: 'a-' + Math.random().toString(36).slice(2, 8),
    organization_id: orgId,
    organization_name: 'Regression Org',
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
    overrides: Partial<OverviewIssuedCertRow> = {},
  ): OverviewIssuedCertRow => ({
    id: 'ic-' + Math.random().toString(36).slice(2, 8),
    assessment_id: 'a1',
    certificate_id: 'c1',
    certificate_name: 'Test Cert',
    organization_id: orgId,
    organization_name: 'Regression Org',
    branch_id: null,
    branch_name: null,
    badge_name: null,
    badge_color: null,
    certificate_number: 'CERT-R-' + Math.random().toString(36).slice(2, 6),
    review_score: null,
    issued_at: new Date(),
    expiry_date: null,
    is_blocked: false,
    ...overrides,
  });

  const paginate = <T>(data: T[]): PaginatedResult<T> => ({
    data,
    pagination: {
      page: 1,
      limit: 10,
      total: data.length,
      total_pages: Math.ceil(data.length / 10) || 0,
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

  describe('Assessment classification must never regress', () => {
    it('RULE: self_disclosure completed must appear in in_progress if no certificate issued', async () => {
      const sd = makeAssessment({
        assessment_type: 'self_disclosure',
        status: 'completed',
      });

      repo.getInProgressAssessments.mockResolvedValue(paginate([sd]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());
      expect(result.in_progress.data).toHaveLength(1);
      expect(result.active.data).toHaveLength(0);
    });

    it('RULE: failed assessments must never appear in in_progress', async () => {
      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(
        paginate([makeAssessment({ status: 'failed' })]),
      );
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());
      expect(result.in_progress.data).toHaveLength(0);
      expect(result.failed.data).toHaveLength(1);
    });

    it('RULE: expired certificates must never appear in active', async () => {
      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(
        paginate([makeIssuedCert({ expiry_date: new Date('2024-01-01') })]),
      );

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());
      expect(result.active.data).toHaveLength(0);
      expect(result.expired.data).toHaveLength(1);
    });
  });

  describe('Pagination behavior must never regress', () => {
    it('RULE: each section must support independent pagination', async () => {
      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const query = new CertificationOverviewQueryDto();
      query.in_progress_page = 5;
      query.active_page = 3;
      query.failed_page = 2;
      query.expired_page = 7;

      await service.getOverview(orgId, query);

      expect(repo.getInProgressAssessments).toHaveBeenCalledWith(orgId, 5, 10);
      expect(repo.getActiveCertificates).toHaveBeenCalledWith(orgId, 3, 10);
      expect(repo.getFailedAssessments).toHaveBeenCalledWith(orgId, 2, 10);
      expect(repo.getExpiredCertificates).toHaveBeenCalledWith(orgId, 7, 10);
    });

    it('RULE: pagination must return correct total_pages', async () => {
      const result25: PaginatedResult<OverviewAssessmentRow> = {
        data: [],
        pagination: { page: 1, limit: 10, total: 25, total_pages: 3 },
      };

      repo.getInProgressAssessments.mockResolvedValue(result25);
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());
      expect(result.in_progress.pagination.total_pages).toBe(3);
    });

    it('RULE: empty results must return total=0 and total_pages=0', async () => {
      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      for (const section of ['in_progress', 'active', 'failed', 'expired'] as const) {
        expect(result[section].pagination.total).toBe(0);
        expect(result[section].pagination.total_pages).toBe(0);
      }
    });
  });

  describe('Response structure must never regress', () => {
    it('RULE: response must always contain exactly four sections', async () => {
      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      const keys = Object.keys(result);
      expect(keys).toHaveLength(4);
      expect(keys).toContain('in_progress');
      expect(keys).toContain('active');
      expect(keys).toContain('failed');
      expect(keys).toContain('expired');
    });

    it('RULE: each section must have data array and pagination object', async () => {
      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      for (const section of ['in_progress', 'active', 'failed', 'expired'] as const) {
        expect(Array.isArray(result[section].data)).toBe(true);
        expect(result[section].pagination).toHaveProperty('page');
        expect(result[section].pagination).toHaveProperty('limit');
        expect(result[section].pagination).toHaveProperty('total');
        expect(result[section].pagination).toHaveProperty('total_pages');
      }
    });
  });
});
