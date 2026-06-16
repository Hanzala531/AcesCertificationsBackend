import { Test, TestingModule } from '@nestjs/testing';
import { ReviewerService } from '../reviewer.service';
import { ReviewerRepository } from '../reviewer.repository';
import { AssessmentRepository } from '../../assessment/assessment.repository';
import { ChatService } from '../../chat/chat.service';
import { AiReviewRepository } from '../../ai-review/ai-review.repository';
import { AiReviewAnalysisService } from '../../ai-review/services/ai-review-analysis.service';
import { AiReviewService } from '../../ai-review/services/ai-review.service';
import { AiReviewNotificationService } from '../../ai-review/services/ai-review-notification.service';
import { AuditRepository } from '../../audit/audit.repository';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReviewerAssessmentStatus } from '../dto/certificate-assessments-query.dto';
import { ScoreCalculationService } from '../../certificate/services/score-calculation.service';

describe('ReviewerService', () => {
  let service: ReviewerService;
  let reviewerRepo: jest.Mocked<ReviewerRepository>;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;
  let aiReviewRepo: jest.Mocked<AiReviewRepository>;
  let aiReviewAnalysisService: jest.Mocked<AiReviewAnalysisService>;
  let aiReviewService: jest.Mocked<AiReviewService>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockReviewerId = '550e8400-e29b-41d4-a716-446655440001';

  const mockReviewer = {
    id: mockReviewerId,
    user_id: mockUserId,
    first_name: 'John',
    last_name: 'Doe',
    profile_picture: 'https://example.com/avatar.jpg',
    tags: ['quality', 'compliance'],
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockReviewerRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      removeTags: jest.fn(),
      addTags: jest.fn(),
      delete: jest.fn(),
      addAssignedAssessment: jest.fn(),
      removeAssignedAssessment: jest.fn(),
      findCertificateAssessments: jest.fn(),
      findReviewerAudits: jest.fn(),
    };

    const mockAssessmentRepository = {
      findAssessmentById: jest.fn(),
      assignReviewer: jest.fn(),
      findAssessmentsByReviewer: jest.fn(),
      updateAssessmentScore: jest.fn(),
      updateAssessmentBadge: jest.fn(),
      updateAssessmentStatus: jest.fn(),
      getBadgeForScore: jest.fn(),
    };

    const mockChatService = {
      addParticipantToAssessmentThread: jest.fn(),
    };

    const mockAiReviewRepository = {
      updateReviewerAssignedStatus: jest.fn(),
      findReviewerAssignedFlags: jest.fn(),
      findReviewerFlagDetails: jest.fn(),
      findFlaggedResponses: jest.fn(),
      findAiResponseByIdAndReviewId: jest.fn(),
      reviewFlaggedResponse: jest.fn(),
      areAllFlaggedResponsesReviewed: jest.fn(),
      submitReviewerReview: jest.fn(),
      getReviewerAcceptedResponseIds: jest.fn(),
      updateScore: jest.fn(),
      updateFlagStatus: jest.fn(),
      updateAiReviewStatus: jest.fn(),
    };

    const mockAuditRepository = {
      setAssignedReviewer: jest.fn().mockResolvedValue(undefined),
    };

    const mockAiReviewAnalysisService = {
      reReviewAfterReviewer: jest.fn().mockResolvedValue(undefined),
    };

    const mockAiReviewService = {
      triggerAiReview: jest.fn().mockResolvedValue({ id: 'new-review-id', review_status: 'completed' }),
    };

    const mockScoreCalculationService = {
      assignBadge: jest.fn().mockResolvedValue({
        badgeId: 'badge-gold',
        badgeName: 'ACES Rated',
      }),
    };

    const mockAiReviewNotificationService = {
      getOrganizationUsers: jest.fn().mockResolvedValue([]),
      allocateOrganizationBadge: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewerService,
        { provide: ReviewerRepository, useValue: mockReviewerRepository },
        { provide: AssessmentRepository, useValue: mockAssessmentRepository },
        { provide: ChatService, useValue: mockChatService },
        { provide: AiReviewRepository, useValue: mockAiReviewRepository },
        { provide: AuditRepository, useValue: mockAuditRepository },
        { provide: ScoreCalculationService, useValue: mockScoreCalculationService },
        { provide: AiReviewAnalysisService, useValue: mockAiReviewAnalysisService },
        { provide: AiReviewService, useValue: mockAiReviewService },
        {
          provide: AiReviewNotificationService,
          useValue: mockAiReviewNotificationService,
        },
      ],
    }).compile();

    service = module.get<ReviewerService>(ReviewerService);
    reviewerRepo = module.get(ReviewerRepository);
    assessmentRepo = module.get(AssessmentRepository);
    aiReviewRepo = module.get(AiReviewRepository);
    aiReviewAnalysisService = module.get(AiReviewAnalysisService);
    aiReviewService = module.get(AiReviewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create reviewer successfully with all fields', async () => {
      reviewerRepo.create.mockResolvedValue(mockReviewer);

      const result = await service.create(
        mockUserId,
        'John',
        'Doe',
        'https://example.com/avatar.jpg',
        ['quality', 'compliance'],
        true,
      );

      expect(result).toEqual(mockReviewer);
      expect(reviewerRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'John',
        'Doe',
        'https://example.com/avatar.jpg',
        ['quality', 'compliance'],
        true,
      );
    });

    it('should create reviewer with minimal required fields', async () => {
      const minimalReviewer = {
        ...mockReviewer,
        profile_picture: null,
        tags: [],
        status: 'active',
      };
      reviewerRepo.create.mockResolvedValue(minimalReviewer);

      const result = await service.create(mockUserId, 'Jane', 'Smith');

      expect(result).toEqual(minimalReviewer);
      expect(reviewerRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'Jane',
        'Smith',
        undefined,
        [],
        undefined,
      );
    });

    it('should create reviewer with custom status', async () => {
      const customReviewer = { ...mockReviewer, status: 'inactive' };
      reviewerRepo.create.mockResolvedValue(customReviewer);

      const result = await service.create(
        mockUserId,
        'Bob',
        'Johnson',
        undefined,
        undefined,
        false,
      );

      expect(result).toEqual(customReviewer);
      expect(reviewerRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'Bob',
        'Johnson',
        undefined,
        [],
        false,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.create('', 'John', 'Doe')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty first name', async () => {
      await expect(service.create(mockUserId, '', 'Doe')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty last name', async () => {
      await expect(service.create(mockUserId, 'John', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should find reviewer by user ID', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);

      const result = await service.findByUserId(mockUserId);

      expect(result).toEqual(mockReviewer);
      expect(reviewerRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('should return null when reviewer not found by user ID', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent-user-id');

      expect(result).toBeNull();
      expect(reviewerRepo.findByUserId).toHaveBeenCalledWith(
        'nonexistent-user-id',
      );
    });
  });

  describe('findById', () => {
    it('should find reviewer by ID', async () => {
      reviewerRepo.findById.mockResolvedValue(mockReviewer);

      const result = await service.findById(mockReviewerId);

      expect(result).toEqual(mockReviewer);
      expect(reviewerRepo.findById).toHaveBeenCalledWith(mockReviewerId);
    });

    it('should throw NotFoundException when reviewer not found by ID', async () => {
      reviewerRepo.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent-reviewer-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    const mockReviewers = [mockReviewer];

    it('should return all reviewers', async () => {
      reviewerRepo.findAll.mockResolvedValue({
        reviewers: mockReviewers,
        total: 1,
      });

      const result = await service.findAll();

      expect(result).toEqual({ reviewers: mockReviewers, total: 1 });
      expect(reviewerRepo.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no reviewers exist', async () => {
      reviewerRepo.findAll.mockResolvedValue({ reviewers: [], total: 0 });

      const result = await service.findAll();

      expect(result).toEqual({ reviewers: [], total: 0 });
    });
  });

  describe('update', () => {
    it('should update reviewer successfully', async () => {
      const updateFields = {
        first_name: 'Updated John',
        last_name: 'Updated Doe',
        status: 'inactive',
      };
      const updatedReviewer = { ...mockReviewer, ...updateFields };
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.update.mockResolvedValue(updatedReviewer);

      const result = await service.update(mockReviewerId, updateFields);

      expect(result).toEqual(updatedReviewer);
      expect(reviewerRepo.findById).toHaveBeenCalledWith(mockReviewerId);
      expect(reviewerRepo.update).toHaveBeenCalledWith(
        mockReviewerId,
        updateFields,
      );
    });

    it('should update single field', async () => {
      const updateFields = { first_name: 'New Name' };
      const updatedReviewer = { ...mockReviewer, first_name: 'New Name' };
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.update.mockResolvedValue(updatedReviewer);

      const result = await service.update(mockReviewerId, updateFields);

      expect(result?.first_name).toBe('New Name');
      expect(reviewerRepo.update).toHaveBeenCalledWith(
        mockReviewerId,
        updateFields,
      );
    });

    it('should update tags field', async () => {
      const updateFields = { tags: ['new-tag', 'another-tag'] };
      const updatedReviewer = {
        ...mockReviewer,
        tags: ['new-tag', 'another-tag'],
      };
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.update.mockResolvedValue(updatedReviewer);

      const result = await service.update(mockReviewerId, updateFields);

      expect(result?.tags).toEqual(['new-tag', 'another-tag']);
    });

    it('should update profile picture', async () => {
      const updateFields = { profile_picture: 'https://new-avatar.jpg' };
      const updatedReviewer = {
        ...mockReviewer,
        profile_picture: 'https://new-avatar.jpg',
      };
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.update.mockResolvedValue(updatedReviewer);

      const result = await service.update(mockReviewerId, updateFields);

      expect(result?.profile_picture).toBe('https://new-avatar.jpg');
    });

    it('should return original reviewer when no valid fields provided', async () => {
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.update.mockResolvedValue(mockReviewer);

      const result = await service.update(mockReviewerId, {
        invalid_field: 'value',
      } as any);

      expect(result).toEqual(mockReviewer);
    });

    it('should throw NotFoundException when reviewer to update not found', async () => {
      reviewerRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-reviewer', { first_name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty update object', async () => {
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.update.mockResolvedValue(mockReviewer);

      const result = await service.update(mockReviewerId, {});

      expect(result).toEqual(mockReviewer);
    });
  });

  describe('removeTags', () => {
    it('should remove tags successfully', async () => {
      const updatedReviewer = { ...mockReviewer, tags: ['remaining-tag'] };
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.removeTags.mockResolvedValue(updatedReviewer);

      const result = await service.removeTags(mockReviewerId, [
        'quality',
        'compliance',
      ]);

      expect(result?.tags).toEqual(['remaining-tag']);
      expect(reviewerRepo.findById).toHaveBeenCalledWith(mockReviewerId);
      expect(reviewerRepo.removeTags).toHaveBeenCalledWith(mockReviewerId, [
        'quality',
        'compliance',
      ]);
    });

    it('should handle removing all tags', async () => {
      const updatedReviewer = { ...mockReviewer, tags: [] };
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.removeTags.mockResolvedValue(updatedReviewer);

      const result = await service.removeTags(mockReviewerId, [
        'quality',
        'compliance',
      ]);

      expect(result?.tags).toEqual([]);
    });

    it('should handle removing non-existent tags', async () => {
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.removeTags.mockResolvedValue(mockReviewer);

      const result = await service.removeTags(mockReviewerId, [
        'non-existent-tag',
      ]);

      expect(result?.tags).toEqual(['quality', 'compliance']);
    });

    it('should throw NotFoundException when reviewer not found for tag removal', async () => {
      reviewerRepo.findById.mockResolvedValue(null);

      await expect(
        service.removeTags('nonexistent-reviewer', ['tag']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty tags array', async () => {
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.removeTags.mockResolvedValue(mockReviewer);

      const result = await service.removeTags(mockReviewerId, []);

      expect(result?.tags).toEqual(['quality', 'compliance']);
    });
  });

  describe('delete', () => {
    it('should delete reviewer successfully', async () => {
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.delete.mockResolvedValue(true);

      const result = await service.delete(mockReviewerId);

      expect(result).toBe(true);
      expect(reviewerRepo.findById).toHaveBeenCalledWith(mockReviewerId);
      expect(reviewerRepo.delete).toHaveBeenCalledWith(mockReviewerId);
    });

    it('should throw NotFoundException when reviewer to delete not found', async () => {
      reviewerRepo.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent-reviewer')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignToAssessment', () => {
    const mockAssessmentId = '550e8400-e29b-41d4-a716-446655440002';
    const mockAssessment = {
      id: mockAssessmentId,
      reviewer_id: null,
      assigned_reviewer_id: null,
      certificate_id: 'cert-123',
      created_at: new Date(),
      updated_at: new Date(),
    } as any;

    it('should assign reviewer to assessment successfully', async () => {
      const updatedAssessment = { ...mockAssessment, reviewer_id: mockUserId };
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      assessmentRepo.assignReviewer.mockResolvedValue(updatedAssessment);

      const result = await service.assignToAssessment(
        mockAssessmentId,
        mockReviewerId,
        undefined,
      );

      expect(result).toEqual({
        assessmentId: mockAssessmentId,
        reviewerId: mockReviewerId,
        reviewerName: 'John Doe',
      });
      expect(assessmentRepo.findAssessmentById).toHaveBeenCalledWith(
        mockAssessmentId,
      );
      expect(reviewerRepo.findById).toHaveBeenCalledWith(mockReviewerId);
      expect(assessmentRepo.assignReviewer).toHaveBeenCalledWith(
        mockAssessmentId,
        mockUserId,
        undefined,
      );
      expect(aiReviewRepo.updateReviewerAssignedStatus).toHaveBeenCalledWith(
        mockAssessmentId,
        true,
      );
    });

    it('should assign null reviewer to assessment', async () => {
      const updatedAssessment = { ...mockAssessment, reviewer_id: null };
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      assessmentRepo.assignReviewer.mockResolvedValue(updatedAssessment);

      const result = await service.assignToAssessment(
        mockAssessmentId,
        null,
        undefined,
      );

      expect(result).toEqual({
        assessmentId: mockAssessmentId,
        reviewerId: null,
        reviewerName: null,
      });
      expect(assessmentRepo.assignReviewer).toHaveBeenCalledWith(
        mockAssessmentId,
        null,
        undefined,
      );
      expect(aiReviewRepo.updateReviewerAssignedStatus).toHaveBeenCalledWith(
        mockAssessmentId,
        false,
      );
    });

    it('should throw NotFoundException when assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.assignToAssessment(mockAssessmentId, mockReviewerId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when reviewer not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      reviewerRepo.findById.mockResolvedValue(null);

      await expect(
        service.assignToAssessment(mockAssessmentId, mockReviewerId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAssignedAssessments', () => {
    const mockAssessments = {
      data: [
        {
          id: 'assessment-1',
          organization_id: 'org-1',
          certificate_name: 'Business Assessment',
        } as any,
      ],
      total: 1,
      page: 1,
      limit: 10,
    };

    it('should return assigned assessments for reviewer', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      assessmentRepo.findAssessmentsByReviewer.mockResolvedValue(
        mockAssessments,
      );

      const result = await service.getAssignedAssessments(mockUserId, 1, 10);

      expect(result).toEqual(mockAssessments);
      expect(reviewerRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(assessmentRepo.findAssessmentsByReviewer).toHaveBeenCalledWith(
        mockUserId,
        { page: 1, limit: 10, status: undefined, assignedByRole: undefined },
      );
    });

    it('should throw NotFoundException when reviewer is not found', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.getAssignedAssessments(mockUserId, 1, 10),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCertificateAssessments', () => {
    const makeRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'assessment-1',
      organization_id: 'org-1',
      organization_name: 'TechCorp',
      branch_id: null,
      branch_name: null,
      certificate_id: 'cert-1',
      certificate_name: 'ISO 9001',
      product_id: 'CERT-001',
      total_ai_flags: 0,
      is_certificate_blocked: false,
      has_issued_certificate: false,
      issued_cert_blocked: false,
      audit_lifecycle_status: null,
      assigned_auditor_id: null,
      assigned_date: '2026-02-01T10:00:00.000Z',
      ...overrides,
    });

    it('should return paginated certificate assessments', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      reviewerRepo.findCertificateAssessments.mockResolvedValue({
        rows: [makeRow()],
        total: 1,
      });

      const result = await service.getCertificateAssessments(mockUserId, 1, 10);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(reviewerRepo.findCertificateAssessments).toHaveBeenCalledWith(
        mockUserId,
        1,
        10,
        undefined,
      );
    });

    it('should pass pagination parameters correctly', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      reviewerRepo.findCertificateAssessments.mockResolvedValue({
        rows: [],
        total: 50,
      });

      const result = await service.getCertificateAssessments(mockUserId, 3, 20);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
      expect(reviewerRepo.findCertificateAssessments).toHaveBeenCalledWith(
        mockUserId,
        3,
        20,
        undefined,
      );
    });

    it('should pass assessmentType filter to repository', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      reviewerRepo.findCertificateAssessments.mockResolvedValue({
        rows: [makeRow()],
        total: 1,
      });

      await service.getCertificateAssessments(mockUserId, 1, 10, 'assured');

      expect(reviewerRepo.findCertificateAssessments).toHaveBeenCalledWith(
        mockUserId,
        1,
        10,
        'assured',
      );
    });

    it('should throw NotFoundException when reviewer not found', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.getCertificateAssessments(mockUserId, 1, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should map nullable branch and product fields correctly', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      reviewerRepo.findCertificateAssessments.mockResolvedValue({
        rows: [
          makeRow({ branch_id: 'branch-1', branch_name: 'Head Office', product_id: 'CERT-001' }),
          makeRow({ branch_id: null, branch_name: null, product_id: null }),
        ],
        total: 2,
      });

      const result = await service.getCertificateAssessments(mockUserId, 1, 10);

      expect(result.items[0].branchId).toBe('branch-1');
      expect(result.items[0].branchName).toBe('Head Office');
      expect(result.items[0].productId).toBe('CERT-001');
      expect(result.items[1].branchId).toBeNull();
      expect(result.items[1].branchName).toBeNull();
      expect(result.items[1].productId).toBeNull();
    });

    it('should map totalAiFlags from row data', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      reviewerRepo.findCertificateAssessments.mockResolvedValue({
        rows: [makeRow({ total_ai_flags: 5 })],
        total: 1,
      });

      const result = await service.getCertificateAssessments(mockUserId, 1, 10);

      expect(result.items[0].totalAiFlags).toBe(5);
    });
  });

  describe('getReviewerAudits', () => {
    const mockAuditItems = [
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
    ];

    const mockAuditsResult = {
      items: mockAuditItems,
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    it('should return paginated reviewer audits', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      reviewerRepo.findReviewerAudits.mockResolvedValue(mockAuditsResult);

      const result = await service.getReviewerAudits(mockUserId);

      expect(result).toEqual(mockAuditsResult);
      expect(reviewerRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(reviewerRepo.findReviewerAudits).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        1,
        10,
      );
    });

    it('should pass lifecycleStatus filter to repository', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      reviewerRepo.findReviewerAudits.mockResolvedValue({
        ...mockAuditsResult,
        items: [],
        total: 0,
      });

      await service.getReviewerAudits(mockUserId, 'submitted', 1, 10);

      expect(reviewerRepo.findReviewerAudits).toHaveBeenCalledWith(
        mockUserId,
        'submitted',
        1,
        10,
      );
    });

    it('should pass custom pagination parameters', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      reviewerRepo.findReviewerAudits.mockResolvedValue({
        items: [],
        total: 50,
        page: 3,
        limit: 20,
        totalPages: 3,
      });

      const result = await service.getReviewerAudits(mockUserId, undefined, 3, 20);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
      expect(reviewerRepo.findReviewerAudits).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        3,
        20,
      );
    });

    it('should throw NotFoundException when reviewer not found', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.getReviewerAudits(mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deriveAssessmentStatus', () => {
    const baseRow = {
      is_certificate_blocked: false,
      has_issued_certificate: false,
      issued_cert_blocked: false,
      audit_lifecycle_status: null as string | null,
      assigned_auditor_id: null as string | null,
      total_ai_flags: 0,
    };

    it('should return blocked when assessment is certificate-blocked', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        is_certificate_blocked: true,
      });
      expect(result).toBe(ReviewerAssessmentStatus.BLOCKED);
    });

    it('should return blocked when issued certificate is blocked', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        has_issued_certificate: true,
        issued_cert_blocked: true,
      });
      expect(result).toBe(ReviewerAssessmentStatus.BLOCKED);
    });

    it('should return approved when issued certificate exists and is not blocked', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        has_issued_certificate: true,
      });
      expect(result).toBe(ReviewerAssessmentStatus.APPROVED);
    });

    it('should return audit_completed when audit lifecycle is reviewer_submitted', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        audit_lifecycle_status: 'reviewer_submitted',
      });
      expect(result).toBe(ReviewerAssessmentStatus.AUDIT_COMPLETED);
    });

    it('should return audit_completed when audit lifecycle is completed', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        audit_lifecycle_status: 'completed',
      });
      expect(result).toBe(ReviewerAssessmentStatus.AUDIT_COMPLETED);
    });

    it('should return assigned_to_auditor when auditor is assigned', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        assigned_auditor_id: 'auditor-user-1',
      });
      expect(result).toBe(ReviewerAssessmentStatus.ASSIGNED_TO_AUDITOR);
    });

    it('should return ai_flagged when AI flags are present', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        total_ai_flags: 3,
      });
      expect(result).toBe(ReviewerAssessmentStatus.AI_FLAGGED);
    });

    it('should return under_reviewer as default', () => {
      const result = service.deriveAssessmentStatus(baseRow);
      expect(result).toBe(ReviewerAssessmentStatus.UNDER_REVIEWER);
    });

    // Precedence tests
    it('should prioritize blocked over approved', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        is_certificate_blocked: true,
        has_issued_certificate: true,
      });
      expect(result).toBe(ReviewerAssessmentStatus.BLOCKED);
    });

    it('should prioritize approved over audit_completed', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        has_issued_certificate: true,
        audit_lifecycle_status: 'reviewer_submitted',
      });
      expect(result).toBe(ReviewerAssessmentStatus.APPROVED);
    });

    it('should prioritize audit_completed over assigned_to_auditor', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        audit_lifecycle_status: 'reviewer_submitted',
        assigned_auditor_id: 'auditor-1',
      });
      expect(result).toBe(ReviewerAssessmentStatus.AUDIT_COMPLETED);
    });

    it('should prioritize assigned_to_auditor over ai_flagged', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        assigned_auditor_id: 'auditor-1',
        total_ai_flags: 5,
      });
      expect(result).toBe(ReviewerAssessmentStatus.ASSIGNED_TO_AUDITOR);
    });

    it('should prioritize ai_flagged over under_reviewer', () => {
      const result = service.deriveAssessmentStatus({
        ...baseRow,
        total_ai_flags: 1,
      });
      expect(result).toBe(ReviewerAssessmentStatus.AI_FLAGGED);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete reviewer lifecycle', async () => {
      // Create
      reviewerRepo.create.mockResolvedValue(mockReviewer);
      const created = await service.create(
        mockUserId,
        'John',
        'Doe',
        'avatar.jpg',
        ['quality'],
        true,
      );
      expect(created).toEqual(mockReviewer);

      // Find by ID
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      const found = await service.findById(mockReviewerId);
      expect(found).toEqual(mockReviewer);

      // Find by user ID
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      const findByUser = await service.findByUserId(mockUserId);
      expect(findByUser).toEqual(mockReviewer);

      // Find all
      reviewerRepo.findAll.mockResolvedValue({
        reviewers: [mockReviewer],
        total: 1,
      });
      const all = await service.findAll();
      expect(all.reviewers).toHaveLength(1);

      // Update
      const updateFields = { first_name: 'Updated John' };
      const updatedReviewer = { ...mockReviewer, first_name: 'Updated John' };
      reviewerRepo.findById.mockResolvedValue(mockReviewer);
      reviewerRepo.update.mockResolvedValue(updatedReviewer);
      const updated = await service.update(mockReviewerId, updateFields);
      expect(updated?.first_name).toBe('Updated John');

      // Remove tags
      const reviewerWithoutTags = { ...updatedReviewer, tags: [] };
      reviewerRepo.findById.mockResolvedValue(updatedReviewer);
      reviewerRepo.removeTags.mockResolvedValue(reviewerWithoutTags);
      const withoutTags = await service.removeTags(mockReviewerId, ['quality']);
      expect(withoutTags?.tags).toEqual([]);

      // Delete
      reviewerRepo.findById.mockResolvedValue(reviewerWithoutTags);
      reviewerRepo.delete.mockResolvedValue(true);
      const deleted = await service.delete(mockReviewerId);
      expect(deleted).toBe(true);

      // Verify all repository methods were called appropriately
      expect(reviewerRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'John',
        'Doe',
        'avatar.jpg',
        ['quality'],
        true,
      );
      expect(reviewerRepo.findById).toHaveBeenCalledTimes(4);
      expect(reviewerRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(reviewerRepo.findAll).toHaveBeenCalled();
      expect(reviewerRepo.update).toHaveBeenCalled();
      expect(reviewerRepo.removeTags).toHaveBeenCalled();
      expect(reviewerRepo.delete).toHaveBeenCalled();
    });

    it('should handle multiple reviewers operations', async () => {
      const reviewer1 = {
        ...mockReviewer,
        id: 'rev-1',
        user_id: 'user-1',
        first_name: 'Alice',
      };
      const reviewer2 = {
        ...mockReviewer,
        id: 'rev-2',
        user_id: 'user-2',
        first_name: 'Bob',
      };
      const allReviewers = [reviewer1, reviewer2];

      // Create multiple reviewers
      reviewerRepo.create
        .mockResolvedValueOnce(reviewer1)
        .mockResolvedValueOnce(reviewer2);

      const created1 = await service.create('user-1', 'Alice', 'Smith');
      const created2 = await service.create('user-2', 'Bob', 'Johnson');

      expect(created1.first_name).toBe('Alice');
      expect(created2.first_name).toBe('Bob');

      // Find all reviewers
      reviewerRepo.findAll.mockResolvedValue({
        reviewers: allReviewers,
        total: 2,
      });
      const foundAll = await service.findAll();
      expect(foundAll.reviewers).toHaveLength(2);

      // Find specific reviewers
      reviewerRepo.findById
        .mockResolvedValueOnce(reviewer1)
        .mockResolvedValueOnce(reviewer2);

      const found1 = await service.findById('rev-1');
      const found2 = await service.findById('rev-2');

      expect(found1.first_name).toBe('Alice');
      expect(found2.first_name).toBe('Bob');
    });

    it('should handle validation errors gracefully', async () => {
      await expect(service.create('', 'John', 'Doe')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockUserId, '', 'Doe')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockUserId, 'John', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('nonexistent', {})).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.removeTags('nonexistent', [])).rejects.toThrow(
        NotFoundException,
      );

      expect(reviewerRepo.create).not.toHaveBeenCalled();
      expect(reviewerRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ── Reviewer AI Flag Review Tests ──

  const mockReviewId = '550e8400-e29b-41d4-a716-446655440010';
  const mockResponseId = '550e8400-e29b-41d4-a716-446655440011';
  const mockAssessmentId = '550e8400-e29b-41d4-a716-446655440012';

  const mockAiReview = {
    id: mockReviewId,
    certificate_assessment_id: mockAssessmentId,
    review_description: null,
    review_status: 'completed' as const,
    total_flags: 2,
    score: 65,
    flag_status: 'open' as const,
    started_at: new Date(),
    completed_at: new Date(),
    is_reviewer_assigned: true,
    reviewer_submitted_at: null,
    reviewer_submitted_by: null,
    reviewer_adjusted_score: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockFlagDetails = {
    review: mockAiReview,
    assessment_id: mockAssessmentId,
    certificate_id: 'cert-1',
    certificate_name: 'ISO 9001',
    organization_name: 'TechCorp',
    branch_name: 'HQ',
    product_id: 'CERT-001',
    assigned_auditor_id: 'auditor-1',
    auditor_name: 'Jane Auditor',
    auditor_email: 'jane@example.com',
    total_questions: 10,
    total_attempted: 8,
  };

  const mockFlaggedResponse = {
    id: mockResponseId,
    assessment_query_id: 'query-1',
    ai_review_id: mockReviewId,
    response: 'Flagged analysis',
    is_flagged: true,
    flag_reason: 'Insufficient detail',
    confidence_score: 40,
    risk_level: 'medium' as const,
    category: 'Compliance',
    summary: 'Needs more info',
    applicant_answer: 'We do some things',
    is_question_approved: false,
    reviewer_action: null,
    reviewer_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date(),
    question_text: 'Describe your process',
    question_type: 'text',
    response_type: 'text',
    response_value: 'We do some things',
  };

  describe('getAssignedAiFlags', () => {
    it('should return paginated list of assigned flagged assessments', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      aiReviewRepo.findReviewerAssignedFlags.mockResolvedValue({
        flags: [
          {
            review_id: mockReviewId,
            assessment_id: mockAssessmentId,
            certificate_id: 'cert-1',
            certificate_name: 'ISO 9001',
            organization_name: 'TechCorp',
            branch_name: 'HQ',
            product_id: 'CERT-001',
            assessment_type: 'self_disclosure',
            ai_score: 65,
            total_flags: 2,
            flag_status: 'open',
            assigned_auditor_id: 'auditor-1',
            auditor_name: 'Jane Auditor',
            auditor_email: 'jane@example.com',
            reviewer_submitted_at: null,
            total_questions: 10,
            total_attempted: 8,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        total: 1,
      });

      const result = await service.getAssignedAiFlags(mockUserId, {
        page: 1,
        limit: 25,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].reviewId).toBe(mockReviewId);
      expect(result.items[0].auditor).toEqual({
        id: 'auditor-1',
        name: 'Jane Auditor',
        email: 'jane@example.com',
      });
      expect(result.totalPages).toBe(1);
    });

    it('should throw NotFoundException if reviewer not found', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.getAssignedAiFlags(mockUserId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should pass status filter to repository', async () => {
      reviewerRepo.findByUserId.mockResolvedValue(mockReviewer);
      aiReviewRepo.findReviewerAssignedFlags.mockResolvedValue({
        flags: [],
        total: 0,
      });

      await service.getAssignedAiFlags(mockUserId, { status: 'open' });

      expect(aiReviewRepo.findReviewerAssignedFlags).toHaveBeenCalledWith(
        mockUserId,
        { status: 'open', limit: 25, offset: 0 },
      );
    });
  });

  describe('getAiFlagDetails', () => {
    it('should return review details with flagged responses', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.findFlaggedResponses.mockResolvedValue([
        mockFlaggedResponse,
      ]);

      const result = await service.getAiFlagDetails(mockUserId, mockReviewId);

      expect(result.review.reviewId).toBe(mockReviewId);
      expect(result.review.certificateName).toBe('ISO 9001');
      expect(result.review.auditor).toEqual({
        id: 'auditor-1',
        name: 'Jane Auditor',
        email: 'jane@example.com',
      });
      expect(result.flaggedResponses).toHaveLength(1);
      expect(result.flaggedResponses[0].is_flagged).toBe(true);
    });

    it('should throw NotFoundException if review not assigned to reviewer', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(null);

      await expect(
        service.getAiFlagDetails(mockUserId, mockReviewId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reviewFlag', () => {
    it('should accept a flagged response', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.findAiResponseByIdAndReviewId.mockResolvedValue(
        mockFlaggedResponse,
      );
      aiReviewRepo.reviewFlaggedResponse.mockResolvedValue({
        ...mockFlaggedResponse,
        reviewer_action: 'accepted',
        reviewed_by: mockUserId,
      });
      aiReviewRepo.areAllFlaggedResponsesReviewed.mockResolvedValue(false);

      const result = await service.reviewFlag(
        mockUserId,
        mockReviewId,
        mockResponseId,
        'accepted',
        'Answer is correct, AI was wrong',
      );

      expect(result.reviewClosed).toBe(false);
      expect(aiReviewRepo.reviewFlaggedResponse).toHaveBeenCalledWith(
        mockResponseId,
        mockUserId,
        'accepted',
        'Answer is correct, AI was wrong',
      );
    });

    it('should reject a flagged response', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.findAiResponseByIdAndReviewId.mockResolvedValue(
        mockFlaggedResponse,
      );
      aiReviewRepo.reviewFlaggedResponse.mockResolvedValue({
        ...mockFlaggedResponse,
        reviewer_action: 'rejected',
      });
      aiReviewRepo.areAllFlaggedResponsesReviewed.mockResolvedValue(false);

      const result = await service.reviewFlag(
        mockUserId,
        mockReviewId,
        mockResponseId,
        'rejected',
        'AI is right, answer is incomplete',
      );

      expect(result.reviewClosed).toBe(false);
    });

    it('should return reviewClosed=true when all flags are reviewed', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.findAiResponseByIdAndReviewId.mockResolvedValue(
        mockFlaggedResponse,
      );
      aiReviewRepo.reviewFlaggedResponse.mockResolvedValue({
        ...mockFlaggedResponse,
        reviewer_action: 'accepted',
      });
      aiReviewRepo.areAllFlaggedResponsesReviewed.mockResolvedValue(true);

      const result = await service.reviewFlag(
        mockUserId,
        mockReviewId,
        mockResponseId,
        'accepted',
      );

      expect(result.reviewClosed).toBe(true);
    });

    it('should throw ForbiddenException if review not assigned to reviewer', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(null);

      await expect(
        service.reviewFlag(mockUserId, mockReviewId, mockResponseId, 'accepted'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if review already submitted', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue({
        ...mockFlagDetails,
        review: { ...mockAiReview, reviewer_submitted_at: new Date() },
      });

      await expect(
        service.reviewFlag(mockUserId, mockReviewId, mockResponseId, 'accepted'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if response not found', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.findAiResponseByIdAndReviewId.mockResolvedValue(null);

      await expect(
        service.reviewFlag(mockUserId, mockReviewId, mockResponseId, 'accepted'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if response is not flagged', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.findAiResponseByIdAndReviewId.mockResolvedValue({
        ...mockFlaggedResponse,
        is_flagged: false,
      });

      await expect(
        service.reviewFlag(mockUserId, mockReviewId, mockResponseId, 'accepted'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitReviewerReview', () => {
    it('should submit review and trigger full AI re-review', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.areAllFlaggedResponsesReviewed.mockResolvedValue(true);
      aiReviewRepo.submitReviewerReview.mockResolvedValue({
        ...mockAiReview,
        reviewer_submitted_at: new Date(),
        reviewer_submitted_by: mockUserId,
      });
      aiReviewService.triggerAiReview.mockResolvedValue({
        id: 'new-review-id',
        review_status: 'completed',
      } as any);

      const result = await service.submitReviewerReview(
        mockUserId,
        mockReviewId,
      );

      expect(result.message).toBe(
        'Review submitted and AI re-review triggered',
      );
      expect(aiReviewRepo.submitReviewerReview).toHaveBeenCalledWith(
        mockReviewId,
        mockUserId,
        undefined,
      );
      expect(aiReviewService.triggerAiReview).toHaveBeenCalledWith(
        mockAssessmentId,
      );
    });

    it('should submit with adjusted score — skip AI re-review and re-allocate badge', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.areAllFlaggedResponsesReviewed.mockResolvedValue(true);
      aiReviewRepo.submitReviewerReview.mockResolvedValue({
        ...mockAiReview,
        reviewer_submitted_at: new Date(),
        reviewer_adjusted_score: 80,
      });
      assessmentRepo.findAssessmentById.mockResolvedValue({
        id: mockAssessmentId,
        certificate_id: 'cert-123',
        organization_id: 'org-123',
        assessment_type: 'self_disclosure',
      } as any);
      assessmentRepo.getBadgeForScore.mockResolvedValue({
        id: 'badge-gold',
        name: 'ACES Rated',
      });

      const result = await service.submitReviewerReview(
        mockUserId,
        mockReviewId,
        80,
      );

      expect(result.message).toBe(
        'Review submitted with adjusted score. Badge re-allocated.',
      );
      // Should NOT trigger AI re-review
      expect(aiReviewService.triggerAiReview).not.toHaveBeenCalled();
      // Should update score and badge
      expect(aiReviewRepo.updateScore).toHaveBeenCalledWith(mockReviewId, 80);
      expect(assessmentRepo.updateAssessmentScore).toHaveBeenCalledWith(
        mockAssessmentId,
        80,
      );
      expect(assessmentRepo.updateAssessmentBadge).toHaveBeenCalledWith(
        mockAssessmentId,
        'badge-gold',
      );
      expect(aiReviewRepo.updateFlagStatus).toHaveBeenCalledWith(
        mockReviewId,
        'resolved',
      );
    });

    it('should throw ForbiddenException if not assigned', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(null);

      await expect(
        service.submitReviewerReview(mockUserId, mockReviewId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if already submitted and resolved', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue({
        ...mockFlagDetails,
        review: { ...mockAiReview, reviewer_submitted_at: new Date(), flag_status: 'resolved' },
      });

      await expect(
        service.submitReviewerReview(mockUserId, mockReviewId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow retry if submitted but not resolved', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue({
        ...mockFlagDetails,
        review: { ...mockAiReview, reviewer_submitted_at: new Date(), flag_status: 'open' },
      });
      aiReviewRepo.areAllFlaggedResponsesReviewed.mockResolvedValue(true);
      aiReviewRepo.submitReviewerReview.mockResolvedValue({
        ...mockAiReview,
        reviewer_submitted_at: new Date(),
      });
      aiReviewService.triggerAiReview.mockResolvedValue({
        id: 'new-review-id',
        review_status: 'completed',
      } as any);

      const result = await service.submitReviewerReview(
        mockUserId,
        mockReviewId,
      );

      expect(result.message).toBe(
        'Review submitted and AI re-review triggered',
      );
    });

    it('should throw BadRequestException if not all flags reviewed', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.areAllFlaggedResponsesReviewed.mockResolvedValue(false);

      await expect(
        service.submitReviewerReview(mockUserId, mockReviewId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if AI re-review fails', async () => {
      aiReviewRepo.findReviewerFlagDetails.mockResolvedValue(mockFlagDetails);
      aiReviewRepo.areAllFlaggedResponsesReviewed.mockResolvedValue(true);
      aiReviewRepo.submitReviewerReview.mockResolvedValue({
        ...mockAiReview,
        reviewer_submitted_at: new Date(),
      });
      aiReviewService.triggerAiReview.mockRejectedValue(
        new Error('AI provider down'),
      );

      await expect(
        service.submitReviewerReview(mockUserId, mockReviewId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
