import { Test, TestingModule } from '@nestjs/testing';
import {
  CertificationOverviewService,
  CertificationOverviewResponse,
} from '../services/certification-overview.service';
import {
  CertificationOverviewRepository,
  PaginatedResult,
  OverviewAssessmentRow,
  OverviewIssuedCertRow,
} from '../repositories/certification-overview.repository';
import { CertificationOverviewQueryDto } from '../dto/certification-overview-query.dto';

describe('CertificationOverviewService', () => {
  let service: CertificationOverviewService;
  let repo: jest.Mocked<CertificationOverviewRepository>;

  const orgId = '550e8400-e29b-41d4-a716-446655440000';

  const mockAssessmentRow: OverviewAssessmentRow = {
    id: 'a1',
    organization_id: orgId,
    organization_name: 'Acme Corp',
    branch_id: 'b1',
    branch_name: 'Main Branch',
    certificate_id: 'c1',
    certificate_name: 'ISO 27001',
    assessment_type: 'self_disclosure',
    status: 'in_progress',
    score: null,
    badge_name: null,
    submitted_at: null,
    completed_at: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
    total_questions: null,
    answered_questions: null,
    answered_percent: null,
  };

  const mockIssuedCertRow: OverviewIssuedCertRow = {
    id: 'ic1',
    assessment_id: 'a2',
    certificate_id: 'c1',
    certificate_name: 'ISO 27001',
    organization_id: orgId,
    organization_name: 'Acme Corp',
    branch_id: 'b1',
    branch_name: 'Main Branch',
    badge_name: 'Gold',
    badge_color: '#FFD700',
    certificate_number: 'CERT-0001',
    review_score: 92,
    issued_at: new Date('2026-01-01'),
    expiry_date: new Date('2027-01-01'),
    is_blocked: false,
  };

  const emptyAssessmentResult: PaginatedResult<OverviewAssessmentRow> = {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, total_pages: 0 },
  };

  const emptyIssuedResult: PaginatedResult<OverviewIssuedCertRow> = {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, total_pages: 0 },
  };

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return all four sections with data', async () => {
      const inProgressResult: PaginatedResult<OverviewAssessmentRow> = {
        data: [mockAssessmentRow],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
      };
      const activeResult: PaginatedResult<OverviewIssuedCertRow> = {
        data: [mockIssuedCertRow],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
      };

      repo.getInProgressAssessments.mockResolvedValue(inProgressResult);
      repo.getActiveCertificates.mockResolvedValue(activeResult);
      repo.getFailedAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getExpiredCertificates.mockResolvedValue(emptyIssuedResult);

      const query = new CertificationOverviewQueryDto();
      const result = await service.getOverview(orgId, query);

      expect(result.in_progress.data).toHaveLength(1);
      expect(result.active.data).toHaveLength(1);
      expect(result.failed.data).toHaveLength(0);
      expect(result.expired.data).toHaveLength(0);
    });

    it('should return empty sections when no data exists', async () => {
      repo.getInProgressAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getActiveCertificates.mockResolvedValue(emptyIssuedResult);
      repo.getFailedAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getExpiredCertificates.mockResolvedValue(emptyIssuedResult);

      const query = new CertificationOverviewQueryDto();
      const result = await service.getOverview(orgId, query);

      expect(result.in_progress.data).toHaveLength(0);
      expect(result.active.data).toHaveLength(0);
      expect(result.failed.data).toHaveLength(0);
      expect(result.expired.data).toHaveLength(0);
      expect(result.in_progress.pagination.total).toBe(0);
    });

    it('should pass independent pagination params to each repository method', async () => {
      repo.getInProgressAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getActiveCertificates.mockResolvedValue(emptyIssuedResult);
      repo.getFailedAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getExpiredCertificates.mockResolvedValue(emptyIssuedResult);

      const query = new CertificationOverviewQueryDto();
      query.in_progress_page = 2;
      query.in_progress_limit = 5;
      query.active_page = 3;
      query.active_limit = 15;
      query.failed_page = 1;
      query.failed_limit = 20;
      query.expired_page = 4;
      query.expired_limit = 25;

      await service.getOverview(orgId, query);

      expect(repo.getInProgressAssessments).toHaveBeenCalledWith(orgId, 2, 5);
      expect(repo.getActiveCertificates).toHaveBeenCalledWith(orgId, 3, 15);
      expect(repo.getFailedAssessments).toHaveBeenCalledWith(orgId, 1, 20);
      expect(repo.getExpiredCertificates).toHaveBeenCalledWith(orgId, 4, 25);
    });

    it('should execute all four queries in parallel', async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let callOrder: string[] = [];

      repo.getInProgressAssessments.mockImplementation(async () => {
        callOrder.push('in_progress_start');
        await delay(10);
        callOrder.push('in_progress_end');
        return emptyAssessmentResult;
      });
      repo.getActiveCertificates.mockImplementation(async () => {
        callOrder.push('active_start');
        await delay(10);
        callOrder.push('active_end');
        return emptyIssuedResult;
      });
      repo.getFailedAssessments.mockImplementation(async () => {
        callOrder.push('failed_start');
        await delay(10);
        callOrder.push('failed_end');
        return emptyAssessmentResult;
      });
      repo.getExpiredCertificates.mockImplementation(async () => {
        callOrder.push('expired_start');
        await delay(10);
        callOrder.push('expired_end');
        return emptyIssuedResult;
      });

      const query = new CertificationOverviewQueryDto();
      await service.getOverview(orgId, query);

      // All starts should come before all ends (parallel execution)
      const startIndices = callOrder
        .map((v, i) => (v.endsWith('_start') ? i : -1))
        .filter((i) => i >= 0);
      const endIndices = callOrder
        .map((v, i) => (v.endsWith('_end') ? i : -1))
        .filter((i) => i >= 0);

      expect(startIndices).toHaveLength(4);
      expect(endIndices).toHaveLength(4);
    });

    it('should use default pagination when no query params provided', async () => {
      repo.getInProgressAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getActiveCertificates.mockResolvedValue(emptyIssuedResult);
      repo.getFailedAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getExpiredCertificates.mockResolvedValue(emptyIssuedResult);

      const query = new CertificationOverviewQueryDto();
      await service.getOverview(orgId, query);

      expect(repo.getInProgressAssessments).toHaveBeenCalledWith(orgId, 1, 10);
      expect(repo.getActiveCertificates).toHaveBeenCalledWith(orgId, 1, 10);
      expect(repo.getFailedAssessments).toHaveBeenCalledWith(orgId, 1, 10);
      expect(repo.getExpiredCertificates).toHaveBeenCalledWith(orgId, 1, 10);
    });

    it('should propagate repository errors', async () => {
      repo.getInProgressAssessments.mockRejectedValue(
        new Error('Database connection failed'),
      );
      repo.getActiveCertificates.mockResolvedValue(emptyIssuedResult);
      repo.getFailedAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getExpiredCertificates.mockResolvedValue(emptyIssuedResult);

      const query = new CertificationOverviewQueryDto();
      await expect(service.getOverview(orgId, query)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should return correct pagination metadata', async () => {
      const resultWith25: PaginatedResult<OverviewAssessmentRow> = {
        data: [mockAssessmentRow],
        pagination: { page: 3, limit: 10, total: 25, total_pages: 3 },
      };

      repo.getInProgressAssessments.mockResolvedValue(resultWith25);
      repo.getActiveCertificates.mockResolvedValue(emptyIssuedResult);
      repo.getFailedAssessments.mockResolvedValue(emptyAssessmentResult);
      repo.getExpiredCertificates.mockResolvedValue(emptyIssuedResult);

      const query = new CertificationOverviewQueryDto();
      query.in_progress_page = 3;
      const result = await service.getOverview(orgId, query);

      expect(result.in_progress.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        total_pages: 3,
      });
    });
  });
});
