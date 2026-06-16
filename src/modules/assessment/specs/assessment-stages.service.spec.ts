import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentService } from '../services/assessment.service';
import {
  AssessmentRepository,
  CertificateAssessment,
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
import { NotFoundException } from '@nestjs/common';

describe('AssessmentService - getAssessmentStages', () => {
  let service: AssessmentService;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;

  const mockAssessmentId = '550e8400-e29b-41d4-a716-446655440004';
  const mockOrgId = '550e8400-e29b-41d4-a716-446655440001';
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

  const baseSelfDisclosure: CertificateAssessment = {
    id: mockAssessmentId,
    organization_id: mockOrgId,
    branch_id: null,
    certificate_id: '550e8400-e29b-41d4-a716-446655440002',
    payment_id: '550e8400-e29b-41d4-a716-446655440003',
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

  const baseAssured: CertificateAssessment = {
    ...baseSelfDisclosure,
    assessment_type: 'assured',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        {
          provide: AssessmentRepository,
          useValue: {
            findAssessmentById: jest.fn(),
            getAuditRecordForAssessment: jest.fn(),
          },
        },
        { provide: PaymentService, useValue: {} },
        { provide: OrganizationRepository, useValue: {} },
        { provide: EmployeeRepository, useValue: {} },
        { provide: AiReviewService, useValue: {} },
        { provide: AiReviewRepository, useValue: {} },
        { provide: AssessmentNotificationService, useValue: {} },
        { provide: BadgeRepository, useValue: {} },
        { provide: ScoreCalculationService, useValue: {} },
        { provide: ChatService, useValue: {} },
      ],
    }).compile();

    service = module.get<AssessmentService>(AssessmentService);
    assessmentRepo = module.get(AssessmentRepository);
  });

  it('should throw NotFoundException if assessment not found', async () => {
    assessmentRepo.findAssessmentById.mockResolvedValue(null);
    await expect(
      service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Self-Disclosure Tests ───────────────────────────────────────

  describe('Self-Disclosure Assessment', () => {
    it('should return 3 stages', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseSelfDisclosure);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);
      expect(result.stages).toHaveLength(3);
      expect(result.assessmentType).toBe('self_disclosure');
    });

    it('stage 1 current, stages 2-3 upcoming when in_progress', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseSelfDisclosure,
        status: 'in_progress',
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('current');
      expect(result.stages[1].status).toBe('upcoming');
      expect(result.stages[2].status).toBe('upcoming');
      expect(result.currentStep).toBe(1);
    });

    it('stage 1 completed, stage 2 current, stage 3 upcoming when submitted (no reviewer)', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseSelfDisclosure,
        status: 'submitted',
        is_submitted: true,
        submitted_at: new Date(),
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].status).toBe('current');
      expect(result.stages[2].status).toBe('upcoming');
      expect(result.currentStep).toBe(2);
    });

    it('stage 1 completed, stage 2 current when ai_reviewing', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseSelfDisclosure,
        status: 'ai_reviewing',
        is_submitted: true,
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].status).toBe('current');
      expect(result.stages[2].status).toBe('upcoming');
    });

    it('stage 1 completed, stage 2 current when improvement_requested', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseSelfDisclosure,
        status: 'improvement_requested',
        is_submitted: true,
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].status).toBe('current');
      expect(result.stages[2].status).toBe('upcoming');
    });

    it('all 3 stages completed when status is completed', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseSelfDisclosure,
        status: 'completed',
        is_submitted: true,
        completed_at: new Date(),
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].status).toBe('completed');
      expect(result.stages[2].status).toBe('completed');
      expect(result.currentStep).toBe(3);
    });

    it('should have correct stage labels', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseSelfDisclosure);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].label).toBe('Self-Disclosure In Progress');
      expect(result.stages[1].label).toBe('Self-Disclosure In Review');
      expect(result.stages[2].label).toBe('Self-Disclosure Completed');
    });

    it('should have correct step numbers', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseSelfDisclosure);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].step).toBe(1);
      expect(result.stages[1].step).toBe(2);
      expect(result.stages[2].step).toBe(3);
    });
  });

  // ─── Assured Assessment Tests ────────────────────────────────────

  describe('Assured Assessment', () => {
    it('should return 4 stages', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseAssured);
      assessmentRepo.getAuditRecordForAssessment.mockResolvedValue(null);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);
      expect(result.stages).toHaveLength(4);
      expect(result.assessmentType).toBe('assured');
    });

    it('stage 1 current, rest upcoming when no auditor assigned', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseAssured,
        assigned_auditor_id: null,
      });
      assessmentRepo.getAuditRecordForAssessment.mockResolvedValue(null);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('current');
      expect(result.stages[1].status).toBe('upcoming');
      expect(result.stages[2].status).toBe('upcoming');
      expect(result.stages[3].status).toBe('upcoming');
      expect(result.currentStep).toBe(1);
    });

    it('stage 1 completed, stage 2 current when auditor assigned (audit in_progress)', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseAssured,
        assigned_auditor_id: 'auditor-user-id',
      });
      assessmentRepo.getAuditRecordForAssessment.mockResolvedValue({
        audit_lifecycle_status: 'in_progress',
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].status).toBe('current');
      expect(result.stages[2].status).toBe('upcoming');
      expect(result.stages[3].status).toBe('upcoming');
      expect(result.currentStep).toBe(2);
    });

    it('stages 1-2 completed, stage 3 current when auditor submitted', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseAssured,
        assigned_auditor_id: 'auditor-user-id',
      });
      assessmentRepo.getAuditRecordForAssessment.mockResolvedValue({
        audit_lifecycle_status: 'auditor_submitted',
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].status).toBe('completed');
      expect(result.stages[2].status).toBe('current');
      expect(result.stages[3].status).toBe('upcoming');
      expect(result.currentStep).toBe(3);
    });

    it('stages 1-3 completed, stage 4 current when reviewer submitted', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseAssured,
        assigned_auditor_id: 'auditor-user-id',
      });
      assessmentRepo.getAuditRecordForAssessment.mockResolvedValue({
        audit_lifecycle_status: 'reviewer_submitted',
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].status).toBe('completed');
      expect(result.stages[2].status).toBe('completed');
      expect(result.stages[3].status).toBe('current');
      expect(result.currentStep).toBe(4);
    });

    it('all 4 stages completed when audit lifecycle is completed', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...baseAssured,
        assigned_auditor_id: 'auditor-user-id',
        status: 'completed',
        completed_at: new Date(),
      });
      assessmentRepo.getAuditRecordForAssessment.mockResolvedValue({
        audit_lifecycle_status: 'completed',
      });
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].status).toBe('completed');
      expect(result.stages[1].status).toBe('completed');
      expect(result.stages[2].status).toBe('completed');
      expect(result.stages[3].status).toBe('completed');
      expect(result.currentStep).toBe(4);
    });

    it('should have correct stage labels', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseAssured);
      assessmentRepo.getAuditRecordForAssessment.mockResolvedValue(null);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].label).toBe('Audit Requested');
      expect(result.stages[1].label).toBe('Audit In Progress');
      expect(result.stages[2].label).toBe('Pending Management Reviewer');
      expect(result.stages[3].label).toBe('Completed');
    });

    it('should have correct step numbers', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseAssured);
      assessmentRepo.getAuditRecordForAssessment.mockResolvedValue(null);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      expect(result.stages[0].step).toBe(1);
      expect(result.stages[1].step).toBe(2);
      expect(result.stages[2].step).toBe(3);
      expect(result.stages[3].step).toBe(4);
    });
  });

  // ─── Response Shape Tests ────────────────────────────────────────

  describe('Response Shape', () => {
    it('should include assessmentId in response', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseSelfDisclosure);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);
      expect(result.assessmentId).toBe(mockAssessmentId);
    });

    it('should include assessmentType in response', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseSelfDisclosure);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);
      expect(result.assessmentType).toBe('self_disclosure');
    });

    it('each stage should have step, label, and status fields', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(baseSelfDisclosure);
      const result = await service.getAssessmentStages(mockUserId, 'admin', mockAssessmentId);

      for (const stage of result.stages) {
        expect(stage).toHaveProperty('step');
        expect(stage).toHaveProperty('label');
        expect(stage).toHaveProperty('status');
        expect(['completed', 'current', 'upcoming']).toContain(stage.status);
      }
    });
  });
});
