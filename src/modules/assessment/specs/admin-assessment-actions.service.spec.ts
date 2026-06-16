import { Test, TestingModule } from '@nestjs/testing';
import { AdminAssessmentActionsService } from '../services/admin-assessment-actions.service';
import {
  AssessmentRepository,
  CertificateAssessment,
} from '../assessment.repository';
import {
  AiReviewRepository,
  AiReview,
  AiResponseWithQuestion,
} from '../../ai-review/ai-review.repository';
import { AiReviewAnalysisService } from '../../ai-review/services/ai-review-analysis.service';
import { AssessmentService } from '../services/assessment.service';
import { AssessmentNotificationService } from '../services/assessment-notification.service';
import { NotificationService } from '../../notification/services/notification.service';
import { BadgeRepository } from '../../notification/badge.repository';
import { DatabaseService } from '../../../database/database.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ScoreCalculationService } from '../../certificate/services/score-calculation.service';

describe('AdminAssessmentActionsService', () => {
  let service: AdminAssessmentActionsService;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;
  let aiReviewRepo: jest.Mocked<AiReviewRepository>;
  let aiReviewService: jest.Mocked<AiReviewAnalysisService>;
  let assessmentService: jest.Mocked<AssessmentService>;
  let assessmentNotificationService: jest.Mocked<AssessmentNotificationService>;
  let notificationService: jest.Mocked<NotificationService>;
  let badgeRepository: jest.Mocked<BadgeRepository>;
  let mockDatabaseService: Record<string, jest.Mock>;

  const mockAdminUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockApplicantUserId = '550e8400-e29b-41d4-a716-446655440010';
  const mockOrgId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCertificateId = '550e8400-e29b-41d4-a716-446655440002';
  const mockAssessmentId = '550e8400-e29b-41d4-a716-446655440004';
  const mockReviewId = '550e8400-e29b-41d4-a716-446655440005';

  const mockCompletedAssessment: CertificateAssessment = {
    id: mockAssessmentId,
    organization_id: mockOrgId,
    branch_id: null,
    certificate_id: mockCertificateId,
    payment_id: '550e8400-e29b-41d4-a716-446655440003',
    assessment_type: 'self_disclosure',
    badge_id: null,
    score: 35,
    is_submitted: true,
    status: 'completed',
    submitted_at: new Date(),
    completed_at: new Date(),
    assigned_auditor_id: null,
    assigned_reviewer_id: null,
    assigned_by: null,
    is_certificate_blocked: false,
    certificate_block_reason: null,
    audit_date: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAiReview: AiReview = {
    id: mockReviewId,
    certificate_assessment_id: mockAssessmentId,
    review_description: 'Review completed',
    review_status: 'completed',
    total_flags: 2,
    score: 35,
    flag_status: 'open',
    is_reviewer_assigned: false,
    started_at: new Date(),
    completed_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockFlaggedResponses: AiResponseWithQuestion[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440020',
      assessment_query_id: '550e8400-e29b-41d4-a716-446655440030',
      ai_review_id: mockReviewId,
      response: 'Non-compliant response detected.',
      is_flagged: true,
      flag_reason: 'Missing documentation',
      confidence_score: 20,
      risk_level: 'high',
      category: 'documentation',
      summary: 'Missing required documentation',
      ai_suggestion: 'Please provide the required documents',
      applicant_answer: 'no',
      created_at: new Date(),
      question_text: 'Do you have ISO certification?',
      question_type: 'boolean',
      response_type: 'boolean',
      response_value: 'no',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440021',
      assessment_query_id: '550e8400-e29b-41d4-a716-446655440031',
      ai_review_id: mockReviewId,
      response: 'Insufficient detail provided.',
      is_flagged: true,
      flag_reason: 'Insufficient evidence',
      confidence_score: 30,
      risk_level: 'medium',
      category: 'compliance',
      summary: 'Needs more detail',
      ai_suggestion: 'Provide detailed compliance evidence',
      applicant_answer: 'We have some procedures',
      created_at: new Date(),
      question_text: 'Describe your safety procedures',
      question_type: 'text',
      response_type: 'text',
      response_value: 'We have some procedures',
    },
  ];

  const mockOrganizationUsers = [mockApplicantUserId];

  beforeEach(async () => {
    const mockAssessmentRepo = {
      findAssessmentById: jest.fn(),
      findAssessmentWithDetails: jest.fn(),
      updateAssessmentStatus: jest.fn(),
      updateAssessmentScore: jest.fn(),
      updateAssessmentBadge: jest.fn(),
      getBadgeForScore: jest.fn(),
      setCertificateBlockStatus: jest.fn(),
      updateAnswerResponseValue: jest.fn(),
      updateAnswersValueBatch: jest.fn().mockResolvedValue(undefined),
    };

    const mockAiReviewRepo = {
      findAiReviewByAssessmentId: jest.fn(),
      setImproveRequested: jest.fn(),
      adminApproveReview: jest.fn(),
      escalateReview: jest.fn(),
      findFlaggedResponsesByAssessmentId: jest.fn(),
      updateAiResponse: jest.fn(),
      getAllResponsesByReviewId: jest.fn(),
      updateFlagStatus: jest.fn(),
      updateScore: jest.fn(),
      updateTotalFlags: jest.fn(),
    };

    const mockAiReviewService = {
      reReviewFlaggedQuestions: jest.fn(),
    };

    const mockAssessmentService = {};

    const mockAssessmentNotificationService = {
      getOrganizationUsers: jest.fn(),
    };

    const mockNotificationService = {
      notifyUsers: jest.fn(),
      notifyUser: jest.fn(),
    };

    const mockBadgeRepository = {
      findBadgeByOrganizationAndCertificate: jest.fn(),
      deleteBadgeByAssessmentId: jest.fn(),
    };

    const mockScoreCalculationService = {
      assignBadge: jest.fn().mockResolvedValue({
        badgeId: 'badge-1',
        badgeName: 'Bronze',
      }),
    };

    mockDatabaseService = {
      query: jest.fn(),
      getClient: jest.fn(),
      transaction: jest.fn().mockImplementation((cb: (client: unknown) => Promise<unknown>) => {
        const mockClient = { query: jest.fn().mockResolvedValue({ rows: [{ id: null }] }) };
        return cb(mockClient);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAssessmentActionsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: AssessmentRepository, useValue: mockAssessmentRepo },
        { provide: AiReviewRepository, useValue: mockAiReviewRepo },
        { provide: AiReviewAnalysisService, useValue: mockAiReviewService },
        { provide: AssessmentService, useValue: mockAssessmentService },
        {
          provide: AssessmentNotificationService,
          useValue: mockAssessmentNotificationService,
        },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: BadgeRepository, useValue: mockBadgeRepository },
        {
          provide: ScoreCalculationService,
          useValue: mockScoreCalculationService,
        },
      ],
    }).compile();

    service = module.get<AdminAssessmentActionsService>(
      AdminAssessmentActionsService,
    );
    assessmentRepo = module.get(AssessmentRepository);
    aiReviewRepo = module.get(AiReviewRepository);
    aiReviewService = module.get(AiReviewAnalysisService);
    assessmentService = module.get(AssessmentService);
    assessmentNotificationService = module.get(AssessmentNotificationService);
    notificationService = module.get(NotificationService);
    badgeRepository = module.get(BadgeRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // improveAndResolve
  // =========================================================================
  describe('improveAndResolve', () => {
    it('should set status to improvement_requested, set flag_status to pending, and batch notify applicant', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockCompletedAssessment,
      );
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue(mockAiReview);
      aiReviewRepo.setImproveRequested.mockResolvedValue({
        ...mockAiReview,
        flag_status: 'pending',
        improve_requested_by: mockAdminUserId,
        improve_message: 'Fix your answers',
      });
      assessmentRepo.updateAssessmentStatus.mockResolvedValue({
        ...mockCompletedAssessment,
        status: 'improvement_requested',
      });
      assessmentNotificationService.getOrganizationUsers.mockResolvedValue(
        mockOrganizationUsers,
      );
      notificationService.notifyUsers.mockResolvedValue(undefined);

      const result = await service.improveAndResolve(
        mockAssessmentId,
        mockAdminUserId,
        'Fix your answers',
      );

      expect(result.assessmentId).toBe(mockAssessmentId);
      expect(result.status).toBe('improvement_requested');
      expect(aiReviewRepo.setImproveRequested).toHaveBeenCalledWith(
        mockReviewId,
        mockAdminUserId,
        'Fix your answers',
      );
      expect(assessmentRepo.updateAssessmentStatus).toHaveBeenCalledWith(
        mockAssessmentId,
        'improvement_requested',
      );
      expect(notificationService.notifyUsers).toHaveBeenCalledWith(
        mockOrganizationUsers,
        expect.objectContaining({
          title: 'Assessment Improvement Requested',
        }),
      );
    });

    it('should throw NotFoundException when assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.improveAndResolve(
          mockAssessmentId,
          mockAdminUserId,
          'Fix answers',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is not completed', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockCompletedAssessment,
        status: 'in_progress',
      });

      await expect(
        service.improveAndResolve(
          mockAssessmentId,
          mockAdminUserId,
          'Fix answers',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when ai_review not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockCompletedAssessment,
      );
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue(null);

      await expect(
        service.improveAndResolve(
          mockAssessmentId,
          mockAdminUserId,
          'Fix answers',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getFlaggedQuestions
  // =========================================================================
  describe('getFlaggedQuestions', () => {
    it('should return only flagged questions with answers, flag reasons, and AI suggestions', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockCompletedAssessment,
      );
      aiReviewRepo.findFlaggedResponsesByAssessmentId.mockResolvedValue(
        mockFlaggedResponses,
      );

      const result = await service.getFlaggedQuestions(mockAssessmentId);

      expect(result).toHaveLength(2);
      expect(result[0].is_flagged).toBe(true);
      expect(result[0].question_text).toBe('Do you have ISO certification?');
      expect(result[0].flag_reason).toBe('Missing documentation');
      expect(result[0].ai_suggestion).toBe(
        'Please provide the required documents',
      );
      expect(result[1].is_flagged).toBe(true);
      expect(
        aiReviewRepo.findFlaggedResponsesByAssessmentId,
      ).toHaveBeenCalledWith(mockAssessmentId);
    });

    it('should throw NotFoundException when assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.getFlaggedQuestions(mockAssessmentId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // submitImprovements
  // =========================================================================
  describe('submitImprovements', () => {
    const mockImprovedAnswers = [
      {
        questionId: '550e8400-e29b-41d4-a716-446655440030',
        responseValue: 'yes',
      },
      {
        questionId: '550e8400-e29b-41d4-a716-446655440031',
        responseValue:
          'We have comprehensive safety procedures including regular inspections...',
      },
    ];

    it('should update flagged answers and trigger re-review', async () => {
      const improvementAssessment = {
        ...mockCompletedAssessment,
        status: 'improvement_requested' as const,
      };
      assessmentRepo.findAssessmentById.mockResolvedValue(
        improvementAssessment,
      );
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue(mockAiReview);
      aiReviewRepo.findFlaggedResponsesByAssessmentId.mockResolvedValue([
        {
          id: 'resp-1',
          assessment_query_id: '550e8400-e29b-41d4-a716-446655440030',
          ai_review_id: mockReviewId,
          is_flagged: true,
          response: null,
          flag_reason: 'test',
          confidence_score: 50,
          created_at: new Date(),
        },
        {
          id: 'resp-2',
          assessment_query_id: '550e8400-e29b-41d4-a716-446655440031',
          ai_review_id: mockReviewId,
          is_flagged: true,
          response: null,
          flag_reason: 'test',
          confidence_score: 50,
          created_at: new Date(),
        },
      ]);
      assessmentRepo.updateAnswersValueBatch.mockResolvedValue(undefined);
      aiReviewService.reReviewFlaggedQuestions.mockResolvedValue(undefined);

      await service.submitImprovements(mockAssessmentId, mockImprovedAnswers);

      expect(assessmentRepo.updateAnswersValueBatch).toHaveBeenCalledTimes(1);
      expect(aiReviewService.reReviewFlaggedQuestions).toHaveBeenCalledWith(
        mockAssessmentId,
      );
    });

    it('should throw BadRequestException when status is not improvement_requested', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockCompletedAssessment,
      );

      await expect(
        service.submitImprovements(mockAssessmentId, mockImprovedAnswers),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.submitImprovements(mockAssessmentId, mockImprovedAnswers),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // approveAssessment
  // =========================================================================
  describe('approveAssessment', () => {
    it('should approve and adjust score to 50-60 when original score < 50', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockCompletedAssessment,
      );
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue(mockAiReview);
      aiReviewRepo.adminApproveReview.mockResolvedValue({
        ...mockAiReview,
        is_admin_approved: true,
        original_score: 35,
        adjusted_score: 55,
        flag_status: 'resolved',
      });
      assessmentRepo.updateAssessmentScore.mockResolvedValue({
        ...mockCompletedAssessment,
        score: 55,
      });
      assessmentRepo.getBadgeForScore.mockResolvedValue({
        id: 'badge-1',
        name: 'Bronze',
      });
      assessmentRepo.updateAssessmentBadge.mockResolvedValue(
        mockCompletedAssessment,
      );
      assessmentNotificationService.getOrganizationUsers.mockResolvedValue(
        mockOrganizationUsers,
      );
      notificationService.notifyUsers.mockResolvedValue(undefined);

      const result = await service.approveAssessment(
        mockAssessmentId,
        mockAdminUserId,
        'Manually verified compliance',
      );

      expect(result.isAdjusted).toBe(true);
      expect(result.originalScore).toBe(35);
      expect(result.adjustedScore).toBeGreaterThanOrEqual(50);
      expect(result.adjustedScore).toBeLessThanOrEqual(60);
      // approve now uses db.transaction with raw SQL instead of individual repo calls
      expect(mockDatabaseService.transaction).toHaveBeenCalled();
      expect(notificationService.notifyUsers).toHaveBeenCalledWith(
        mockOrganizationUsers,
        expect.objectContaining({
          title: 'Assessment Approved',
        }),
      );
    });

    it('should approve without adjusting score when original score >= 50', async () => {
      const highScoreAssessment = { ...mockCompletedAssessment, score: 72 };
      const highScoreReview = { ...mockAiReview, score: 72 };

      assessmentRepo.findAssessmentById.mockResolvedValue(highScoreAssessment);
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue(
        highScoreReview,
      );
      aiReviewRepo.adminApproveReview.mockResolvedValue({
        ...highScoreReview,
        is_admin_approved: true,
        original_score: 72,
        adjusted_score: 72,
        flag_status: 'resolved',
      });
      assessmentRepo.updateAssessmentScore.mockResolvedValue(
        highScoreAssessment,
      );
      assessmentRepo.getBadgeForScore.mockResolvedValue({
        id: 'badge-2',
        name: 'Rated',
      });
      assessmentRepo.updateAssessmentBadge.mockResolvedValue(
        highScoreAssessment,
      );
      assessmentNotificationService.getOrganizationUsers.mockResolvedValue(
        mockOrganizationUsers,
      );
      notificationService.notifyUsers.mockResolvedValue(undefined);

      const result = await service.approveAssessment(
        mockAssessmentId,
        mockAdminUserId,
      );

      expect(result.isAdjusted).toBe(false);
      expect(result.originalScore).toBe(72);
      expect(result.adjustedScore).toBe(72);
    });

    it('should throw BadRequestException when already admin-approved', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockCompletedAssessment,
      );
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue({
        ...mockAiReview,
        is_admin_approved: true,
      });

      await expect(
        service.approveAssessment(mockAssessmentId, mockAdminUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.approveAssessment(mockAssessmentId, mockAdminUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // escalateAssessment
  // =========================================================================
  describe('escalateAssessment', () => {
    it('should escalate, block certificate, and batch notify applicant', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockCompletedAssessment,
      );
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue(mockAiReview);
      aiReviewRepo.escalateReview.mockResolvedValue({
        ...mockAiReview,
        flag_status: 'escalated',
        escalated_by: mockAdminUserId,
        escalation_reason: 'Suspected fraud',
      });
      assessmentRepo.setCertificateBlockStatus.mockResolvedValue(
        mockCompletedAssessment,
      );
      assessmentNotificationService.getOrganizationUsers.mockResolvedValue(
        mockOrganizationUsers,
      );
      notificationService.notifyUsers.mockResolvedValue(undefined);

      const result = await service.escalateAssessment(
        mockAssessmentId,
        mockAdminUserId,
        'Suspected fraud',
      );

      expect(result.assessmentId).toBe(mockAssessmentId);
      expect(result.status).toBe('escalated');
      // escalate now uses db.transaction with raw SQL instead of individual repo calls
      expect(mockDatabaseService.transaction).toHaveBeenCalled();
      expect(notificationService.notifyUsers).toHaveBeenCalledWith(
        mockOrganizationUsers,
        expect.objectContaining({
          title: 'Assessment Under Review',
        }),
      );
    });

    it('should throw BadRequestException when already escalated', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockCompletedAssessment,
      );
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue({
        ...mockAiReview,
        flag_status: 'escalated',
      });

      await expect(
        service.escalateAssessment(
          mockAssessmentId,
          mockAdminUserId,
          'Suspected fraud',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.escalateAssessment(
          mockAssessmentId,
          mockAdminUserId,
          'Suspected fraud',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
