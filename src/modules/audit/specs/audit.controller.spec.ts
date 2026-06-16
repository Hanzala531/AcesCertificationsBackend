import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AuditController } from '../audit.controller';
import { AuditService } from '../audit.service';

const mockAuditService = {
  getAuditorAudits: jest.fn(),
  getAuditView: jest.fn(),
  updateReviewerNotes: jest.fn(),
  updateAuditorNotes: jest.fn(),
  upsertAudit: jest.fn(),
  getAiAuditScore: jest.fn(),
};

const mockAdminUser = { sub: 'admin-1', role: 'admin' };
const mockAuditorUser = {
  sub: 'auditor-user-1',
  role: 'auditor',
  auditor_id: 'auditor-profile-1',
};
const mockReviewerUser = {
  sub: 'reviewer-user-1',
  role: 'reviewer',
  reviewer_id: 'reviewer-profile-1',
};

const mockAuditView = {
  assessmentId: 'assessment-1',
  certificateId: 'cert-1',
  certificateName: 'ISO 27001',
  organizationId: 'org-1',
  organizationName: 'ACME Corp',
  status: 'in_progress',
  assessmentType: 'assured',
  requestedReviewer: {
    isTrue: true,
    name: 'John Doe',
    date: new Date('2026-04-01'),
  },
  auditRecord: null,
  sections: [],
};

const mockAuditRecord = {
  id: 'audit-1',
  assessment_id: 'assessment-1',
  certificate_id: 'cert-1',
  audit_summary: 'All good',
  audit_summary_doc: null,
  audit_description: null,
  status: 'approved',
  score: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: mockAuditService }],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    auditService = module.get(AuditService);

    jest.clearAllMocks();
  });

  describe('getAuditView', () => {
    it('should return audit view', async () => {
      auditService.getAuditView.mockResolvedValue(mockAuditView as any);

      const result = await controller.getAuditView('assessment-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAuditView);
      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(auditService.getAuditView).toHaveBeenCalledWith('assessment-1', {
        questionType: undefined,
        flaggedOnly: false,
      });
    });
  });

  describe('getAuditorAudits', () => {
    it('should pass pagination params and return paginated audits', async () => {
      const paginated = {
        items: [],
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      };
      auditService.getAuditorAudits.mockResolvedValue(paginated as any);

      const result = await controller.getAuditorAudits(
        { user: mockAuditorUser } as any,
        { lifecycleStatus: 'completed', page: 2, limit: 5 } as any,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(paginated);
      expect(auditService.getAuditorAudits).toHaveBeenCalledWith(
        'auditor-user-1',
        'auditor',
        undefined,
        'completed',
        2,
        5,
      );
    });
  });

  describe('updateReviewerNotes', () => {
    it('should update reviewer notes', async () => {
      const updated = {
        id: 'query-1',
        reviewerNotes: 'Good work',
        updatedAt: new Date(),
      };
      auditService.updateReviewerNotes.mockResolvedValue(updated);

      const result = await controller.updateReviewerNotes(
        { user: mockReviewerUser } as any,
        'assessment-1',
        'question-1',
        { reviewerNotes: 'Good work' },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
      expect(auditService.updateReviewerNotes).toHaveBeenCalledWith(
        'assessment-1',
        'question-1',
        'Good work',
        'reviewer-user-1',
        'reviewer-profile-1',
      );
    });
  });

  describe('updateAuditorNotes', () => {
    it('should update auditor notes', async () => {
      const updated = {
        id: 'query-1',
        auditorNotes: 'Checked docs',
        updatedAt: new Date(),
      };
      auditService.updateAuditorNotes.mockResolvedValue(updated);

      const result = await controller.updateAuditorNotes(
        { user: mockAuditorUser } as any,
        'assessment-1',
        'question-1',
        { auditorNotes: 'Checked docs' },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
      expect(auditService.updateAuditorNotes).toHaveBeenCalledWith(
        'assessment-1',
        'question-1',
        'Checked docs',
        'auditor-user-1',
        'auditor-profile-1',
      );
    });
  });

  describe('upsertAudit', () => {
    it('should create or update audit record', async () => {
      auditService.upsertAudit.mockResolvedValue(mockAuditRecord as any);

      const dto = {
        auditSummary: 'All good',
        status: 'approved' as const,
      };
      const result = await controller.upsertAudit(
        { user: mockAuditorUser } as any,
        'assessment-1',
        dto,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAuditRecord);
      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(auditService.upsertAudit).toHaveBeenCalledWith(
        'assessment-1',
        dto,
        'auditor-user-1',
        'auditor',
        'auditor-profile-1',
      );
    });

    it('should allow partial updates (only status)', async () => {
      auditService.upsertAudit.mockResolvedValue({
        ...mockAuditRecord,
        status: 'conditionally_approved',
      } as any);

      const result = await controller.upsertAudit(
        { user: mockAuditorUser } as any,
        'assessment-1',
        { status: 'conditionally_approved' },
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('conditionally_approved');
    });
  });

  describe('getAiAuditScore', () => {
    it('should return the AI audit score', async () => {
      const mockAiScore = {
        id: 'ai-score-1',
        assessment_id: 'assessment-1',
        audit_id: 'audit-1',
        ai_score: 88.5,
        ai_reasoning: 'Both reviews are thorough and aligned.',
        prompt_version: '1.0',
        model_used: 'gpt-4o',
        created_at: new Date(),
      };
      auditService.getAiAuditScore.mockResolvedValue(mockAiScore as any);

      const result = await controller.getAiAuditScore('assessment-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAiScore);
      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(auditService.getAiAuditScore).toHaveBeenCalledWith('assessment-1');
    });
  });
});
