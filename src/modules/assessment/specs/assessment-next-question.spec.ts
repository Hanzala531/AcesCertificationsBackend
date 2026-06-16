/**
 * Tests for GET /assessments/:assessmentId/next-question
 *
 * Covers: unit, integration (service-level), regression, and system scenarios.
 *
 * Skip logic rules:
 *  1. No current_question_id → return first top-level question
 *  2. Boolean + answer="yes" → follow yes_sub_questions chain
 *  3. Boolean + answer="no"  → follow no_sub_questions chain
 *  4. Sub-question exhausted  → jump to next top-level after the parent
 *  5. Other branch's sub-questions are never shown
 *  6. Non-boolean top-level → always advance to next top-level
 *  7. Last question answered → { done: true, question: null }
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssessmentService } from '../services/assessment.service';
import { AssessmentRepository } from '../assessment.repository';
import { PaymentService } from '../../payment/payment.service';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';
import { AiReviewService } from '../../ai-review/services/ai-review.service';
import { AiReviewRepository } from '../../ai-review/ai-review.repository';
import { AssessmentNotificationService } from '../services/assessment-notification.service';
import { BadgeRepository } from '../../notification/badge.repository';
import { ChatService } from '../../chat/chat.service';
import { ScoreCalculationService } from '../../certificate/services/score-calculation.service';

// ─── helpers ────────────────────────────────────────────────────────────────

const UUID = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const ASSESSMENT_ID = UUID(1);
const CERT_ID = UUID(2);

type RawQuestion = {
  id: string;
  question: string;
  type: string;
  hint: string | null;
  criteria: string | null;
  options: string[] | null;
  score: number;
  question_number: number;
  certificate_question_number: number;
  parent_question_id: string | null;
  parent_trigger_value: 'yes' | 'no' | null;
  rank: number;
};

const makeQ = (
  n: number,
  overrides: Partial<RawQuestion> = {},
): RawQuestion => ({
  id: UUID(100 + n),
  question: `Question ${n}`,
  type: 'text',
  hint: null,
  criteria: null,
  options: null,
  score: 10,
  question_number: n,
  certificate_question_number: n,
  parent_question_id: null,
  parent_trigger_value: null,
  rank: n,
  ...overrides,
});

// ─── factory: build a service with a fixed question list ─────────────────────

async function buildService(questions: RawQuestion[]) {
  // db mock: first call returns the assessment row, second returns questions
  let callCount = 0;
  const dbQuery = jest.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({ rows: [{ certificate_id: CERT_ID }] });
    }
    return Promise.resolve({ rows: questions });
  });

  const mockAssessmentRepo = {
    db: { query: dbQuery },
    // other methods needed by service constructor
    createAssessment: jest.fn(),
    findAssessmentById: jest.fn(),
    findAssessmentWithDetails: jest.fn(),
    findAssessmentsByOrganization: jest.fn(),
    findLatestSelfDisclosureByOrganization: jest.fn(),
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
    findCompletedSelfDisclosureAssessment: jest.fn(),
    findAuditorByUserId: jest.fn(),
    findReviewerByUserId: jest.fn(),
    findSubadminByUserId: jest.fn(),
    findAssessmentsByReviewer: jest.fn(),
    findAssessmentsByAuditor: jest.fn(),
    submitAnswers: jest.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AssessmentService,
      { provide: AssessmentRepository, useValue: mockAssessmentRepo },
      { provide: PaymentService, useValue: { verifyPaymentForAssessment: jest.fn() } },
      { provide: OrganizationRepository, useValue: { findByUserId: jest.fn() } },
      { provide: EmployeeRepository, useValue: { findByUserId: jest.fn() } },
      { provide: AiReviewService, useValue: { triggerAiReview: jest.fn(), getAiReviewForAssessment: jest.fn() } },
      { provide: AiReviewRepository, useValue: { findAiReviewByAssessmentId: jest.fn(), createAiReview: jest.fn(), updateAiReviewStatus: jest.fn(), updateScore: jest.fn(), updateScoreSummary: jest.fn(), deleteAiReview: jest.fn() } },
      { provide: AssessmentNotificationService, useValue: { sendAssessmentSubmittedNotification: jest.fn(), sendAssessmentSubmissionNotification: jest.fn().mockResolvedValue(undefined) } },
      { provide: BadgeRepository, useValue: { findBadgeByOrganizationAndCertificate: jest.fn() } },
      { provide: ScoreCalculationService, useValue: { buildScoreInputsFromAnswers: jest.fn(), calculateCertificateScore: jest.fn() } },
      { provide: ChatService, useValue: { createThreadForAssuredAssessment: jest.fn() } },
    ],
  }).compile();

  const service = module.get<AssessmentService>(AssessmentService);
  // reset call count before each getNextQuestion invocation so callers can call buildService
  // once and then reset manually — for simplicity each test calls buildService fresh.
  return { service, dbQuery };
}

// ─── test suite ──────────────────────────────────────────────────────────────

describe('AssessmentService.getNextQuestion', () => {
  // ── Unit: happy-path navigation ──────────────────────────────────────────

  describe('Unit: first question', () => {
    it('returns first top-level question when no current_question_id', async () => {
      const q1 = makeQ(1);
      const q2 = makeQ(2);
      const { service } = await buildService([q1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID);

      expect(result.done).toBe(false);
      expect(result.question).toMatchObject({ id: q1.id, question: q1.question });
    });

    it('returns { done: true, question: null } when certificate has no questions', async () => {
      const { service } = await buildService([]);

      const result = await service.getNextQuestion(ASSESSMENT_ID);

      expect(result).toEqual({ done: true, question: null });
    });
  });

  describe('Unit: linear (non-boolean) navigation', () => {
    it('advances to next top-level question after a text question', async () => {
      const q1 = makeQ(1, { type: 'text' });
      const q2 = makeQ(2, { type: 'text' });
      const { service } = await buildService([q1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id);

      expect(result.done).toBe(false);
      expect(result.question).toMatchObject({ id: q2.id });
    });

    it('returns done=true after last top-level question', async () => {
      const q1 = makeQ(1, { type: 'text' });
      const { service } = await buildService([q1]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id);

      expect(result).toEqual({ done: true, question: null });
    });

    it('includes yes_sub_questions and no_sub_questions arrays (empty) in response', async () => {
      const q1 = makeQ(1, { type: 'number' });
      const { service } = await buildService([q1]);

      const result = await service.getNextQuestion(ASSESSMENT_ID);

      expect(result.question).toMatchObject({
        yes_sub_questions: [],
        no_sub_questions: [],
      });
    });
  });

  describe('Unit: boolean skip logic — yes branch', () => {
    // Structure: q1 (boolean) → yes: q1y1 → next top-level: q2
    //                         → no:  q1n1  (never shown when answer=yes)
    let q1: RawQuestion, q1y1: RawQuestion, q1n1: RawQuestion, q2: RawQuestion;

    beforeEach(() => {
      q1   = makeQ(1, { type: 'boolean', certificate_question_number: 1 });
      q1y1 = makeQ(2, { parent_question_id: q1.id, parent_trigger_value: 'yes', certificate_question_number: 2 });
      q1n1 = makeQ(3, { parent_question_id: q1.id, parent_trigger_value: 'no',  certificate_question_number: 3 });
      q2   = makeQ(4, { certificate_question_number: 4 });
    });

    it('returns first yes sub-question when boolean answered "yes"', async () => {
      const { service } = await buildService([q1, q1y1, q1n1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'yes');

      expect(result.done).toBe(false);
      expect(result.question?.id).toBe(q1y1.id);
      expect(result.question?.parent_trigger_value).toBe('yes');
    });

    it('skips no-branch sub-question when answer is "yes"', async () => {
      const { service } = await buildService([q1, q1y1, q1n1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'yes');

      // Must never return the "no" sub-question
      expect(result.question?.id).not.toBe(q1n1.id);
    });

    it('after yes sub-question chain ends → jumps to next top-level', async () => {
      const { service } = await buildService([q1, q1y1, q1n1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1y1.id);

      expect(result.done).toBe(false);
      expect(result.question?.id).toBe(q2.id);
    });

    it('done=true after last top-level when boolean is last question', async () => {
      const { service } = await buildService([q1, q1y1, q1n1]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1y1.id);

      expect(result).toEqual({ done: true, question: null });
    });
  });

  describe('Unit: boolean skip logic — no branch', () => {
    let q1: RawQuestion, q1y1: RawQuestion, q1n1: RawQuestion, q2: RawQuestion;

    beforeEach(() => {
      q1   = makeQ(1, { type: 'boolean', certificate_question_number: 1 });
      q1y1 = makeQ(2, { parent_question_id: q1.id, parent_trigger_value: 'yes', certificate_question_number: 2 });
      q1n1 = makeQ(3, { parent_question_id: q1.id, parent_trigger_value: 'no',  certificate_question_number: 3 });
      q2   = makeQ(4, { certificate_question_number: 4 });
    });

    it('returns first no sub-question when boolean answered "no"', async () => {
      const { service } = await buildService([q1, q1y1, q1n1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'no');

      expect(result.done).toBe(false);
      expect(result.question?.id).toBe(q1n1.id);
      expect(result.question?.parent_trigger_value).toBe('no');
    });

    it('skips yes-branch sub-question when answer is "no"', async () => {
      const { service } = await buildService([q1, q1y1, q1n1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'no');

      expect(result.question?.id).not.toBe(q1y1.id);
    });

    it('after no sub-question chain ends → jumps to next top-level', async () => {
      const { service } = await buildService([q1, q1y1, q1n1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1n1.id);

      expect(result.done).toBe(false);
      expect(result.question?.id).toBe(q2.id);
    });
  });

  describe('Unit: boolean with no sub-questions for chosen branch', () => {
    it('skips directly to next top-level when yes-branch has no sub-questions', async () => {
      const q1 = makeQ(1, { type: 'boolean' });
      const q1n1 = makeQ(2, { parent_question_id: q1.id, parent_trigger_value: 'no' });
      const q2 = makeQ(3);
      const { service } = await buildService([q1, q1n1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'yes');

      expect(result.question?.id).toBe(q2.id);
    });

    it('skips directly to next top-level when no-branch has no sub-questions', async () => {
      const q1 = makeQ(1, { type: 'boolean' });
      const q1y1 = makeQ(2, { parent_question_id: q1.id, parent_trigger_value: 'yes' });
      const q2 = makeQ(3);
      const { service } = await buildService([q1, q1y1, q2]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'no');

      expect(result.question?.id).toBe(q2.id);
    });
  });

  describe('Unit: multiple yes sub-questions (sequential)', () => {
    it('advances through multiple yes sub-questions in order', async () => {
      const q1 = makeQ(1, { type: 'boolean' });
      const q1y1 = makeQ(2, { parent_question_id: q1.id, parent_trigger_value: 'yes', rank: 1 });
      const q1y2 = makeQ(3, { parent_question_id: q1.id, parent_trigger_value: 'yes', rank: 2 });
      const q1y3 = makeQ(4, { parent_question_id: q1.id, parent_trigger_value: 'yes', rank: 3 });
      const q2 = makeQ(5);
      const { service } = await buildService([q1, q1y1, q1y2, q1y3, q2]);

      // Step 1: boolean answered yes → q1y1
      const r1 = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'yes');
      expect(r1.question?.id).toBe(q1y1.id);

      // Step 2: after q1y1 → q1y2
      const r2 = await service.getNextQuestion(ASSESSMENT_ID, q1y1.id);
      expect(r2.question?.id).toBe(q1y2.id);

      // Step 3: after q1y2 → q1y3
      const r3 = await service.getNextQuestion(ASSESSMENT_ID, q1y2.id);
      expect(r3.question?.id).toBe(q1y3.id);

      // Step 4: after last sub-question → next top-level
      const r4 = await service.getNextQuestion(ASSESSMENT_ID, q1y3.id);
      expect(r4.question?.id).toBe(q2.id);
    });
  });

  describe('Unit: response shape', () => {
    it('question response includes all required fields', async () => {
      const q1 = makeQ(1, {
        type: 'boolean',
        hint: 'Some hint',
        criteria: 'Some criteria',
        options: null,
        score: 30,
        question_number: 1,
        certificate_question_number: 1,
      });
      const { service } = await buildService([q1]);

      const result = await service.getNextQuestion(ASSESSMENT_ID);

      expect(result.question).toMatchObject({
        id: q1.id,
        question: q1.question,
        type: 'boolean',
        hint: 'Some hint',
        criteria: 'Some criteria',
        options: null,
        score: 30,
        question_number: 1,
        certificate_question_number: 1,
        parent_question_id: null,
        parent_trigger_value: null,
        yes_sub_questions: expect.any(Array),
        no_sub_questions: expect.any(Array),
      });
    });

    it('sub-question response includes parent_question_id and parent_trigger_value', async () => {
      const q1 = makeQ(1, { type: 'boolean' });
      const q1y1 = makeQ(2, { parent_question_id: q1.id, parent_trigger_value: 'yes' });
      const { service } = await buildService([q1, q1y1]);

      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'yes');

      expect(result.question).toMatchObject({
        parent_question_id: q1.id,
        parent_trigger_value: 'yes',
      });
    });

    it('question with multiple_choice type includes options array', async () => {
      const q1 = makeQ(1, { type: 'multiple_choice', options: ['A', 'B', 'C'] });
      const { service } = await buildService([q1]);

      const result = await service.getNextQuestion(ASSESSMENT_ID);

      expect(result.question?.options).toEqual(['A', 'B', 'C']);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('throws NotFoundException when assessment does not exist', async () => {
      const dbQuery = jest.fn().mockResolvedValue({ rows: [] });
      const mockAssessmentRepo = {
        db: { query: dbQuery },
        createAssessment: jest.fn(),
        findAssessmentById: jest.fn(),
        findAssessmentWithDetails: jest.fn(),
        findAssessmentsByOrganization: jest.fn(),
        findLatestSelfDisclosureByOrganization: jest.fn(),
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
        findCompletedSelfDisclosureAssessment: jest.fn(),
        findAuditorByUserId: jest.fn(),
        findReviewerByUserId: jest.fn(),
        findSubadminByUserId: jest.fn(),
        findAssessmentsByReviewer: jest.fn(),
        findAssessmentsByAuditor: jest.fn(),
        submitAnswers: jest.fn(),
      };

      const module = await Test.createTestingModule({
        providers: [
          AssessmentService,
          { provide: AssessmentRepository, useValue: mockAssessmentRepo },
          { provide: PaymentService, useValue: { verifyPaymentForAssessment: jest.fn() } },
          { provide: OrganizationRepository, useValue: { findByUserId: jest.fn() } },
          { provide: EmployeeRepository, useValue: { findByUserId: jest.fn() } },
          { provide: AiReviewService, useValue: { triggerAiReview: jest.fn(), getAiReviewForAssessment: jest.fn() } },
          { provide: AiReviewRepository, useValue: { findAiReviewByAssessmentId: jest.fn(), createAiReview: jest.fn(), updateAiReviewStatus: jest.fn(), updateScore: jest.fn(), deleteAiReview: jest.fn() } },
          { provide: AssessmentNotificationService, useValue: { sendAssessmentSubmittedNotification: jest.fn(), sendAssessmentSubmissionNotification: jest.fn().mockResolvedValue(undefined) } },
          { provide: BadgeRepository, useValue: { findBadgeByOrganizationAndCertificate: jest.fn() } },
          { provide: ScoreCalculationService, useValue: { buildScoreInputsFromAnswers: jest.fn(), calculateCertificateScore: jest.fn() } },
          { provide: ChatService, useValue: { createThreadForAssuredAssessment: jest.fn() } },
        ],
      }).compile();

      const service = module.get<AssessmentService>(AssessmentService);

      await expect(
        service.getNextQuestion('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when current_question_id is not in certificate', async () => {
      const q1 = makeQ(1);
      const { service } = await buildService([q1]);

      await expect(
        service.getNextQuestion(ASSESSMENT_ID, UUID(999)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Integration: full question flow simulation ────────────────────────────

  describe('Integration: full assessment walk-through', () => {
    /**
     * Certificate structure:
     *   Q1 (boolean)
     *     └─ yes → Q1Y1 (text)
     *     └─ no  → Q1N1 (text)
     *   Q2 (text)
     *   Q3 (boolean)
     *     └─ yes → Q3Y1 → Q3Y2
     *   Q4 (number)
     */
    let questions: RawQuestion[];
    let q1: RawQuestion, q1y1: RawQuestion, q1n1: RawQuestion;
    let q2: RawQuestion;
    let q3: RawQuestion, q3y1: RawQuestion, q3y2: RawQuestion;
    let q4: RawQuestion;

    beforeEach(() => {
      q1   = makeQ(1, { type: 'boolean',  certificate_question_number: 1 });
      q1y1 = makeQ(10, { parent_question_id: q1.id,  parent_trigger_value: 'yes', certificate_question_number: 2, rank: 1 });
      q1n1 = makeQ(11, { parent_question_id: q1.id,  parent_trigger_value: 'no',  certificate_question_number: 3, rank: 1 });
      q2   = makeQ(2, { type: 'text',    certificate_question_number: 4 });
      q3   = makeQ(3, { type: 'boolean', certificate_question_number: 5 });
      q3y1 = makeQ(12, { parent_question_id: q3.id,  parent_trigger_value: 'yes', certificate_question_number: 6, rank: 1 });
      q3y2 = makeQ(13, { parent_question_id: q3.id,  parent_trigger_value: 'yes', certificate_question_number: 7, rank: 2 });
      q4   = makeQ(4, { type: 'number',  certificate_question_number: 8 });
      questions = [q1, q1y1, q1n1, q2, q3, q3y1, q3y2, q4];
    });

    it('full walk-through answering "yes" to all booleans', async () => {
      // Start
      const { service: s0 } = await buildService(questions);
      const r0 = await s0.getNextQuestion(ASSESSMENT_ID);
      expect(r0.question?.id).toBe(q1.id); // Q1

      const { service: s1 } = await buildService(questions);
      const r1 = await s1.getNextQuestion(ASSESSMENT_ID, q1.id, 'yes');
      expect(r1.question?.id).toBe(q1y1.id); // Q1Y1

      const { service: s2 } = await buildService(questions);
      const r2 = await s2.getNextQuestion(ASSESSMENT_ID, q1y1.id);
      expect(r2.question?.id).toBe(q2.id); // Q2 (branch exhausted → next top-level)

      const { service: s3 } = await buildService(questions);
      const r3 = await s3.getNextQuestion(ASSESSMENT_ID, q2.id);
      expect(r3.question?.id).toBe(q3.id); // Q3

      const { service: s4 } = await buildService(questions);
      const r4 = await s4.getNextQuestion(ASSESSMENT_ID, q3.id, 'yes');
      expect(r4.question?.id).toBe(q3y1.id); // Q3Y1

      const { service: s5 } = await buildService(questions);
      const r5 = await s5.getNextQuestion(ASSESSMENT_ID, q3y1.id);
      expect(r5.question?.id).toBe(q3y2.id); // Q3Y2

      const { service: s6 } = await buildService(questions);
      const r6 = await s6.getNextQuestion(ASSESSMENT_ID, q3y2.id);
      expect(r6.question?.id).toBe(q4.id); // Q4

      const { service: s7 } = await buildService(questions);
      const r7 = await s7.getNextQuestion(ASSESSMENT_ID, q4.id);
      expect(r7).toEqual({ done: true, question: null }); // Done
    });

    it('full walk-through answering "no" to first boolean skips yes branch', async () => {
      const { service } = await buildService(questions);

      const r1 = await service.getNextQuestion(ASSESSMENT_ID, q1.id, 'no');
      // Should go to Q1N1 (no branch), NOT Q1Y1
      expect(r1.question?.id).toBe(q1n1.id);
      expect(r1.question?.id).not.toBe(q1y1.id);
    });

    it('yes branch questions are absent from no-branch walk', async () => {
      // After no-branch sub-question → jump to q2
      const { service } = await buildService(questions);
      const r = await service.getNextQuestion(ASSESSMENT_ID, q1n1.id);
      expect(r.question?.id).toBe(q2.id);
    });
  });

  // ── Regression: existing non-boolean flows unaffected ────────────────────

  describe('Regression: non-boolean flows', () => {
    it('text → text → text advances linearly', async () => {
      const q1 = makeQ(1, { type: 'text' });
      const q2 = makeQ(2, { type: 'text' });
      const q3 = makeQ(3, { type: 'text' });

      const { service: s1 } = await buildService([q1, q2, q3]);
      expect((await s1.getNextQuestion(ASSESSMENT_ID)).question?.id).toBe(q1.id);

      const { service: s2 } = await buildService([q1, q2, q3]);
      expect((await s2.getNextQuestion(ASSESSMENT_ID, q1.id)).question?.id).toBe(q2.id);

      const { service: s3 } = await buildService([q1, q2, q3]);
      expect((await s3.getNextQuestion(ASSESSMENT_ID, q2.id)).question?.id).toBe(q3.id);

      const { service: s4 } = await buildService([q1, q2, q3]);
      expect(await s4.getNextQuestion(ASSESSMENT_ID, q3.id)).toEqual({ done: true, question: null });
    });

    it('number, rating, checkbox types advance to next top-level normally', async () => {
      for (const type of ['number', 'rating', 'checkbox']) {
        const q1 = makeQ(1, { type });
        const q2 = makeQ(2, { type: 'text' });
        const { service } = await buildService([q1, q2]);

        const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id);
        expect(result.question?.id).toBe(q2.id);
      }
    });

    it('boolean without answer param skips sub-questions and advances to next top-level', async () => {
      const q1 = makeQ(1, { type: 'boolean' });
      const q1y1 = makeQ(2, { parent_question_id: q1.id, parent_trigger_value: 'yes' });
      const q2 = makeQ(3);
      const { service } = await buildService([q1, q1y1, q2]);

      // No answer param provided
      const result = await service.getNextQuestion(ASSESSMENT_ID, q1.id);

      expect(result.question?.id).toBe(q2.id);
    });
  });

  // ── System: database query verification ──────────────────────────────────

  describe('System: database interactions', () => {
    it('queries the assessment table with the correct assessmentId', async () => {
      const q1 = makeQ(1);
      const { service, dbQuery } = await buildService([q1]);

      await service.getNextQuestion(ASSESSMENT_ID);

      expect(dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('certificate_assessments'),
        [ASSESSMENT_ID],
      );
    });

    it('queries questions table with the correct certificate_id', async () => {
      const q1 = makeQ(1);
      const { service, dbQuery } = await buildService([q1]);

      await service.getNextQuestion(ASSESSMENT_ID);

      expect(dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('questions'),
        expect.arrayContaining([CERT_ID]),
      );
    });

    it('orders questions by certificate_question_number ASC', async () => {
      // Deliberately supply questions out of order in the mock — the service
      // trusts the DB order, so this verifies the ORDER BY is in the query.
      const q3 = makeQ(3, { certificate_question_number: 3 });
      const q1 = makeQ(1, { certificate_question_number: 1 });
      const q2 = makeQ(2, { certificate_question_number: 2 });
      const { service, dbQuery } = await buildService([q1, q2, q3]);

      // The SQL in the service must include ORDER BY certificate_question_number
      await service.getNextQuestion(ASSESSMENT_ID);
      const questionQuery = dbQuery.mock.calls[1]?.[0] ?? '';
      expect(questionQuery).toMatch(/ORDER BY.*certificate_question_number/i);
    });
  });
});
