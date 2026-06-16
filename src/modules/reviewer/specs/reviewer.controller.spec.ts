import { Test, TestingModule } from '@nestjs/testing';
import { ReviewerController } from '../reviewer.controller';
import { ReviewerService } from '../reviewer.service';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../../auth/auth.service';
import { ChatService } from '../../chat/chat.service';
import { ReviewerAssessmentStatus } from '../dto/certificate-assessments-query.dto';

describe('ReviewerController – getCertificateAssessments', () => {
  let controller: ReviewerController;
  let reviewerService: jest.Mocked<ReviewerService>;

  const mockReqReviewer = {
    user: { sub: 'user-1', role: 'reviewer', email: 'rev@test.com' },
  } as any;

  const mockReqAdmin = {
    user: { sub: 'admin-1', role: 'admin', email: 'admin@test.com' },
  } as any;

  beforeEach(async () => {
    const mockReviewerService = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addTags: jest.fn(),
      removeTags: jest.fn(),
      assignToAssessment: jest.fn(),
      getAssignedAssessments: jest.fn(),
      getCertificateAssessments: jest.fn(),
      getReviewerAudits: jest.fn(),
      deriveAssessmentStatus: jest.fn(),
    };

    const mockUsersService = {
      findByIdOrThrow: jest.fn(),
      findByEmail: jest.fn(),
      verifyOtp: jest.fn(),
      incrementOtpAttempts: jest.fn(),
      markOtpAsUsed: jest.fn(),
      updateEmail: jest.fn(),
      verifyPassword: jest.fn(),
      updatePassword: jest.fn(),
      markAsDeleted: jest.fn(),
    };

    const mockAuthService = {};

    const mockChatService = {
      findOrCreateAuditorReviewerThread: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewerController],
      providers: [
        { provide: ReviewerService, useValue: mockReviewerService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compile();

    controller = module.get<ReviewerController>(ReviewerController);
    reviewerService = module.get(ReviewerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return paginated certificate assessments for reviewer', async () => {
    const mockResult = {
      items: [
        {
          assessmentId: 'assessment-1',
          organizationId: 'org-1',
          organizationName: 'TechCorp',
          branchId: null,
          branchName: null,
          certificateId: 'cert-1',
          certificateName: 'ISO 9001',
          productId: null,
          totalAiFlags: 2,
          status: ReviewerAssessmentStatus.UNDER_REVIEWER,
          assignedDate: '2026-02-01T10:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    reviewerService.getCertificateAssessments.mockResolvedValue(mockResult);

    const response = await controller.getCertificateAssessments(
      mockReqReviewer,
      1,
      10,
    );

    expect(response.message).toBe(
      'Certificate assessments retrieved successfully',
    );
    expect(response.items).toEqual(mockResult.items);
    expect(response.total).toBe(1);
    expect(response.page).toBe(1);
    expect(response.limit).toBe(10);
    expect(response.totalPages).toBe(1);
    expect(reviewerService.getCertificateAssessments).toHaveBeenCalledWith(
      'user-1',
      1,
      10,
      undefined,
    );
  });

  it('should use default page=1, limit=10 when not provided', async () => {
    const mockResult = {
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    };
    reviewerService.getCertificateAssessments.mockResolvedValue(mockResult);

    await controller.getCertificateAssessments(mockReqReviewer);

    expect(reviewerService.getCertificateAssessments).toHaveBeenCalledWith(
      'user-1',
      1,
      10,
      undefined,
    );
  });

  it('should pass custom pagination parameters', async () => {
    const mockResult = {
      items: [],
      total: 50,
      page: 3,
      limit: 20,
      totalPages: 3,
    };
    reviewerService.getCertificateAssessments.mockResolvedValue(mockResult);

    const response = await controller.getCertificateAssessments(
      mockReqReviewer,
      3,
      20,
    );

    expect(response.page).toBe(3);
    expect(response.limit).toBe(20);
    expect(response.totalPages).toBe(3);
    expect(reviewerService.getCertificateAssessments).toHaveBeenCalledWith(
      'user-1',
      3,
      20,
      undefined,
    );
  });

  it('should pass assessmentType filter to service', async () => {
    const mockResult = {
      items: [],
      total: 5,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    reviewerService.getCertificateAssessments.mockResolvedValue(mockResult);

    await controller.getCertificateAssessments(
      mockReqReviewer,
      1,
      10,
      'assured',
    );

    expect(reviewerService.getCertificateAssessments).toHaveBeenCalledWith(
      'user-1',
      1,
      10,
      'assured',
    );
  });

  it('should use the JWT sub from the request as reviewer user ID', async () => {
    const mockResult = {
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    };
    reviewerService.getCertificateAssessments.mockResolvedValue(mockResult);

    await controller.getCertificateAssessments(mockReqReviewer, 1, 10);

    expect(reviewerService.getCertificateAssessments).toHaveBeenCalledWith(
      mockReqReviewer.user.sub,
      1,
      10,
      undefined,
    );
  });

  describe('getReviewerAudits', () => {
    const mockAuditsData = {
      items: [
        {
          assessment_id: 'assess-1',
          assessment_type: 'assured',
          assessment_status: 'submitted',
          organization_name: 'TechCorp',
          certificate_name: 'ISO 9001',
          audit_date: new Date('2026-02-10'),
          audit_id: 'aud-1',
          audit_lifecycle_status: 'submitted',
          audit_status: 'approved',
          review_status: null,
          score: 85,
          review_score: null,
          audit_created_at: new Date('2026-02-05'),
          audit_updated_at: new Date('2026-02-10'),
          computed_status: 'submitted',
          requested_reviewer_is_true: true,
          requested_reviewer_name: 'Jane Reviewer',
          requested_reviewer_date: new Date('2026-02-01'),
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    it('should return reviewer audits with default pagination', async () => {
      reviewerService.getReviewerAudits.mockResolvedValue(mockAuditsData);

      const response = await controller.getReviewerAudits(mockReqReviewer, {});

      expect(response.success).toBe(true);
      expect(response.message).toBe('Reviewer audits retrieved successfully');
      expect(response.data).toEqual(mockAuditsData);
      expect(reviewerService.getReviewerAudits).toHaveBeenCalledWith(
        'user-1',
        undefined,
        1,
        10,
      );
    });

    it('should pass lifecycleStatus filter', async () => {
      reviewerService.getReviewerAudits.mockResolvedValue({
        ...mockAuditsData,
        items: [],
        total: 0,
      });

      await controller.getReviewerAudits(mockReqReviewer, {
        lifecycleStatus: 'submitted',
      });

      expect(reviewerService.getReviewerAudits).toHaveBeenCalledWith(
        'user-1',
        'submitted',
        1,
        10,
      );
    });

    it('should pass custom pagination parameters', async () => {
      reviewerService.getReviewerAudits.mockResolvedValue({
        items: [],
        total: 50,
        page: 3,
        limit: 20,
        totalPages: 3,
      });

      const response = await controller.getReviewerAudits(mockReqReviewer, {
        page: 3,
        limit: 20,
      });

      expect(response.data.page).toBe(3);
      expect(response.data.limit).toBe(20);
      expect(reviewerService.getReviewerAudits).toHaveBeenCalledWith(
        'user-1',
        undefined,
        3,
        20,
      );
    });

    it('should use JWT sub as reviewer user ID', async () => {
      reviewerService.getReviewerAudits.mockResolvedValue(mockAuditsData);

      await controller.getReviewerAudits(mockReqReviewer, {});

      expect(reviewerService.getReviewerAudits).toHaveBeenCalledWith(
        mockReqReviewer.user.sub,
        undefined,
        1,
        10,
      );
    });
  });
});
