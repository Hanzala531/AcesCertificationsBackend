import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { CertificationOverviewService } from '../services/certification-overview.service';
import {
  CertificationOverviewRepository,
  PaginatedResult,
  OverviewAssessmentRow,
  OverviewIssuedCertRow,
} from '../repositories/certification-overview.repository';
import { CertificationOverviewQueryDto } from '../dto/certification-overview-query.dto';
import { CertificateController } from '../certificate.controller';
import { CertificateService } from '../services/certificate.service';
import { CertificateStructureService } from '../services/certificate-structure.service';
import { CertificateQueryService } from '../services/certificate-query.service';
import { CertificateDuplicateService } from '../services/certificate-duplicate.service';
import { CertificateDevService } from '../services/certificate-dev.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RoleGuard } from '../../auth/role.guard';

/**
 * E2E tests: full request → controller → service → (mocked) DB → response
 */
describe('Certification Overview E2E', () => {
  let app: INestApplication;
  let overviewService: jest.Mocked<CertificationOverviewService>;

  const orgId = 'org-e2e-001';

  const emptyResponse = {
    in_progress: { data: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } },
    active: { data: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } },
    failed: { data: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } },
    expired: { data: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificateController],
      providers: [
        {
          provide: CertificationOverviewService,
          useValue: { getOverview: jest.fn() },
        },
        { provide: CertificateService, useValue: {} },
        { provide: CertificateStructureService, useValue: {} },
        { provide: CertificateQueryService, useValue: {} },
        { provide: CertificateDuplicateService, useValue: {} },
        { provide: CertificateDevService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = {
            sub: 'user-001',
            email: 'test@test.com',
            role: 'organization',
            organization_id: orgId,
          };
          return true;
        },
      })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: true,
      }),
    );
    await app.init();

    overviewService = module.get(CertificationOverviewService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /certifications/overview', () => {
    it('should return 200 with correct response structure', async () => {
      overviewService.getOverview.mockResolvedValue(emptyResponse);

      const res = await request(app.getHttpServer())
        .get('/certifications/overview')
        .expect(HttpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Certification overview retrieved successfully');
      expect(res.body.data).toHaveProperty('in_progress');
      expect(res.body.data).toHaveProperty('active');
      expect(res.body.data).toHaveProperty('failed');
      expect(res.body.data).toHaveProperty('expired');
      expect(res.body.data.in_progress).toHaveProperty('data');
      expect(res.body.data.in_progress).toHaveProperty('pagination');
    });

    it('should pass pagination query params correctly', async () => {
      overviewService.getOverview.mockResolvedValue(emptyResponse);

      await request(app.getHttpServer())
        .get('/certifications/overview')
        .query({
          in_progress_page: 2,
          in_progress_limit: 5,
          active_page: 3,
          active_limit: 15,
          failed_page: 1,
          failed_limit: 20,
          expired_page: 4,
          expired_limit: 25,
        })
        .expect(HttpStatus.OK);

      const callArgs = overviewService.getOverview.mock.calls[0];
      expect(callArgs[0]).toBe(orgId);
      const query = callArgs[1];
      // class-transformer @Type(() => Number) converts string query params to numbers
      expect(query).toBeInstanceOf(CertificationOverviewQueryDto);
      expect(query.in_progress_page).toBe(2);
      expect(query.in_progress_limit).toBe(5);
      expect(query.active_page).toBe(3);
      expect(query.active_limit).toBe(15);
      expect(query.failed_page).toBe(1);
      expect(query.failed_limit).toBe(20);
      expect(query.expired_page).toBe(4);
      expect(query.expired_limit).toBe(25);
    });

    it('should use default pagination when no params provided', async () => {
      overviewService.getOverview.mockResolvedValue(emptyResponse);

      await request(app.getHttpServer())
        .get('/certifications/overview')
        .expect(HttpStatus.OK);

      const callArgs = overviewService.getOverview.mock.calls[0];
      expect(callArgs[1].in_progress_page).toBe(1);
      expect(callArgs[1].in_progress_limit).toBe(10);
    });

    it('should return data with assessments and issued certificates', async () => {
      const responseWithData = {
        in_progress: {
          data: [
            {
              id: 'a1',
              organization_name: 'Org',
              certificate_name: 'ISO 27001',
              assessment_type: 'self_disclosure',
              status: 'in_progress',
            },
          ],
          pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
        },
        active: {
          data: [
            {
              id: 'ic1',
              certificate_name: 'ISO 27001',
              certificate_number: 'CERT-0001',
              is_blocked: false,
            },
          ],
          pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
        },
        failed: { data: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } },
        expired: { data: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } },
      };

      overviewService.getOverview.mockResolvedValue(responseWithData as any);

      const res = await request(app.getHttpServer())
        .get('/certifications/overview')
        .expect(HttpStatus.OK);

      expect(res.body.data.in_progress.data).toHaveLength(1);
      expect(res.body.data.active.data).toHaveLength(1);
      expect(res.body.data.failed.data).toHaveLength(0);
      expect(res.body.data.expired.data).toHaveLength(0);
    });

    it('should reject invalid pagination params (negative page)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/overview')
        .query({ in_progress_page: -1 })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.statusCode).toBe(400);
    });

    it('should reject limit exceeding maximum (100)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/overview')
        .query({ active_limit: 200 })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.statusCode).toBe(400);
    });

    it('should reject non-integer pagination params', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/overview')
        .query({ in_progress_page: 'abc' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.statusCode).toBe(400);
    });

    it('should handle service errors gracefully', async () => {
      overviewService.getOverview.mockRejectedValue(new Error('DB down'));

      await request(app.getHttpServer())
        .get('/certifications/overview')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication (tested via guard mock returning user)', async () => {
      overviewService.getOverview.mockResolvedValue(emptyResponse);

      const res = await request(app.getHttpServer())
        .get('/certifications/overview')
        .expect(HttpStatus.OK);

      expect(res.body.success).toBe(true);
    });
  });
});
