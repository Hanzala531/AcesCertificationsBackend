import { Test, TestingModule } from '@nestjs/testing';
import { CertificationOverviewRepository } from '../repositories/certification-overview.repository';
import { DatabaseService } from '../../../database/database.service';

describe('CertificationOverviewRepository', () => {
  let repository: CertificationOverviewRepository;
  let db: jest.Mocked<DatabaseService>;

  const orgId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationOverviewRepository,
        {
          provide: DatabaseService,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get(CertificationOverviewRepository);
    db = module.get(DatabaseService);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('getInProgressAssessments', () => {
    it('should return paginated in-progress assessments', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'a1',
              organization_id: orgId,
              organization_name: 'Org',
              branch_id: null,
              branch_name: null,
              certificate_id: 'c1',
              certificate_name: 'Cert',
              assessment_type: 'self_disclosure',
              status: 'in_progress',
              score: null,
              badge_name: null,
              submitted_at: null,
              completed_at: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        } as any);

      const result = await repository.getInProgressAssessments(orgId, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.total_pages).toBe(1);
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should calculate correct offset for page 2', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '15' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await repository.getInProgressAssessments(orgId, 2, 10);

      // Second call (data query) should have offset = 10
      const dataCall = db.query.mock.calls[1];
      expect(dataCall[1]).toEqual([orgId, 10, 10]); // [orgId, limit, offset]
      expect(result.pagination.total_pages).toBe(2);
    });

    it('should return empty result when no assessments exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await repository.getInProgressAssessments(orgId, 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.total_pages).toBe(0);
    });

    it('should include self_disclosure with allowed statuses in query', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await repository.getInProgressAssessments(orgId, 1, 10);

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain("ca.status NOT IN ('failed', 'rejected')");
      expect(countQuery).toContain("ca.status = 'completed'");
      expect(countQuery).toContain('ca.badge_id IS NULL');
    });

    it('should exclude combinations with active issued certificates', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await repository.getInProgressAssessments(orgId, 1, 10);

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain('NOT EXISTS');
      expect(countQuery).toContain('issued_certificates');
    });

    it('should exclude completed assessments without a badge from in_progress', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await repository.getInProgressAssessments(orgId, 1, 10);

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain('AND NOT (');
      expect(countQuery).toContain("ca.status = 'completed'");
      expect(countQuery).toContain('ca.badge_id IS NULL');
    });
  });

  describe('getActiveCertificates', () => {
    it('should return paginated active certificates', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ic1',
              certificate_name: 'ISO 27001',
              certificate_number: 'CERT-0001',
              is_blocked: false,
            },
          ],
        } as any);

      const result = await repository.getActiveCertificates(orgId, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should only return non-blocked, non-expired certificates', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await repository.getActiveCertificates(orgId, 1, 10);

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain('is_blocked = false');
      expect(countQuery).toContain('expiry_date >= NOW()');
    });
  });

  describe('getFailedAssessments', () => {
    it('should return paginated failed assessments', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '3' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: 'a1', status: 'failed' },
            { id: 'a2', status: 'rejected' },
          ],
        } as any);

      const result = await repository.getFailedAssessments(orgId, 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(3);
    });

    it('should filter by failed and rejected statuses', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await repository.getFailedAssessments(orgId, 1, 10);

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain("'failed'");
      expect(countQuery).toContain("'rejected'");
    });

    it('should treat completed assessments without a badge as failed', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await repository.getFailedAssessments(orgId, 1, 10);

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain("ca.status = 'completed'");
      expect(countQuery).toContain('ca.badge_id IS NULL');
    });
  });

  describe('getExpiredCertificates', () => {
    it('should return paginated expired certificates', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ic1',
              expiry_date: new Date('2025-01-01'),
              certificate_name: 'Expired Cert',
            },
          ],
        } as any);

      const result = await repository.getExpiredCertificates(orgId, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by expiry_date < NOW()', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await repository.getExpiredCertificates(orgId, 1, 10);

      const countQuery = db.query.mock.calls[0][0] as string;
      expect(countQuery).toContain('expiry_date < NOW()');
      expect(countQuery).toContain('expiry_date IS NOT NULL');
    });
  });

  describe('pagination edge cases', () => {
    it('should handle pagination overflow (page beyond total_pages)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await repository.getInProgressAssessments(orgId, 100, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.total_pages).toBe(1);
      expect(result.pagination.page).toBe(100);
    });

    it('should handle limit of 1', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '10' }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'a1' }] } as any);

      const result = await repository.getActiveCertificates(orgId, 1, 1);

      expect(result.pagination.total_pages).toBe(10);
      expect(result.pagination.limit).toBe(1);
    });
  });
});
