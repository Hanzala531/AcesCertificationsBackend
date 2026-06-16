import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentService } from '../services/assessment.service';
import {
  AssessmentRepository,
  CertificateAssessment,
  AssessmentWithDetails,
  AssessmentQuery,
  QuestionWithAnswer,
} from '../assessment.repository';
import { PaymentService } from '../../payment/payment.service';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';
import { AiReviewService } from '../../ai-review/services/ai-review.service';
import { AiReviewRepository } from '../../ai-review/ai-review.repository';
import { AssessmentNotificationService } from '../services/assessment-notification.service';
import { BadgeRepository } from '../../notification/badge.repository';
import { ChatService } from '../../chat/chat.service';
import { ScoreCalculationService } from '../../certificate/services/score-calculation.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ResponseType } from '../dto/submit-answer.dto';
import { AssessmentType } from '../dto/create-assessment.dto';

describe('AssessmentService', () => {
  let service: AssessmentService;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;
  let paymentService: jest.Mocked<PaymentService>;
  let organizationRepo: jest.Mocked<OrganizationRepository>;
  let employeeRepo: jest.Mocked<EmployeeRepository>;
  let aiReviewService: jest.Mocked<AiReviewService>;
  let aiReviewRepo: jest.Mocked<AiReviewRepository>;
  let scoreCalculationService: {
    buildScoreInputsFromAnswers: jest.Mock;
    calculateCertificateScore: jest.Mock;
  };

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockOrgId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCertificateId = '550e8400-e29b-41d4-a716-446655440002';
  const mockPaymentId = '550e8400-e29b-41d4-a716-446655440003';
  const mockAssessmentId = '550e8400-e29b-41d4-a716-446655440004';
  const mockBranchId = '550e8400-e29b-41d4-a716-446655440005';

  const mockAssessment: CertificateAssessment = {
    id: mockAssessmentId,
    organization_id: mockOrgId,
    branch_id: null,
    certificate_id: mockCertificateId,
    payment_id: mockPaymentId,
    assessment_type: 'self_disclosure',
    badge_id: null,
    score: null,
    is_submitted: false,
    status: 'in_progress',
    submitted_at: null,
    completed_at: null,
    assigned_auditor_id: null,
    assigned_reviewer_id: null,
    assigned_by: null,
    audit_date: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAssessmentWithDetails: AssessmentWithDetails = {
    ...mockAssessment,
    certificate_name: 'ISO 9001',
    organization_name: 'Test Org',
    badge_name: undefined,
    total_questions: 10,
    answered_questions: 5,
  };

  const mockOrganization = {
    id: mockOrgId,
    name: 'Test Organization',
  };

  const mockEmployee = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    organization_id: mockOrgId,
    branch_id: mockBranchId,
    user_id: mockUserId,
  };

  const mockPayment = {
    id: mockPaymentId,
    user_id: mockUserId,
    certificate_id: mockCertificateId,
    payment_type: 'self_disclosure' as const,
    amount: 500,
    currency: 'USD',
    status: 'completed' as const,
    is_paid: true,
    transaction_id: 'txn_123',
    payment_method: 'card',
    paid_at: new Date(),
    stripe_payment_intent_id: null,
    stripe_customer_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockAssessmentRepo = {
      createAssessment: jest.fn(),
      findAssessmentById: jest.fn(),
      findAssessmentWithDetails: jest.fn(),
      findAssessmentsByOrganization: jest.fn(),
      findLatestSelfDisclosureByOrganization: jest.fn(),
      hasAssuredAppliedByOrganization: jest.fn(),
      findBranchByIdAndOrganization: jest.fn(),
      findExistingAssessment: jest.fn(),
      saveAnswer: jest.fn(),
      saveAnswersBatch: jest.fn(),
      getOrganizationUserIds: jest.fn().mockResolvedValue([]),
      findAnswerById: jest.fn(),
      updateAnswer: jest.fn(),
      submitAssessment: jest.fn(),
      submitAndSetStatus: jest.fn(),
      updateAssessmentStatus: jest.fn(),
      updateAssessmentScore: jest.fn(),
      updateAssessmentBadge: jest.fn(),
      getQuestionsWithAnswers: jest.fn(),
      getAssessmentAnswers: jest.fn(),
      getBadgeForScore: jest.fn(),
      revertAssessmentSubmission: jest.fn(),
    };

    const mockPaymentService = {
      verifyPaymentForAssessment: jest.fn(),
    };

    const mockOrganizationRepo = {
      findByUserId: jest.fn(),
    };

    const mockEmployeeRepo = {
      findByUserId: jest.fn(),
    };

    const mockAiReviewService = {
      triggerAiReview: jest.fn(),
      getAiReviewForAssessment: jest.fn(),
    };

    const mockAiReviewRepo = {
      findAiReviewByAssessmentId: jest.fn(),
      updateAiReviewStatus: jest.fn(),
      createAiReview: jest.fn(),
      updateScore: jest.fn(),
      updateScoreSummary: jest.fn(),
      deleteAiReview: jest.fn(),
    };

    const mockScoreCalculationService = {
      buildScoreInputsFromAnswers: jest.fn().mockReturnValue([]),
      calculateCertificateScore: jest.fn().mockReturnValue({
        earnedScore: 0,
        maxScore: 0,
        finalPercentage: 0,
      }),
      assignBadge: jest.fn().mockResolvedValue({
        badgeId: 'badge-1',
        badgeName: 'Rated',
      }),
    };

    const mockBadgeRepository = {
      findBadgeByOrganizationAndCertificate: jest.fn(),
    };

    const mockChatService = {
      createThreadForAssuredAssessment: jest.fn(),
    };

    const mockAssessmentNotificationService = {
      sendAssessmentSubmittedNotification: jest.fn(),
      sendAssessmentSubmissionNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        { provide: AssessmentRepository, useValue: mockAssessmentRepo },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: OrganizationRepository, useValue: mockOrganizationRepo },
        { provide: EmployeeRepository, useValue: mockEmployeeRepo },
        { provide: AiReviewService, useValue: mockAiReviewService },
        { provide: AiReviewRepository, useValue: mockAiReviewRepo },
        {
          provide: AssessmentNotificationService,
          useValue: mockAssessmentNotificationService,
        },
        { provide: BadgeRepository, useValue: mockBadgeRepository },
        {
          provide: ScoreCalculationService,
          useValue: mockScoreCalculationService,
        },
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compile();

    service = module.get<AssessmentService>(AssessmentService);
    assessmentRepo = module.get(AssessmentRepository);
    paymentService = module.get(PaymentService);
    organizationRepo = module.get(OrganizationRepository);
    employeeRepo = module.get(EmployeeRepository);
    aiReviewService = module.get(AiReviewService);
    aiReviewRepo = module.get(AiReviewRepository);
    scoreCalculationService = module.get(ScoreCalculationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAssessment', () => {
    it('should create assessment for organization user', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue(mockPayment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.findBranchByIdAndOrganization.mockResolvedValue({
        id: mockBranchId,
      } as any);
      assessmentRepo.findExistingAssessment.mockResolvedValue(null);
      assessmentRepo.createAssessment.mockResolvedValue(mockAssessment);

      const result = await service.createAssessment(
        mockUserId,
        'organization',
        {
          certificate_id: mockCertificateId,
          payment_id: mockPaymentId,
          assessment_type: AssessmentType.SELF_DISCLOSURE,
          branch_id: mockBranchId,
        },
      );

      expect(result).toEqual(mockAssessment);
      expect(paymentService.verifyPaymentForAssessment).toHaveBeenCalledWith(
        mockUserId,
        mockPaymentId,
      );
    });

    it('should create assessment for organization member with branch', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue(mockPayment);
      employeeRepo.findByUserId.mockResolvedValue(mockEmployee as any);
      assessmentRepo.findBranchByIdAndOrganization.mockResolvedValue({
        id: mockBranchId,
      } as any);
      assessmentRepo.findExistingAssessment.mockResolvedValue(null);
      assessmentRepo.createAssessment.mockResolvedValue({
        ...mockAssessment,
        branch_id: mockBranchId,
      });

      const result = await service.createAssessment(
        mockUserId,
        'organization_member',
        {
          certificate_id: mockCertificateId,
          payment_id: mockPaymentId,
          assessment_type: AssessmentType.SELF_DISCLOSURE,
          branch_id: mockBranchId,
        },
      );

      expect(result.branch_id).toBe(mockBranchId);
    });

    it('should throw BadRequestException when branch does not belong to organization', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue(mockPayment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.findBranchByIdAndOrganization.mockResolvedValue(null);

      await expect(
        service.createAssessment(mockUserId, 'organization', {
          certificate_id: mockCertificateId,
          payment_id: mockPaymentId,
          assessment_type: AssessmentType.SELF_DISCLOSURE,
          branch_id: mockBranchId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow organization member to create assessment for any branch in their org', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue(mockPayment);
      employeeRepo.findByUserId.mockResolvedValue(mockEmployee as any);
      assessmentRepo.findBranchByIdAndOrganization.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440999' });
      assessmentRepo.findExistingAssessment.mockResolvedValue(null);
      assessmentRepo.createAssessment.mockResolvedValue(mockAssessment);

      const result = await service.createAssessment(mockUserId, 'organization_member', {
        certificate_id: mockCertificateId,
        payment_id: mockPaymentId,
        assessment_type: AssessmentType.SELF_DISCLOSURE,
        branch_id: '550e8400-e29b-41d4-a716-446655440999',
      });

      expect(result).toBeDefined();
    });

    it('should return existing assessment if one already exists', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue(mockPayment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.findBranchByIdAndOrganization.mockResolvedValue({
        id: mockBranchId,
      } as any);
      assessmentRepo.findExistingAssessment.mockResolvedValue(mockAssessment);

      const result = await service.createAssessment(
        mockUserId,
        'organization',
        {
          certificate_id: mockCertificateId,
          payment_id: mockPaymentId,
          assessment_type: AssessmentType.SELF_DISCLOSURE,
          branch_id: mockBranchId,
        },
      );

      expect(result).toEqual(mockAssessment);
      expect(assessmentRepo.createAssessment).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if payment type mismatch', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue({
        ...mockPayment,
        payment_type: 'assured' as const,
      });
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);

      await expect(
        service.createAssessment(mockUserId, 'organization', {
          certificate_id: mockCertificateId,
          payment_id: mockPaymentId,
          assessment_type: AssessmentType.SELF_DISCLOSURE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if certificate mismatch', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue({
        ...mockPayment,
        certificate_id: 'different-cert-id',
      });
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);

      await expect(
        service.createAssessment(mockUserId, 'organization', {
          certificate_id: mockCertificateId,
          payment_id: mockPaymentId,
          assessment_type: AssessmentType.SELF_DISCLOSURE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for organization user without organization', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue(mockPayment);
      organizationRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.createAssessment(mockUserId, 'organization', {
          certificate_id: mockCertificateId,
          payment_id: mockPaymentId,
          assessment_type: AssessmentType.SELF_DISCLOSURE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for invalid role', async () => {
      paymentService.verifyPaymentForAssessment.mockResolvedValue(mockPayment);

      await expect(
        service.createAssessment(mockUserId, 'admin', {
          certificate_id: mockCertificateId,
          payment_id: mockPaymentId,
          assessment_type: AssessmentType.SELF_DISCLOSURE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAssessments', () => {
    it('should return paginated assessments for organization', async () => {
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      const mockResponse = {
        data: [mockAssessmentWithDetails],
        total: 1,
        page: 1,
        limit: 10,
      };
      assessmentRepo.findAssessmentsByOrganization.mockResolvedValue(
        mockResponse,
      );

      const result = await service.getAssessments(
        mockUserId,
        'organization',
        1,
        10,
      );

      expect(result).toEqual(mockResponse);
    });

    it('should filter by branch for organization member', async () => {
      employeeRepo.findByUserId.mockResolvedValue(mockEmployee as any);
      const mockResponse = {
        data: [mockAssessmentWithDetails],
        total: 1,
        page: 1,
        limit: 10,
      };
      assessmentRepo.findAssessmentsByOrganization.mockResolvedValue(
        mockResponse,
      );

      await service.getAssessments(mockUserId, 'organization_member', 1, 10);

      expect(assessmentRepo.findAssessmentsByOrganization).toHaveBeenCalledWith(
        mockOrgId,
        expect.objectContaining({ branchId: mockBranchId }),
      );
    });
  });

  describe('getSelfDisclosureStatus', () => {
    const mockSelfDisclosure = {
      id: mockAssessmentId,
      status: 'submitted',
      is_submitted: true,
      submitted_at: new Date('2026-03-03T08:00:00.000Z'),
      created_at: new Date('2026-03-03T07:00:00.000Z'),
    };

    it('should check organization-level status when branchId is not provided', async () => {
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.findLatestSelfDisclosureByOrganization.mockResolvedValue(
        mockSelfDisclosure as any,
      );
      assessmentRepo.hasAssuredAppliedByOrganization.mockResolvedValue(true);

      const result = await service.getSelfDisclosureStatus(
        mockUserId,
        'organization',
        mockCertificateId,
      );

      expect(
        assessmentRepo.findLatestSelfDisclosureByOrganization,
      ).toHaveBeenCalledWith(mockOrgId, mockCertificateId, undefined);
      expect(
        assessmentRepo.hasAssuredAppliedByOrganization,
      ).toHaveBeenCalledWith(mockOrgId, mockCertificateId, undefined);
      expect(result.hasSelfDisclosure).toBe(true);
      expect(result.isAssuredApplied).toBe(true);
      expect(result.assessmentId).toBe(mockAssessmentId);
    });

    it('should check branch-level status when branchId is provided', async () => {
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.findLatestSelfDisclosureByOrganization.mockResolvedValue(
        mockSelfDisclosure as any,
      );
      assessmentRepo.hasAssuredAppliedByOrganization.mockResolvedValue(false);

      await service.getSelfDisclosureStatus(
        mockUserId,
        'organization',
        mockCertificateId,
        mockBranchId,
      );

      expect(
        assessmentRepo.findLatestSelfDisclosureByOrganization,
      ).toHaveBeenCalledWith(mockOrgId, mockCertificateId, mockBranchId);
      expect(
        assessmentRepo.hasAssuredAppliedByOrganization,
      ).toHaveBeenCalledWith(mockOrgId, mockCertificateId, mockBranchId);
    });

    it('should allow organization_member to query self disclosure for any branch in their org', async () => {
      employeeRepo.findByUserId.mockResolvedValue(mockEmployee as any);
      assessmentRepo.findLatestSelfDisclosureByOrganization.mockResolvedValue(null);
      assessmentRepo.hasAssuredAppliedByOrganization.mockResolvedValue(false);

      const result = await service.getSelfDisclosureStatus(
        mockUserId,
        'organization_member',
        mockCertificateId,
        '550e8400-e29b-41d4-a716-446655440999',
      );

      expect(result.hasSelfDisclosure).toBe(false);
      expect(result.isAssuredApplied).toBe(false);
    });
  });

  describe('getAssessmentById', () => {
    it('should return assessment details for authorized user', async () => {
      assessmentRepo.findAssessmentWithDetails.mockResolvedValue(
        mockAssessmentWithDetails,
      );
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);

      const result = await service.getAssessmentById(
        mockUserId,
        'organization',
        mockAssessmentId,
      );

      expect(result).toEqual(mockAssessmentWithDetails);
    });

    it('should throw NotFoundException if assessment not found', async () => {
      assessmentRepo.findAssessmentWithDetails.mockResolvedValue(null);

      await expect(
        service.getAssessmentById(mockUserId, 'organization', mockAssessmentId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitAnswers', () => {
    const mockAnswerDto = {
      answers: [
        {
          question_id: '550e8400-e29b-41d4-a716-446655440020',
          response_type: ResponseType.BOOLEAN,
          response_value: 'yes',
        },
        {
          question_id: '550e8400-e29b-41d4-a716-446655440021',
          response_type: ResponseType.TEXT,
          response_value: 'This is a detailed text response.',
        },
      ],
    };

    const mockSavedAnswer: AssessmentQuery = {
      id: '550e8400-e29b-41d4-a716-446655440030',
      certificate_assessment_id: mockAssessmentId,
      question_id: '550e8400-e29b-41d4-a716-446655440020',
      response_type: 'boolean',
      response_value: 'yes',
      response_files: null,
      reviewer_notes: null,
      auditor_notes: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should save answers successfully', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.saveAnswersBatch.mockResolvedValue([
        mockSavedAnswer,
        mockSavedAnswer,
      ]);

      const result = await service.submitAnswers(
        mockUserId,
        'organization',
        mockAssessmentId,
        mockAnswerDto,
      );

      expect(result).toHaveLength(2);
      expect(assessmentRepo.saveAnswersBatch).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException if assessment already submitted', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        is_submitted: true,
      });

      await expect(
        service.submitAnswers(
          mockUserId,
          'organization',
          mockAssessmentId,
          mockAnswerDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if assessment certificate is blocked', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        is_certificate_blocked: true,
      });

      await expect(
        service.submitAnswers(
          mockUserId,
          'organization',
          mockAssessmentId,
          mockAnswerDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid boolean response', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);

      const invalidAnswerDto = {
        answers: [
          {
            question_id: '550e8400-e29b-41d4-a716-446655440020',
            response_type: ResponseType.BOOLEAN,
            response_value: 'maybe',
          },
        ],
      };

      await expect(
        service.submitAnswers(
          mockUserId,
          'organization',
          mockAssessmentId,
          invalidAnswerDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateAnswer', () => {
    const mockAnswer: AssessmentQuery = {
      id: '550e8400-e29b-41d4-a716-446655440030',
      certificate_assessment_id: mockAssessmentId,
      question_id: '550e8400-e29b-41d4-a716-446655440020',
      response_type: 'boolean',
      response_value: 'yes',
      response_files: null,
      reviewer_notes: null,
      auditor_notes: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should update answer successfully', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.findAnswerById.mockResolvedValue(mockAnswer);
      assessmentRepo.updateAnswer.mockResolvedValue({
        ...mockAnswer,
        response_value: 'no',
      });

      const result = await service.updateAnswer(
        mockUserId,
        'organization',
        mockAssessmentId,
        mockAnswer.id,
        { response_type: ResponseType.BOOLEAN, response_value: 'no' },
      );

      expect(result.response_value).toBe('no');
    });

    it('should throw BadRequestException if assessment already submitted', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        is_submitted: true,
      });

      await expect(
        service.updateAnswer(
          mockUserId,
          'organization',
          mockAssessmentId,
          mockAnswer.id,
          { response_type: ResponseType.BOOLEAN, response_value: 'no' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if assessment certificate is blocked', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        is_certificate_blocked: true,
      });

      await expect(
        service.updateAnswer(
          mockUserId,
          'organization',
          mockAssessmentId,
          mockAnswer.id,
          { response_type: ResponseType.BOOLEAN, response_value: 'no' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if answer not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.findAnswerById.mockResolvedValue(null);

      await expect(
        service.updateAnswer(
          mockUserId,
          'organization',
          mockAssessmentId,
          'non-existent-id',
          { response_type: ResponseType.BOOLEAN, response_value: 'no' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if answer belongs to different assessment', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      assessmentRepo.findAnswerById.mockResolvedValue({
        ...mockAnswer,
        certificate_assessment_id: 'different-assessment-id',
      });

      await expect(
        service.updateAnswer(
          mockUserId,
          'organization',
          mockAssessmentId,
          mockAnswer.id,
          { response_type: ResponseType.BOOLEAN, response_value: 'no' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitAssessment', () => {
    it('should submit assessment and trigger AI review', async () => {
      // Set OPENAI_API_KEY so the pre-check passes
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      // submitAssessment checks for existing AI review
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue(null);
      assessmentRepo.submitAndSetStatus.mockResolvedValue({
        ...mockAssessment,
        is_submitted: true,
        status: 'ai_reviewing',
      });
      assessmentRepo.findAssessmentWithDetails.mockResolvedValue(
        mockAssessmentWithDetails,
      );
      aiReviewService.triggerAiReview.mockResolvedValue({} as any);

      const result = await service.submitAssessment(
        mockUserId,
        'organization',
        mockAssessmentId,
      );

      // Allow setImmediate callbacks to execute
      await new Promise((resolve) => setImmediate(resolve));

      expect(result.is_submitted).toBe(true);
      expect(assessmentRepo.submitAndSetStatus).toHaveBeenCalledWith(
        mockAssessmentId,
        'ai_reviewing',
      );
      expect(aiReviewService.triggerAiReview).toHaveBeenCalledWith(
        mockAssessmentId,
      );

      // Restore env
      if (originalKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });

    it('should throw BadRequestException if already submitted', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        is_submitted: true,
      });
      // When is_submitted is true AND there's an existing AI review, it throws BadRequestException
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue({
        id: 'existing-review-id',
        review_status: 'completed',
      } as any);

      await expect(
        service.submitAssessment(mockUserId, 'organization', mockAssessmentId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if assessment certificate is blocked', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        is_certificate_blocked: true,
      });

      await expect(
        service.submitAssessment(mockUserId, 'organization', mockAssessmentId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAssessmentScore', () => {
    it('should return score and badge information', async () => {
      const assessmentWithScore: AssessmentWithDetails = {
        ...mockAssessmentWithDetails,
        score: 85,
        badge_id: 'badge-id',
        badge_name: 'Verified',
        status: 'completed',
      };
      assessmentRepo.findAssessmentWithDetails.mockResolvedValue(
        assessmentWithScore,
      );
      organizationRepo.findByUserId.mockResolvedValue(mockOrganization as any);
      aiReviewService.getAiReviewForAssessment.mockResolvedValue({
        id: 'review-1',
        status: 'completed',
        total_flags: 0,
        score: 85,
      } as any);

      const result = await service.getAssessmentScore(
        mockUserId,
        'organization',
        mockAssessmentId,
      );

      expect(result).toEqual({
        score: 85,
        badge_id: 'badge-id',
        badge_name: 'Verified',
        badge_color: null,
        badge_tier: null,
        status: 'completed',
      });
    });
  });

  describe('calculateAndUpdateScore', () => {
    const mockQuestionsWithAnswers: QuestionWithAnswer[] = [
      {
        id: 'q1',
        question_text: 'Question 1',
        hint: null,
        question_type: 'boolean',
        options: null,
        is_compulsory: true,
        rank: 1,
        score: 10,
        main_section_name: 'Section 1',
        section_name: null,
        sub_section_name: null,
        answer_id: 'a1',
        response_type: 'boolean',
        response_value: 'yes',
        response_files: null,
      },
      {
        id: 'q2',
        question_text: 'Question 2',
        hint: null,
        question_type: 'text',
        options: null,
        is_compulsory: true,
        rank: 2,
        score: 10,
        main_section_name: 'Section 1',
        section_name: null,
        sub_section_name: null,
        answer_id: 'a2',
        response_type: 'text',
        response_value: 'Some response',
        response_files: null,
      },
      {
        id: 'q3',
        question_text: 'Question 3',
        hint: null,
        question_type: 'boolean',
        options: null,
        is_compulsory: false,
        rank: 3,
        score: 10,
        main_section_name: 'Section 1',
        section_name: null,
        sub_section_name: null,
        answer_id: null,
        response_type: null,
        response_value: null,
        response_files: null,
      },
    ];

    it('should calculate score based on answered questions', async () => {
      scoreCalculationService.buildScoreInputsFromAnswers.mockReturnValue([
        { earnedScore: 10, maxScore: 10 },
        { earnedScore: 10, maxScore: 10 },
        { earnedScore: 0, maxScore: 10 },
      ]);
      scoreCalculationService.calculateCertificateScore.mockReturnValue({
        earnedScore: 20,
        maxScore: 30,
        finalPercentage: 67,
      });
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      assessmentRepo.getQuestionsWithAnswers.mockResolvedValue(
        mockQuestionsWithAnswers,
      );
      assessmentRepo.getBadgeForScore.mockResolvedValue({
        id: 'badge-1',
        name: 'Rated',
      });
      aiReviewRepo.findAiReviewByAssessmentId.mockResolvedValue({
        id: 'review-1',
        certificate_assessment_id: mockAssessmentId,
      } as any);
      aiReviewRepo.updateScoreSummary.mockResolvedValue({} as any);
      assessmentRepo.updateAssessmentBadge.mockResolvedValue({} as any);

      const result = await service.calculateAndUpdateScore(mockAssessmentId);

      expect(result.score).toBe(67);
      expect(aiReviewRepo.updateScoreSummary).toHaveBeenCalled();
      expect(assessmentRepo.updateAssessmentBadge).toHaveBeenCalled();
    });

    it('should throw NotFoundException if assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.calculateAndUpdateScore(mockAssessmentId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
