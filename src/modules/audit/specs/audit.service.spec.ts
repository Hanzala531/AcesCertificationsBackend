import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { AuditService } from '../audit.service';
import { AuditRepository } from '../audit.repository';
import { AssessmentRepository } from '../../assessment/assessment.repository';
import { ChatService } from '../../chat/chat.service';
import { NotificationService } from '../../notification/services/notification.service';
import { AiProviderFactory } from '../../ai-review/providers/ai-provider.factory';
import { AiConfigService } from '../../../config/ai.config';
import { ScoreCalculationService } from '../../certificate/services/score-calculation.service';

const mockAuditRepository = {
  getAssessmentInfo: jest.fn(),
  getQuestionsWithAuditData: jest.fn(),
  findByAssessmentId: jest.fn(),
  findByAssessmentIdWithDetails: jest.fn(),
  upsertReview: jest.fn(),
  findQueryByQuestionAndAssessment: jest.fn(),
  updateReviewerNotes: jest.fn(),
  updateAuditorNotes: jest.fn(),
  upsert: jest.fn(),
  getBadgeForScore: jest.fn(),
  findOrgBadgeByAssessmentId: jest.fn(),
  getNextCertificateNumber: jest.fn(),
  createIssuedCertificate: jest.fn(),
  setAssessmentCompleted: jest.fn(),
  setAuditLifecycleStatus: jest.fn(),
  findIssuedCertificate: jest.fn(),
  getOrganizationUserIds: jest.fn(),
  getApplicantUserIds: jest.fn(),
  getQuestionContext: jest.fn(),
  createAiAuditScore: jest.fn(),
  findLatestAiAuditScore: jest.fn(),
  updateAuditScores: jest.fn(),
  createComplianceAction: jest.fn(),
  getAssignedReviewerUserId: jest.fn(),
  archiveCurrentAudit: jest.fn(),
  createAuditForReaudit: jest.fn(),
  blockIssuedCertificate: jest.fn(),
  blockAssessmentCertificate: jest.fn(),
  createAuditOnAssignment: jest.fn(),
  setAssignedReviewer: jest.fn(),
  findAuditorUserIdByProfileId: jest.fn(),
  findAuditorAudits: jest.fn(),
  findAuditorSignatureByUserId: jest.fn(),
  findReviewerSignatureByUserId: jest.fn(),
};

const mockAssessmentRepository = {
  findAssessmentById: jest.fn(),
  findReviewerByUserId: jest.fn(),
  findAuditorByUserId: jest.fn(),
};

const mockChatService = {
  createThread: jest.fn(),
  sendMessage: jest.fn(),
  lockThreadByAssessmentId: jest.fn().mockResolvedValue(undefined),
  findOrCreateTypedThread: jest.fn(),
};

const mockNotificationService = {
  notifyUsers: jest.fn(),
};

const mockAiProvider = {
  scoreAuditReview: jest
    .fn()
    .mockResolvedValue({ score: 85, reasoning: 'Good compliance' }),
  reviewQuestions: jest.fn(),
};

const mockAiProviderFactory = {
  getProvider: jest.fn().mockReturnValue(mockAiProvider),
};

const mockScoreCalculationService = {
  assignBadge: jest.fn().mockResolvedValue({ badgeId: null, badgeName: null }),
};

const mockAiConfigService = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: 'test-key',
};

const mockAssessmentInfo = {
  id: 'assessment-1',
  certificate_id: 'cert-1',
  certificate_name: 'ISO 27001',
  organization_id: 'org-1',
  organization_name: 'ACME Corp',
  status: 'in_progress',
  assessment_type: 'assured',
  branch_id: null,
  assigned_auditor_id: 'auditor-profile-1',
  audit_date: null,
  validity_days: 0,
  validity_months: 0,
  validity_years: 1,
  requested_reviewer_is_true: true,
  requested_reviewer_name: 'John Reviewer',
  requested_reviewer_date: new Date('2026-04-01'),
};

const mockAssessment = {
  id: 'assessment-1',
  certificate_id: 'cert-1',
  organization_id: 'org-1',
  assessment_type: 'assured',
  assigned_reviewer_id: 'reviewer-profile-1',
  assigned_auditor_id: 'auditor-profile-1',
  status: 'in_progress',
  is_submitted: true,
  is_certificate_blocked: false,
};

const mockQuery = {
  id: 'query-1',
  certificate_assessment_id: 'assessment-1',
  question_id: 'question-1',
  reviewer_notes: null,
  auditor_notes: null,
};

