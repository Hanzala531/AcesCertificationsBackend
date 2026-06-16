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
 * Integration tests: verify correct interaction between service and repository layers,
 * ensuring proper classification of assessments into the four categories.
 */
describe('CertificationOverview Integration', () => {
  let service: CertificationOverviewService;
  let repo: jest.Mocked<CertificationOverviewRepository>;

  const orgId = 'org-001';

  const makeAssessment = (
    overrides: Partial<OverviewAssessmentRow> = {},
  ): OverviewAssessmentRow => ({
    id: 'a-' + Math.random().toString(36).slice(2, 8),
    organization_id: orgId,
    organization_name: 'Test Org',
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
    organization_name: 'Test Org',
    branch_id: null,
    branch_name: null,
    badge_name: 'Gold',
    badge_color: '#FFD700',
    certificate_number: 'CERT-' + Math.random().toString(36).slice(2, 6),
    review_score: 90,
    issued_at: new Date(),
    expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
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

  describe('Classification correctness', () => {
    it('should separate self_disclosure in_progress from active issued certificates', async () => {
      const sdInProgress = makeAssessment({
        assessment_type: 'self_disclosure',
        status: 'in_progress',
      });
      const activeCert = makeIssuedCert();

      repo.getInProgressAssessments.mockResolvedValue(paginate([sdInProgress]));
      repo.getActiveCertificates.mockResolvedValue(paginate([activeCert]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.in_progress.data).toHaveLength(1);
      expect(result.in_progress.data[0].assessment_type).toBe('self_disclosure');
      expect(result.active.data).toHaveLength(1);
      expect(result.active.data[0].certificate_number).toBeDefined();
    });

    it('should show assured assessments not completed in in_progress', async () => {
      const assuredReview = makeAssessment({
        assessment_type: 'assured',
        status: 'submitted',
      });

      repo.getInProgressAssessments.mockResolvedValue(paginate([assuredReview]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.in_progress.data).toHaveLength(1);
      expect(result.in_progress.data[0].assessment_type).toBe('assured');
    });

    it('should correctly separate failed from in_progress assessments', async () => {
      const failedAssessment = makeAssessment({ status: 'failed' });
      const rejectedAssessment = makeAssessment({ status: 'rejected' });
      const inProgressAssessment = makeAssessment({ status: 'in_progress' });

      repo.getInProgressAssessments.mockResolvedValue(paginate([inProgressAssessment]));
      repo.getActiveCertificates.mockResolvedValue(paginate([]));
      repo.getFailedAssessments.mockResolvedValue(
        paginate([failedAssessment, rejectedAssessment]),
      );
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.in_progress.data).toHaveLength(1);
      expect(result.failed.data).toHaveLength(2);
    });

    it('should correctly separate expired from active certificates', async () => {
      const activeCert = makeIssuedCert({
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      const expiredCert = makeIssuedCert({
        expiry_date: new Date('2025-01-01'),
      });

      repo.getInProgressAssessments.mockResolvedValue(paginate([]));
      repo.getActiveCertificates.mockResolvedValue(paginate([activeCert]));
      repo.getFailedAssessments.mockResolvedValue(paginate([]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([expiredCert]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.active.data).toHaveLength(1);
      expect(result.expired.data).toHaveLength(1);
    });
  });

  describe('Cross-module interactions', () => {
    it('should handle mixed states across certificate + assessment + organization', async () => {
      const sd = makeAssessment({
        assessment_type: 'self_disclosure',
        status: 'completed',
        branch_id: 'b1',
        branch_name: 'Branch A',
      });
      const assured = makeAssessment({
        assessment_type: 'assured',
        status: 'in_progress',
        branch_id: 'b1',
        branch_name: 'Branch A',
      });
      const active = makeIssuedCert({
        branch_id: 'b2',
        branch_name: 'Branch B',
      });
      const failed = makeAssessment({
        status: 'failed',
        branch_id: 'b1',
        branch_name: 'Branch A',
      });

      repo.getInProgressAssessments.mockResolvedValue(paginate([sd, assured]));
      repo.getActiveCertificates.mockResolvedValue(paginate([active]));
      repo.getFailedAssessments.mockResolvedValue(paginate([failed]));
      repo.getExpiredCertificates.mockResolvedValue(paginate([]));

      const result = await service.getOverview(orgId, new CertificationOverviewQueryDto());

      expect(result.in_progress.data).toHaveLength(2);
      expect(result.active.data).toHaveLength(1);
      expect(result.failed.data).toHaveLength(1);
      expect(result.expired.data).toHaveLength(0);
    });
  });
});