const mockAuditRecord = {
  id: 'audit-1',
  assessment_id: 'assessment-1',
  certificate_id: 'cert-1',
  audit_summary: 'All good',
  audit_summary_doc: null,
  audit_description: null,
  status: 'approved' as const,
  score: null,
  review_summary: null,
  review_summary_doc: null,
  review_description: null,
  review_status: null,
  review_score: null,
  reviewed_by: null,
  reviewed_at: null,
  assigned_auditor_id: null,
  assigned_reviewer_id: null,
  audit_lifecycle_status: 'in_progress' as const,
  is_archived: false,
  version: 1,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockAuditRecordWithDetails = {
  ...mockAuditRecord,
  auditor_name: 'John Auditor',
  auditor_email: 'john@audit.com',
  auditor_signature: null,
  reviewer_name: null,
  reviewer_email: null,
  reviewer_signature: null,
};

describe('AuditService', () => {
  let service: AuditService;
  let auditRepo: jest.Mocked<AuditRepository>;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuditRepository, useValue: mockAuditRepository },
        { provide: AssessmentRepository, useValue: mockAssessmentRepository },
        { provide: ChatService, useValue: mockChatService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AiProviderFactory, useValue: mockAiProviderFactory },
        { provide: AiConfigService, useValue: mockAiConfigService },
        {
          provide: ScoreCalculationService,
          useValue: mockScoreCalculationService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditRepo = module.get(AuditRepository);
    assessmentRepo = module.get(AssessmentRepository);

    jest.clearAllMocks();

    // Default: auditor and reviewer both have signatures on file, so the
    // upsertAudit/upsertReview finalize-gate doesn't fire unless a test
    // explicitly overrides this.
    auditRepo.findAuditorSignatureByUserId.mockResolvedValue(
      'https://res.cloudinary.com/test/image/upload/v1/auditor-sig.png',
    );
    auditRepo.findReviewerSignatureByUserId.mockResolvedValue(
      'https://res.cloudinary.com/test/image/upload/v1/reviewer-sig.png',
    );
  });

  describe('getAuditView', () => {
    it('should return audit view for an assured assessment', async () => {
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue([]);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(mockAuditRecordWithDetails);

      const result = await service.getAuditView('assessment-1');

      expect(result.assessmentId).toBe('assessment-1');
      expect(result.certificateName).toBe('ISO 27001');
      expect(result.organizationName).toBe('ACME Corp');
      expect(result.requestedReviewer).toEqual({
        isTrue: true,
        name: 'John Reviewer',
        date: new Date('2026-04-01'),
      });
      expect(result.auditRecord).toEqual(mockAuditRecordWithDetails);
      expect(result.sections).toEqual([]);
    });

    it('should throw NotFoundException when assessment does not exist', async () => {
      auditRepo.getAssessmentInfo.mockResolvedValue(null);

      await expect(service.getAuditView('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return audit view for a self_disclosure assessment', async () => {
      const sdInfo = {
        ...mockAssessmentInfo,
        assessment_type: 'self_disclosure',
      };
      auditRepo.getAssessmentInfo.mockResolvedValue(sdInfo);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue([]);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);

      const result = await service.getAuditView('assessment-1');

      expect(result.assessmentType).toBe('self_disclosure');
      expect(auditRepo.getQuestionsWithAuditData).toHaveBeenCalledWith(
        'assessment-1',
        'cert-1',
        'org-1',
        'self_disclosure',
      );
    });

    it('should build nested hierarchy from flat question rows', async () => {
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue([
        {
          main_section_id: 'ms-1',
          main_section_name: 'Main A',
          main_section_rank: 1,
          section_id: 's-1',
          section_name: 'Section A',
          section_rank: 1,
          sub_section_id: 'ss-1',
          sub_section_name: 'Sub A',
          sub_section_rank: 1,
          question_id: 'q-1',
          question_text: 'Is it compliant?',
          question_type: 'boolean',
          is_third_level: true,
          question_rank: 1,
          answer_id: 'aq-1',
          response_type: 'boolean',
          response_value: 'yes',
          response_files: null,
          reviewer_notes: 'Looks good',
          auditor_notes: null,
          is_flagged: false,
          flag_reason: null,
          confidence_score: null,
          risk_level: null,
          category: null,
          summary: null,
          ai_suggestion: null,
        },
      ]);

      const result = await service.getAuditView('assessment-1');

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].mainSectionName).toBe('Main A');
      expect(
        result.sections[0].sections[0].subSections[0].questions[0]
          .applicantAnswer,
      ).toBe('yes');
      expect(
        result.sections[0].sections[0].subSections[0].questions[0]
          .reviewerNotes,
      ).toBe('Looks good');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getAuditView – filter tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getAuditView filters', () => {
    // Helper to create a flat row (no sub-section, direct section question)
    const makeRow = (
      overrides: any,
    ) => ({
      main_section_id: 'ms-1',
      main_section_name: 'Main Section',
      main_section_rank: 1,
      section_id: 's-1',
      section_name: 'Section A',
      section_rank: 1,
      sub_section_id: null,
      sub_section_name: null,
      sub_section_rank: null,
      question_text: 'A question',
      is_third_level: false,
      question_rank: 1,
      response_value: 'yes',
      response_files: null,
      reviewer_notes: null,
      auditor_notes: null,
      flag_reason: null,
      confidence_score: null,
      risk_level: null,
      category: null,
      summary: null,
      ai_suggestion: null,
      answer_id: `aq-${overrides.question_id ?? 'default'}`,
      ...overrides,
    });

    // 6 rows: all combinations of type (boolean/text/pdf) x flagged (true/false)
    const allFilterRows = [
      makeRow({ question_id: 'q-bool-ok',    question_type: 'boolean', response_type: 'boolean', is_flagged: false }),
      makeRow({ question_id: 'q-text-ok',    question_type: 'text',    response_type: 'text',    is_flagged: false }),
      makeRow({ question_id: 'q-pdf-ok',     question_type: 'file',    response_type: 'pdf',     is_flagged: false }),
      makeRow({ question_id: 'q-bool-flag',  question_type: 'boolean', response_type: 'boolean', is_flagged: true,  flag_reason: 'No', summary: 'Non-compliant' }),
      makeRow({ question_id: 'q-text-flag',  question_type: 'text',    response_type: 'text',    is_flagged: true,  flag_reason: 'Brief', summary: 'Too short' }),
      makeRow({ question_id: 'q-pdf-flag',   question_type: 'file',    response_type: 'pdf',     is_flagged: true,  flag_reason: 'Doc', summary: 'Bad doc' }),
    ];

    // Helper: extract all question IDs from the returned sections
    const extractQuestionIds = (sections: typeof result.sections) => {
      const ids: string[] = [];
      for (const ms of sections) {
        for (const s of ms.sections) {
          for (const q of s.questions) ids.push(q.questionId);
          for (const ss of s.subSections) {
            for (const q of ss.questions) ids.push(q.questionId);
          }
        }
      }
      return ids;
    };

    let result: Awaited<ReturnType<typeof service.getAuditView>>;

    beforeEach(() => {
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue(allFilterRows as any);
    });

    it('no filters → returns all 6 answered questions', async () => {
      result = await service.getAuditView('assessment-1');
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(6);
      expect(ids).toEqual(expect.arrayContaining([
        'q-bool-ok', 'q-text-ok', 'q-pdf-ok',
        'q-bool-flag', 'q-text-flag', 'q-pdf-flag',
      ]));
    });

    it('questionType=pdf → returns only pdf questions (flagged and non-flagged)', async () => {
      result = await service.getAuditView('assessment-1', { questionType: 'pdf' });
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining(['q-pdf-ok', 'q-pdf-flag']));
    });

    it('questionType=text → returns only text questions', async () => {
      result = await service.getAuditView('assessment-1', { questionType: 'text' });
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining(['q-text-ok', 'q-text-flag']));
    });

    it('questionType=boolean → returns only boolean questions', async () => {
      result = await service.getAuditView('assessment-1', { questionType: 'boolean' });
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining(['q-bool-ok', 'q-bool-flag']));
    });

    it('flaggedOnly=true → returns all flagged questions regardless of type', async () => {
      result = await service.getAuditView('assessment-1', { flaggedOnly: true });
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(3);
      expect(ids).toEqual(expect.arrayContaining(['q-bool-flag', 'q-text-flag', 'q-pdf-flag']));
    });

    it('flaggedOnly=false → same as no filter, returns all 6 questions', async () => {
      result = await service.getAuditView('assessment-1', { flaggedOnly: false });
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(6);
    });

    it('questionType=pdf + flaggedOnly=true → returns only flagged pdf questions', async () => {
      result = await service.getAuditView('assessment-1', { questionType: 'pdf', flaggedOnly: true });
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(1);
      expect(ids).toEqual(['q-pdf-flag']);
    });

    it('questionType=text + flaggedOnly=true → returns only flagged text questions', async () => {
      result = await service.getAuditView('assessment-1', { questionType: 'text', flaggedOnly: true });
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(1);
      expect(ids).toEqual(['q-text-flag']);
    });

    it('questionType=boolean + flaggedOnly=true → returns only flagged boolean questions', async () => {
      result = await service.getAuditView('assessment-1', { questionType: 'boolean', flaggedOnly: true });
      const ids = extractQuestionIds(result.sections);
      expect(ids).toHaveLength(1);
      expect(ids).toEqual(['q-bool-flag']);
    });

    it('both filters applied with no intersection → returns empty sections', async () => {
      // Only non-flagged pdf rows: remove the flagged pdf row
      const noPdfFlaggedRows = allFilterRows.filter(
        (r) => !(r.response_type === 'pdf' && r.is_flagged === true),
      );
      auditRepo.getQuestionsWithAuditData.mockResolvedValue(noPdfFlaggedRows as any);

      result = await service.getAuditView('assessment-1', { questionType: 'pdf', flaggedOnly: true });
      expect(result.sections).toHaveLength(0);
    });

    it('questionType filter alone leaves the other filter (flaggedOnly) unchanged', async () => {
      // Applying only questionType should NOT filter out non-flagged questions of that type
      result = await service.getAuditView('assessment-1', { questionType: 'boolean' });
      const ids = extractQuestionIds(result.sections);
      // Both flagged and non-flagged boolean should appear
      expect(ids).toContain('q-bool-ok');
      expect(ids).toContain('q-bool-flag');
      // No text or pdf questions
      expect(ids).not.toContain('q-text-ok');
      expect(ids).not.toContain('q-pdf-ok');
    });

    it('flaggedOnly filter alone leaves questionType unchanged (all types remain)', async () => {
      result = await service.getAuditView('assessment-1', { flaggedOnly: true });
      const ids = extractQuestionIds(result.sections);
      // All 3 types represented in flagged results
      expect(ids).toContain('q-bool-flag');
      expect(ids).toContain('q-text-flag');
      expect(ids).toContain('q-pdf-flag');
      // Non-flagged questions excluded
      expect(ids).not.toContain('q-bool-ok');
      expect(ids).not.toContain('q-text-ok');
      expect(ids).not.toContain('q-pdf-ok');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getAuditView – regression: flaggedOnly=false returns nothing bug
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getAuditView – flaggedOnly=false regression', () => {
    // makeRow helper (same defaults as above filter block)
    const makeRegressionRow = (overrides: any) => ({
      main_section_id: 'ms-1',
      main_section_name: 'Main Section',
      main_section_rank: 1,
      section_id: 's-1',
      section_name: 'Section A',
      section_rank: 1,
      sub_section_id: null,
      sub_section_name: null,
      sub_section_rank: null,
      question_text: 'A question',
      is_third_level: false,
      question_rank: 1,
      response_value: 'yes',
      response_files: null,
      reviewer_notes: null,
      auditor_notes: null,
      flag_reason: null,
      confidence_score: null,
      risk_level: null,
      category: null,
      summary: null,
      ai_suggestion: null,
      ...overrides,
    });

    it('flaggedOnly=false with answered questions returns all answered questions (not empty)', async () => {
      // This was the reported bug: flaggedOnly=false returned nothing
      const rows = [
        makeRegressionRow({ question_id: 'q-1', response_type: 'boolean', is_flagged: false, answer_id: 'aq-1' }),
        makeRegressionRow({ question_id: 'q-2', response_type: 'text',    is_flagged: true,  answer_id: 'aq-2' }),
        makeRegressionRow({ question_id: 'q-3', response_type: 'pdf',     is_flagged: false, answer_id: 'aq-3' }),
      ];
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue(rows as any);

      const result = await service.getAuditView('assessment-1', { flaggedOnly: false });
      const ids: string[] = [];
      result.sections.forEach(ms => ms.sections.forEach(s => {
        s.questions.forEach(q => ids.push(q.questionId));
        s.subSections.forEach(ss => ss.questions.forEach(q => ids.push(q.questionId)));
      }));

      // Must NOT be empty — all 3 answered questions must appear
      expect(ids).toHaveLength(3);
      expect(ids).toEqual(expect.arrayContaining(['q-1', 'q-2', 'q-3']));
    });

    it('rows where answer_id is null (no answers submitted) are excluded — sections is empty', async () => {
      // When sd_ca CTE returns null (no linked self-disclosure found), all answer_ids are null
      const rows = [
        makeRegressionRow({ question_id: 'q-1', response_type: null, is_flagged: null, answer_id: null }),
        makeRegressionRow({ question_id: 'q-2', response_type: null, is_flagged: null, answer_id: null }),
      ];
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue(rows as any);

      const result = await service.getAuditView('assessment-1', { flaggedOnly: false });

      expect(result.sections).toHaveLength(0);
    });

    it('mix of answered and unanswered rows — only answered rows appear when flaggedOnly=false', async () => {
      const rows = [
        makeRegressionRow({ question_id: 'q-answered',   response_type: 'boolean', is_flagged: false, answer_id: 'aq-1' }),
        makeRegressionRow({ question_id: 'q-unanswered', response_type: null,      is_flagged: null,  answer_id: null }),
      ];
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue(rows as any);

      const result = await service.getAuditView('assessment-1', { flaggedOnly: false });
      const ids: string[] = [];
      result.sections.forEach(ms => ms.sections.forEach(s => {
        s.questions.forEach(q => ids.push(q.questionId));
      }));

      expect(ids).toEqual(['q-answered']);
      expect(ids).not.toContain('q-unanswered');
    });

    it('flaggedOnly=true excludes non-flagged answered questions', async () => {
      const rows = [
        makeRegressionRow({ question_id: 'q-flagged',     response_type: 'text', is_flagged: true,  answer_id: 'aq-1', summary: 'Issue found', flag_reason: 'Bad' }),
        makeRegressionRow({ question_id: 'q-not-flagged', response_type: 'text', is_flagged: false, answer_id: 'aq-2' }),
        makeRegressionRow({ question_id: 'q-no-review',   response_type: 'text', is_flagged: null,  answer_id: 'aq-3' }),
      ];
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue(rows as any);

      const result = await service.getAuditView('assessment-1', { flaggedOnly: true });
      const ids: string[] = [];
      result.sections.forEach(ms => ms.sections.forEach(s => {
        s.questions.forEach(q => ids.push(q.questionId));
      }));

      expect(ids).toEqual(['q-flagged']);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getAuditView – response_files on PDF questions
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getAuditView – response_files', () => {
    it('PDF question with response_files has files in response', async () => {
      const row = {
        main_section_id: 'ms-1', main_section_name: 'Main', main_section_rank: 1,
        section_id: 's-1', section_name: 'Section A', section_rank: 1,
        sub_section_id: null, sub_section_name: null, sub_section_rank: null,
        question_id: 'q-pdf', question_text: 'Upload policy', question_type: 'file',
        is_third_level: false, question_rank: 1,
        answer_id: 'aq-pdf',
        response_type: 'pdf',
        response_value: null,
        response_files: ['https://storage.example.com/files/policy.pdf', 'https://storage.example.com/files/appendix.pdf'],
        reviewer_notes: null, auditor_notes: null,
        is_flagged: false, flag_reason: null, confidence_score: null,
        risk_level: null, category: null, summary: null, ai_suggestion: null,
      };
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue([row] as any);

      const result = await service.getAuditView('assessment-1');
      const question = result.sections[0].sections[0].questions[0];

      expect(question.responseFiles).toEqual([
        'https://storage.example.com/files/policy.pdf',
        'https://storage.example.com/files/appendix.pdf',
      ]);
      expect(question.applicantAnswer).toBeNull();
    });

    it('non-PDF question with null response_files returns responseFiles as null', async () => {
      const row = {
        main_section_id: 'ms-1', main_section_name: 'Main', main_section_rank: 1,
        section_id: 's-1', section_name: 'Section A', section_rank: 1,
        sub_section_id: null, sub_section_name: null, sub_section_rank: null,
        question_id: 'q-bool', question_text: 'Do you comply?', question_type: 'boolean',
        is_third_level: false, question_rank: 1,
        answer_id: 'aq-bool',
        response_type: 'boolean',
        response_value: 'yes',
        response_files: null,
        reviewer_notes: null, auditor_notes: null,
        is_flagged: false, flag_reason: null, confidence_score: null,
        risk_level: null, category: null, summary: null, ai_suggestion: null,
      };
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue([row] as any);

      const result = await service.getAuditView('assessment-1');
      const question = result.sections[0].sections[0].questions[0];

      expect(question.responseFiles).toBeNull();
    });
  });

  describe('updateReviewerNotes', () => {
    it('should update reviewer notes for assigned reviewer', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findReviewerByUserId.mockResolvedValue({
        id: 'reviewer-profile-1',
      });
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findQueryByQuestionAndAssessment.mockResolvedValue(mockQuery);
      auditRepo.updateReviewerNotes.mockResolvedValue({
        id: 'query-1',
        reviewer_notes: 'Updated notes',
        updated_at: new Date(),
      });

      const result = await service.updateReviewerNotes(
        'assessment-1',
        'question-1',
        'Updated notes',
        'reviewer-profile-1',
      );

      expect(result.reviewerNotes).toBe('Updated notes');
      expect(auditRepo.updateReviewerNotes).toHaveBeenCalledWith(
        'query-1',
        'Updated notes',
      );
    });

    it('should throw NotFoundException when query does not exist', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findReviewerByUserId.mockResolvedValue({
        id: 'reviewer-profile-1',
      });
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findQueryByQuestionAndAssessment.mockResolvedValue(null);

      await expect(
        service.updateReviewerNotes(
          'assessment-1',
          'question-1',
          'notes',
          'reviewer-profile-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when reviewer is not assigned', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findReviewerByUserId.mockResolvedValue({
        id: 'reviewer-profile-OTHER',
      });

      await expect(
        service.updateReviewerNotes(
          'assessment-1',
          'question-1',
          'notes',
          'user-other',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateAuditorNotes', () => {
    it('should update auditor notes for assigned auditor', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findAuditorByUserId.mockResolvedValue({
        id: 'auditor-profile-1',
      });
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findQueryByQuestionAndAssessment.mockResolvedValue(mockQuery);
      auditRepo.updateAuditorNotes.mockResolvedValue({
        id: 'query-1',
        auditor_notes: 'Auditor observation',
        updated_at: new Date(),
      });

      const result = await service.updateAuditorNotes(
        'assessment-1',
        'question-1',
        'Auditor observation',
        'auditor-profile-1',
      );

      expect(result.auditorNotes).toBe('Auditor observation');
    });

    it('should throw ForbiddenException when auditor is not assigned', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findAuditorByUserId.mockResolvedValue({
        id: 'auditor-profile-OTHER',
      });

      await expect(
        service.updateAuditorNotes(
          'assessment-1',
          'question-1',
          'notes',
          'user-other',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('upsertAudit', () => {
    it('should create audit record for assured assessment', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      auditRepo.upsert.mockResolvedValue(mockAuditRecord);

      const result = await service.upsertAudit('assessment-1', {
        auditSummary: 'All good',
        status: 'approved',
      });

      expect(result.id).toBe('audit-1');
      expect(auditRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentId: 'assessment-1',
          certificateId: 'cert-1',
          auditSummary: 'All good',
          status: 'approved',
        }),
      );
    });

    it('should throw NotFoundException when assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(service.upsertAudit('bad-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create audit record for self_disclosure assessment', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        assessment_type: 'self_disclosure',
      } as any);
      auditRepo.upsert.mockResolvedValue(mockAuditRecord);

      const result = await service.upsertAudit('assessment-1', {
        auditSummary: 'Reviewed',
      });

      expect(result.id).toBe('audit-1');
    });
  });

  describe('issueCertificate', () => {
    it('should allocate assured badges from slot 2 or 3 (not slot 1)', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findReviewerByUserId.mockResolvedValue({
        id: 'reviewer-profile-1',
      });
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findIssuedCertificate.mockResolvedValue(null);
      auditRepo.findByAssessmentId.mockResolvedValue({
        ...mockAuditRecord,
        review_status: 'approved',
      });
      auditRepo.findLatestAiAuditScore.mockResolvedValue({
        id: 'ai-1',
        assessment_id: 'assessment-1',
        audit_id: 'audit-1',
        ai_score: 82,
        ai_reasoning: 'Good review',
        prompt_version: '1.0',
        model_used: 'gpt-4o',
        created_at: new Date(),
      });
      auditRepo.getBadgeForScore.mockResolvedValue({
        id: 'badge-slot-2',
        name: 'Aces Verified',
        slot: 2,
        color: 'green',
      });
      auditRepo.findOrgBadgeByAssessmentId.mockResolvedValue(null);
      auditRepo.getNextCertificateNumber.mockResolvedValue('ACES-2026-000123');
      auditRepo.createIssuedCertificate.mockResolvedValue({
        id: 'issued-1',
      } as any);
      auditRepo.setAssessmentCompleted.mockResolvedValue(undefined);
      auditRepo.setAuditLifecycleStatus.mockResolvedValue(undefined);
      auditRepo.getApplicantUserIds.mockResolvedValue([]);
      // Badge allocation now goes through ScoreCalculationService.assignBadge,
      // which enforces the slot-2/3 eligibility for assured assessments and
      // returns only { badgeId, badgeName }.
      mockScoreCalculationService.assignBadge.mockResolvedValueOnce({
        badgeId: 'badge-slot-2',
        badgeName: 'Aces Verified',
      });

      await service.issueCertificate('assessment-1', 'reviewer-profile-1');

      expect(mockScoreCalculationService.assignBadge).toHaveBeenCalledWith(
        'cert-1',
        82,
        'assured',
        'org-1',
      );
      expect(auditRepo.createIssuedCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          badgeId: 'badge-slot-2',
          badgeName: 'Aces Verified',
          badgeColor: null,
          reviewScore: 82,
        }),
      );
      expect(auditRepo.setAuditLifecycleStatus).toHaveBeenCalledWith(
        'assessment-1',
        'completed',
      );
    });

    it('should fail when active certificate already exists', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findReviewerByUserId.mockResolvedValue({
        id: 'reviewer-profile-1',
      });
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findIssuedCertificate.mockResolvedValue({
        id: 'issued-1',
        is_blocked: false,
      } as any);

      await expect(
        service.issueCertificate('assessment-1', 'reviewer-profile-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('postComplianceAction', () => {
    const assessmentId = 'assessment-1';
    const questionId = 'question-1';
    const message = 'Please clarify this item';

    const mockThread = {
      id: 'thread-1',
      assessment_id: assessmentId,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockChatMessage = {
      id: 'msg-1',
      thread_id: 'thread-1',
      sender_id: 'auditor-user',
      content: '[Request Clarification] Please clarify this item',
      sender_name: 'Auditor User',
      sender_role: 'auditor',
    };

    const mockComplianceAction = {
      id: 'action-1',
      assessmentId,
      questionId,
      actionType: 'request_clarification' as const,
      message,
      createdBy: 'auditor-user',
      createdByRole: 'auditor',
      clarificationTarget: null,
      chatMessageId: 'msg-1',
      createdAt: new Date(),
    };

    beforeEach(() => {
      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.findByAssessmentId.mockResolvedValue({
        ...mockAuditRecord,
        review_status: null,
      });
      auditRepo.getApplicantUserIds.mockResolvedValue(['org-user-1', 'org-user-2']);
      auditRepo.getQuestionContext.mockResolvedValue({
        question_text: 'Do you have an ISO policy?',
        question_type: 'boolean',
        main_section_name: 'Quality Management',
        section_name: 'Policy',
        sub_section_name: null,
        response_value: 'Yes',
        response_type: 'boolean',
      });
      auditRepo.createComplianceAction.mockResolvedValue(mockComplianceAction);
      mockChatService.findOrCreateTypedThread.mockResolvedValue(mockThread);
      mockChatService.sendMessage.mockResolvedValue(mockChatMessage);
      mockNotificationService.notifyUsers.mockResolvedValue(undefined);

      // Auditor access setup
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment as any);
      assessmentRepo.findAuditorByUserId.mockResolvedValue({ id: 'auditor-profile-1' });
    });

    it('should route auditor request_clarification to auditor_reviewer thread with per-question scoping', async () => {
      auditRepo.getAssignedReviewerUserId.mockResolvedValue('reviewer-user-1');

      await service.postComplianceAction(
        assessmentId,
        questionId,
        'request_clarification',
        message,
        'auditor-user',
        'auditor',
        'auditor-profile-1',
      );

      expect(auditRepo.getAssignedReviewerUserId).toHaveBeenCalledWith(assessmentId);
      expect(mockChatService.findOrCreateTypedThread).toHaveBeenCalledWith(
        assessmentId,
        'auditor_reviewer',
        'auditor-user',
        'auditor',
        ['reviewer-user-1'],
        'reviewer',
        questionId,
      );
      expect(auditRepo.createComplianceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          clarificationTarget: 'reviewer',
          actionType: 'request_clarification',
        }),
      );
    });

    it('should route auditor request_clarification to auditor_reviewer even when clarificationTarget is not specified', async () => {
      auditRepo.getAssignedReviewerUserId.mockResolvedValue('reviewer-user-1');

      await service.postComplianceAction(
        assessmentId,
        questionId,
        'request_clarification',
        message,
        'auditor-user',
        'auditor',
        'auditor-profile-1',
        undefined,
        'reviewer',
      );

      expect(auditRepo.getAssignedReviewerUserId).toHaveBeenCalledWith(assessmentId);
      expect(mockChatService.findOrCreateTypedThread).toHaveBeenCalledWith(
        assessmentId,
        'auditor_reviewer',
        'auditor-user',
        'auditor',
        ['reviewer-user-1'],
        'reviewer',
        questionId,
      );
      expect(auditRepo.createComplianceAction).toHaveBeenCalledWith(
        expect.objectContaining({ clarificationTarget: 'reviewer' }),
      );
    });

    it('should throw BadRequestException when no reviewer assigned for clarification', async () => {
      auditRepo.getAssignedReviewerUserId.mockResolvedValue(null);

      await expect(
        service.postComplianceAction(
          assessmentId,
          questionId,
          'request_clarification',
          message,
          'auditor-user',
          'auditor',
          'auditor-profile-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockChatService.findOrCreateTypedThread).not.toHaveBeenCalled();
    });

    it('should route reviewer compliance action to reviewer_applicant thread with per-question scoping', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        assigned_reviewer_id: 'reviewer-profile-1',
      } as any);
      assessmentRepo.findReviewerByUserId.mockResolvedValue({ id: 'reviewer-profile-1' });

      await service.postComplianceAction(
        assessmentId,
        questionId,
        'request_clarification',
        message,
        'reviewer-user',
        'reviewer',
        undefined,
        'reviewer-profile-1',
      );

      expect(mockChatService.findOrCreateTypedThread).toHaveBeenCalledWith(
        assessmentId,
        'reviewer_applicant',
        'reviewer-user',
        'reviewer',
        ['org-user-1', 'org-user-2'],
        'applicant',
        questionId,
      );
      expect(auditRepo.createComplianceAction).toHaveBeenCalledWith(
        expect.objectContaining({ createdByRole: 'reviewer' }),
      );
    });

    it('should route auditor request_clarification to auditor_reviewer thread', async () => {
      auditRepo.getAssignedReviewerUserId.mockResolvedValue('reviewer-user-1');

      await service.postComplianceAction(
        assessmentId,
        questionId,
        'request_clarification',
        message,
        'auditor-user',
        'auditor',
        'auditor-profile-1',
      );

      expect(mockChatService.findOrCreateTypedThread).toHaveBeenCalledWith(
        assessmentId,
        'auditor_reviewer',
        'auditor-user',
        'auditor',
        ['reviewer-user-1'],
        'reviewer',
        questionId,
      );
      expect(auditRepo.createComplianceAction).toHaveBeenCalledWith(
        expect.objectContaining({ clarificationTarget: 'reviewer' }),
      );
    });

    it('should throw NotFoundException when assessment not found', async () => {
      auditRepo.getAssessmentInfo.mockResolvedValue(null);

      await expect(
        service.postComplianceAction(
          'bad-assessment',
          questionId,
          'request_clarification',
          message,
          'auditor-user',
          'auditor',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when audit is already finalized (has review_status)', async () => {
      auditRepo.findByAssessmentId.mockResolvedValue({
        ...mockAuditRecord,
        review_status: 'approved',
      });

      await expect(
        service.postComplianceAction(
          assessmentId,
          questionId,
          'request_clarification',
          message,
          'auditor-user',
          'auditor',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should send notification to org users after compliance action', async () => {
      auditRepo.getAssignedReviewerUserId.mockResolvedValue('reviewer-user-1');

      await service.postComplianceAction(
        assessmentId,
        questionId,
        'request_clarification',
        message,
        'auditor-user',
        'auditor',
        'auditor-profile-1',
      );

      // Notification is fire-and-forget, use a small delay to let promise resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNotificationService.notifyUsers).toHaveBeenCalledWith(
        ['org-user-1', 'org-user-2'],
        expect.objectContaining({ module: 'audit' }),
      );
    });
  });

  describe('getAuditorAudits', () => {
    const mockAudits = {
      items: [
        {
          assessment_id: 'assessment-1',
          assessment_type: 'assured',
          assessment_status: 'submitted',
          organization_name: 'Acme Corp',
          certificate_name: 'ISO 27001',
          audit_date: null,
          audit_id: 'audit-1',
          audit_lifecycle_status: 'in_progress',
          audit_status: null,
          review_status: null,
          score: null,
          review_score: null,
          audit_created_at: new Date(),
          audit_updated_at: new Date(),
          computed_status: 'pending' as const,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    it('should return audits for auditor role using userId from token', async () => {
      auditRepo.findAuditorAudits.mockResolvedValue(mockAudits);

      const result = await service.getAuditorAudits(
        'auditor-user-1',
        'auditor',
      );

      expect(auditRepo.findAuditorAudits).toHaveBeenCalledWith(
        'auditor-user-1',
        undefined,
        1,
        10,
      );
      expect(result).toEqual(mockAudits);
    });

    it('should resolve auditor profile ID for admin role', async () => {
      auditRepo.findAuditorUserIdByProfileId.mockResolvedValue(
        'resolved-user-id',
      );
      auditRepo.findAuditorAudits.mockResolvedValue(mockAudits);

      const result = await service.getAuditorAudits(
        'admin-user-1',
        'admin',
        'auditor-profile-1',
      );

      expect(auditRepo.findAuditorUserIdByProfileId).toHaveBeenCalledWith(
        'auditor-profile-1',
      );
      expect(auditRepo.findAuditorAudits).toHaveBeenCalledWith(
        'resolved-user-id',
        undefined,
        1,
        10,
      );
      expect(result).toEqual(mockAudits);
    });

    it('should throw BadRequestException when admin omits auditorProfileId', async () => {
      await expect(
        service.getAuditorAudits('admin-user-1', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when auditor profile not found', async () => {
      auditRepo.findAuditorUserIdByProfileId.mockResolvedValue(null);

      await expect(
        service.getAuditorAudits(
          'admin-user-1',
          'admin',
          'nonexistent-profile',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should pass lifecycleStatus filter to repository', async () => {
      auditRepo.findAuditorAudits.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await service.getAuditorAudits(
        'auditor-user-1',
        'auditor',
        undefined,
        'completed',
      );

      expect(auditRepo.findAuditorAudits).toHaveBeenCalledWith(
        'auditor-user-1',
        'completed',
        1,
        10,
      );
    });
  });

  describe('upsertReview', () => {
    it('should call upsertReview on the repository with correct data', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment as any);
      assessmentRepo.findReviewerByUserId.mockResolvedValue({ id: 'reviewer-profile-1' });
      auditRepo.findByAssessmentId.mockResolvedValue(mockAuditRecord);
      auditRepo.upsertReview.mockResolvedValue({
        ...mockAuditRecord,
        review_summary: 'Looks good',
        review_status: 'approved',
        audit_lifecycle_status: 'reviewer_submitted',
      });
      auditRepo.findLatestAiAuditScore.mockResolvedValue(null);

      const result = await service.upsertReview(
        'assessment-1',
        {
          reviewSummary: 'Looks good',
          reviewStatus: 'approved',
        },
        'reviewer-profile-1',
      );

      expect(auditRepo.upsertReview).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentId: 'assessment-1',
          reviewSummary: 'Looks good',
          reviewStatus: 'approved',
          reviewedBy: 'reviewer-profile-1',
        }),
      );
      expect(result.review_summary).toBe('Looks good');
      expect(result.review_status).toBe('approved');
    });

    it('should throw NotFoundException when assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment as any);
      assessmentRepo.findReviewerByUserId.mockResolvedValue({ id: 'reviewer-profile-1' });
      assessmentRepo.findAssessmentById.mockResolvedValueOnce(mockAssessment as any);
      assessmentRepo.findAssessmentById.mockResolvedValueOnce(null);

      auditRepo.findByAssessmentId.mockResolvedValue(mockAuditRecord);

      // Reset to make findAssessmentById return null on second call (in upsertReview body)
      assessmentRepo.findAssessmentById.mockReset();
      assessmentRepo.findAssessmentById.mockResolvedValueOnce(mockAssessment as any); // verifyReviewerAccess
      assessmentRepo.findAssessmentById.mockResolvedValueOnce(null); // upsertReview body

      await expect(
        service.upsertReview('assessment-1', { reviewSummary: 'test' }, 'reviewer-profile-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no audit record exists', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment as any);
      assessmentRepo.findReviewerByUserId.mockResolvedValue({ id: 'reviewer-profile-1' });
      auditRepo.findByAssessmentId.mockResolvedValue(null);

      await expect(
        service.upsertReview('assessment-1', { reviewSummary: 'test' }, 'reviewer-profile-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow saving partial review without reviewStatus', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment as any);
      assessmentRepo.findReviewerByUserId.mockResolvedValue({ id: 'reviewer-profile-1' });
      auditRepo.findByAssessmentId.mockResolvedValue(mockAuditRecord);
      auditRepo.upsertReview.mockResolvedValue({
        ...mockAuditRecord,
        review_summary: 'Draft notes',
        audit_lifecycle_status: 'in_progress',
      });

      const result = await service.upsertReview(
        'assessment-1',
        { reviewSummary: 'Draft notes' },
        'reviewer-profile-1',
      );

      expect(auditRepo.upsertReview).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewSummary: 'Draft notes',
          reviewStatus: undefined,
        }),
      );
      expect(result.audit_lifecycle_status).toBe('in_progress');
    });
  });

  describe('getAuditView – auditor/reviewer details', () => {
    it('should return auditor and reviewer names in auditRecord', async () => {
      const detailedRecord = {
        ...mockAuditRecord,
        audit_summary: 'Audit looks good',
        audit_summary_doc: 'https://docs.example.com/audit.pdf',
        review_summary: 'Confirmed compliance',
        review_summary_doc: 'https://docs.example.com/review.pdf',
        review_status: 'approved' as const,
        reviewed_by: 'reviewer-user-1',
        reviewed_at: new Date(),
        auditor_name: 'John Auditor',
        auditor_email: 'john@audit.com',
        auditor_signature: null,
        reviewer_name: 'Jane Reviewer',
        reviewer_email: 'jane@review.com',
        reviewer_signature: null,
      };

      auditRepo.getAssessmentInfo.mockResolvedValue(mockAssessmentInfo);
      auditRepo.getQuestionsWithAuditData.mockResolvedValue([]);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(detailedRecord);

      const result = await service.getAuditView('assessment-1');

      expect(result.auditRecord).not.toBeNull();
      expect(result.auditRecord!.auditor_name).toBe('John Auditor');
      expect(result.auditRecord!.auditor_email).toBe('john@audit.com');
      expect(result.auditRecord!.reviewer_name).toBe('Jane Reviewer');
      expect(result.auditRecord!.reviewer_email).toBe('jane@review.com');
      expect(result.auditRecord!.audit_summary).toBe('Audit looks good');
      expect(result.auditRecord!.audit_summary_doc).toBe('https://docs.example.com/audit.pdf');
      expect(result.auditRecord!.review_summary).toBe('Confirmed compliance');
      expect(result.auditRecord!.review_summary_doc).toBe('https://docs.example.com/review.pdf');
      expect(result.auditRecord!.review_status).toBe('approved');
    });

    it('should return null auditRecord when no audit exists', async () => {
      auditRepo.getAssessmentInfo.mockResolvedValue({
        ...mockAssessmentInfo,
        assessment_type: 'self_disclosure',
      });
      auditRepo.getQuestionsWithAuditData.mockResolvedValue([]);
      auditRepo.findByAssessmentIdWithDetails.mockResolvedValue(null);

      const result = await service.getAuditView('assessment-1');

      expect(result.auditRecord).toBeNull();
    });
  });

});

