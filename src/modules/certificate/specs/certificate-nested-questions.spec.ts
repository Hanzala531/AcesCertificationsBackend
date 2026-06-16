/**
 * Tests for Phase 1: Nested boolean sub-questions
 * Covers:
 *  - groupSubQuestions tree building (unit)
 *  - CertificateStructureService.addQuestions with nested sub-questions (unit)
 *  - CertificateStructureService.reorderItem (unit)
 *  - Regression: flat questions still work
 *  - Regression: non-boolean questions have empty yes/no arrays
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CertificateStructureService } from '../services/certificate-structure.service';
import { CertificateRepository } from '../certificate.repository';
import { SectionType, QuestionType } from '../types/certificate.types';
import { ReorderItemType } from '../dto/reorder-item.dto';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-top-1',
    certificate_id: 'cert-1',
    main_section_id: 'main-1',
    section_id: 'sec-1',
    sub_section_id: null,
    question: 'Is safety equipment present?',
    hint: null,
    type: QuestionType.BOOLEAN,
    is_third_level: false,
    criteria: null,
    options: null,
    rank: 1,
    score: 50,
    question_number: 1,
    certificate_question_number: 1,
    parent_question_id: null,
    parent_trigger_value: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── groupSubQuestions unit tests (tested via repository internals) ──────────
// We test the behaviour by calling findCertificateWithDetails indirectly,
// but the easiest unit-test is to verify the structure service wires things
// correctly. Pure tree-building logic is tested here via shaped mock data.

describe('groupSubQuestions – tree building', () => {
  /**
   * We validate the tree-building by checking that CertificateRepository
   * returns structured data. Since groupSubQuestions is a private module-
   * level function we test its effects through the public surface.
   *
   * For a pure unit test we inline equivalent logic.
   */

  function groupSubQuestions(questions: ReturnType<typeof makeQuestion>[]) {
    const yesMap = new Map<string, any[]>();
    const noMap = new Map<string, any[]>();
    const topLevel: any[] = [];

    for (const q of questions) {
      if (q.parent_question_id && q.parent_trigger_value) {
        const map = q.parent_trigger_value === 'yes' ? yesMap : noMap;
        const list = map.get(q.parent_question_id) || [];
        list.push(q);
        map.set(q.parent_question_id, list);
      } else {
        topLevel.push(q);
      }
    }

    const attachChildren = (q: any): any => ({
      ...q,
      yes_sub_questions: (yesMap.get(q.id) || []).map(attachChildren),
      no_sub_questions: (noMap.get(q.id) || []).map(attachChildren),
    });

    return topLevel.map(attachChildren);
  }

  it('returns flat list of top-level questions when there are no sub-questions', () => {
    const questions = [
      makeQuestion({ id: 'q1', rank: 1, question_number: 1 }),
      makeQuestion({ id: 'q2', rank: 2, question_number: 2, type: QuestionType.TEXT }),
    ];
    const result = groupSubQuestions(questions);
    expect(result).toHaveLength(2);
    expect(result[0].yes_sub_questions).toEqual([]);
    expect(result[0].no_sub_questions).toEqual([]);
  });

  it('attaches yes and no sub-questions to the correct parent', () => {
    const parent = makeQuestion({ id: 'parent-1', rank: 1 });
    const yesSub = makeQuestion({
      id: 'yes-sub-1',
      rank: 2,
      parent_question_id: 'parent-1',
      parent_trigger_value: 'yes',
    });
    const noSub = makeQuestion({
      id: 'no-sub-1',
      rank: 3,
      parent_question_id: 'parent-1',
      parent_trigger_value: 'no',
      type: QuestionType.TEXT,
    });

    const result = groupSubQuestions([parent, yesSub, noSub]);

    expect(result).toHaveLength(1);
    expect(result[0].yes_sub_questions).toHaveLength(1);
    expect(result[0].yes_sub_questions[0].id).toBe('yes-sub-1');
    expect(result[0].no_sub_questions).toHaveLength(1);
    expect(result[0].no_sub_questions[0].id).toBe('no-sub-1');
  });

  it('builds a 3-level boolean tree (grandparent → yes-child → yes-grandchild)', () => {
    const grandparent = makeQuestion({ id: 'gp', rank: 1 });
    const child = makeQuestion({
      id: 'child',
      rank: 2,
      parent_question_id: 'gp',
      parent_trigger_value: 'yes',
    });
    const grandchild = makeQuestion({
      id: 'gc',
      rank: 3,
      parent_question_id: 'child',
      parent_trigger_value: 'yes',
      type: QuestionType.NUMBER,
    });

    const result = groupSubQuestions([grandparent, child, grandchild]);

    expect(result).toHaveLength(1);
    const l1 = result[0];
    expect(l1.yes_sub_questions).toHaveLength(1);
    const l2 = l1.yes_sub_questions[0];
    expect(l2.id).toBe('child');
    expect(l2.yes_sub_questions).toHaveLength(1);
    expect(l2.yes_sub_questions[0].id).toBe('gc');
  });

  it('sub-questions are excluded from the top-level list', () => {
    const parent = makeQuestion({ id: 'parent-2', rank: 1 });
    const sub = makeQuestion({
      id: 'sub-2',
      rank: 2,
      parent_question_id: 'parent-2',
      parent_trigger_value: 'no',
    });
    const result = groupSubQuestions([parent, sub]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('parent-2');
  });

  it('questions with no parent still receive empty yes/no arrays', () => {
    const q = makeQuestion({ id: 'lone', type: QuestionType.TEXT });
    const result = groupSubQuestions([q]);
    expect(result[0].yes_sub_questions).toEqual([]);
    expect(result[0].no_sub_questions).toEqual([]);
  });
});

// ─── CertificateStructureService.addQuestions ────────────────────────────────

describe('CertificateStructureService – addQuestions with nested sub-questions', () => {
  let service: CertificateStructureService;
  let repo: jest.Mocked<CertificateRepository>;
  let mockClient: any;

  const certId = 'cert-1';
  const mainId = 'main-1';
  const secId = 'sec-1';
  const subSecId = 'subsec-1';

  const mockSection = {
    id: secId,
    certificate_id: certId,
    main_id: mainId,
    name: 'Safety Section',
    rank: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSubSection = {
    id: subSecId,
    certificate_id: certId,
    main_id: mainId,
    section_id: secId,
    name: 'Sub Section',
    rank: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockClient = { query: jest.fn() };

    const mockRepo = {
      beginTransaction: jest.fn().mockResolvedValue(mockClient),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      findSectionById: jest.fn().mockResolvedValue(mockSection),
      findSubSectionById: jest.fn().mockResolvedValue(mockSubSection),
      getMaxQuestionRankForSection: jest.fn().mockResolvedValue(0),
      getMaxQuestionNumberForSection: jest.fn().mockResolvedValue(0),
      getMaxCertificateQuestionNumber: jest.fn().mockResolvedValue(0),
      getMaxQuestionRankForSubSection: jest.fn().mockResolvedValue(0),
      getMaxQuestionNumberForSubSection: jest.fn().mockResolvedValue(0),
      shiftQuestionNumbersForSectionInsert: jest.fn().mockResolvedValue(undefined),
      shiftCertificateQuestionNumbersForInsert: jest.fn().mockResolvedValue(undefined),
      shiftQuestionNumbersForSubSectionInsert: jest.fn().mockResolvedValue(undefined),
      createQuestionForSection: jest.fn(),
      createQuestionForSubSection: jest.fn(),
      recalculateHierarchicalShortCodes: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateStructureService,
        { provide: CertificateRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CertificateStructureService>(CertificateStructureService);
    repo = module.get(CertificateRepository);

    // Default mock: createQuestion returns a new question with sequential id
    let callCount = 0;
    (repo.createQuestionForSection as jest.Mock).mockImplementation(() =>
      Promise.resolve({ id: `q-sec-${++callCount}`, question: 'Q', rank: callCount, score: 10 }),
    );
    (repo.createQuestionForSubSection as jest.Mock).mockImplementation(() =>
      Promise.resolve({ id: `q-sub-${++callCount}`, question: 'Q', rank: callCount, score: 10 }),
    );
  });

  it('creates only the top-level question when no sub-questions provided', async () => {
    await service.addQuestions(secId, {
      section_type: SectionType.SECTION,
      questions: [{ question: 'Is PPE worn?', type: QuestionType.BOOLEAN }],
    });

    expect(repo.createQuestionForSection).toHaveBeenCalledTimes(1);
    expect(repo.createQuestionForSection).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ question: 'Is PPE worn?' }),
    );
    // top-level question has no parent
    const callArg = (repo.createQuestionForSection as jest.Mock).mock.calls[0][1];
    expect(callArg.parent_question_id).toBeFalsy();
  });

  it('creates yes and no sub-questions under the parent (section)', async () => {
    await service.addQuestions(secId, {
      section_type: SectionType.SECTION,
      questions: [
        {
          question: 'Is equipment serviced?',
          type: QuestionType.BOOLEAN,
          yes_sub_questions: [{ question: 'By whom?', type: QuestionType.TEXT }],
          no_sub_questions: [{ question: 'When is booking?', type: QuestionType.TEXT }],
        },
      ],
    });

    // 1 parent + 1 yes + 1 no = 3 calls
    expect(repo.createQuestionForSection).toHaveBeenCalledTimes(3);

    const calls = (repo.createQuestionForSection as jest.Mock).mock.calls;
    const parentCall = calls[0][1];
    const yesCall = calls[1][1];
    const noCall = calls[2][1];

    expect(parentCall.parent_question_id).toBeUndefined();
    expect(yesCall.parent_trigger_value).toBe('yes');
    expect(noCall.parent_trigger_value).toBe('no');
    // yes/no sub-questions get the parent's id
    expect(yesCall.parent_question_id).toBe('q-sec-1');
    expect(noCall.parent_question_id).toBe('q-sec-1');
  });

  it('creates 3-level deep nesting (boolean → yes-boolean → yes-number)', async () => {
    await service.addQuestions(secId, {
      section_type: SectionType.SECTION,
      questions: [
        {
          question: 'Level 1 boolean',
          type: QuestionType.BOOLEAN,
          yes_sub_questions: [
            {
              question: 'Level 2 boolean',
              type: QuestionType.BOOLEAN,
              yes_sub_questions: [
                { question: 'Level 3 number', type: QuestionType.NUMBER },
              ],
            },
          ],
        },
      ],
    });

    // 1 + 1 + 1 = 3 total
    expect(repo.createQuestionForSection).toHaveBeenCalledTimes(3);

    const calls = (repo.createQuestionForSection as jest.Mock).mock.calls;
    const l1 = calls[0][1];
    const l2 = calls[1][1];
    const l3 = calls[2][1];

    expect(l1.parent_question_id).toBeUndefined();
    expect(l2.parent_question_id).toBe('q-sec-1'); // parent is l1
    expect(l2.parent_trigger_value).toBe('yes');
    expect(l3.parent_question_id).toBe('q-sec-2'); // parent is l2
    expect(l3.parent_trigger_value).toBe('yes');
  });

  it('creates nested sub-questions for sub_section type', async () => {
    await service.addQuestions(subSecId, {
      section_type: SectionType.SUB_SECTION,
      questions: [
        {
          question: 'Is fire extinguisher present?',
          type: QuestionType.BOOLEAN,
          yes_sub_questions: [{ question: 'Tag readable?', type: QuestionType.BOOLEAN }],
          no_sub_questions: [{ question: 'Booking date?', type: QuestionType.TEXT }],
        },
      ],
    });

    expect(repo.createQuestionForSubSection).toHaveBeenCalledTimes(3);

    const calls = (repo.createQuestionForSubSection as jest.Mock).mock.calls;
    expect(calls[1][1].parent_trigger_value).toBe('yes');
    expect(calls[2][1].parent_trigger_value).toBe('no');
  });

  it('throws NotFoundException when section not found', async () => {
    (repo.findSectionById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.addQuestions('nonexistent-sec', {
        section_type: SectionType.SECTION,
        questions: [{ question: 'Q', type: QuestionType.TEXT }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when sub-section not found', async () => {
    (repo.findSubSectionById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.addQuestions('nonexistent-subsec', {
        section_type: SectionType.SUB_SECTION,
        questions: [{ question: 'Q', type: QuestionType.TEXT }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rolls back transaction on unexpected DB error', async () => {
    (repo.createQuestionForSection as jest.Mock).mockRejectedValue(
      new Error('DB connection lost'),
    );

    await expect(
      service.addQuestions(secId, {
        section_type: SectionType.SECTION,
        questions: [{ question: 'Q', type: QuestionType.TEXT }],
      }),
    ).rejects.toThrow();

    expect(repo.rollbackTransaction).toHaveBeenCalledWith(mockClient);
  });

  it('auto-increments rank for sub-questions using shared counter', async () => {
    await service.addQuestions(secId, {
      section_type: SectionType.SECTION,
      questions: [
        {
          question: 'Parent boolean',
          type: QuestionType.BOOLEAN,
          yes_sub_questions: [{ question: 'Yes child', type: QuestionType.TEXT }],
          no_sub_questions: [{ question: 'No child', type: QuestionType.TEXT }],
        },
      ],
    });

    const calls = (repo.createQuestionForSection as jest.Mock).mock.calls;
    const ranks = calls.map((c: any[]) => c[1].rank);
    // Each rank must be strictly greater than the previous
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThan(ranks[i - 1]);
    }
  });
});

// ─── CertificateStructureService.reorderItem ─────────────────────────────────

describe('CertificateStructureService – reorderItem', () => {
  let service: CertificateStructureService;
  let repo: jest.Mocked<CertificateRepository>;
  let mockClient: any;

  const certId = 'cert-1';
  const mainId1 = 'main-1';
  const mainId2 = 'main-2';
  const secId = 'sec-1';
  const subSecId = 'subsec-1';
  const qId = 'q-1';

  const mockCertificate = { id: certId, name: 'Test Cert' };
  const mockSection = { id: secId, certificate_id: certId, main_id: mainId1, rank: 2 };
  const mockMainSection1 = { id: mainId1, certificate_id: certId, rank: 1 };
  const mockMainSection2 = { id: mainId2, certificate_id: certId, rank: 2 };
  const mockSubSection = { id: subSecId, certificate_id: certId, section_id: secId, main_id: mainId1, rank: 1 };
  const mockQuestion = { id: qId, certificate_id: certId, section_id: secId, sub_section_id: null, rank: 1 };

  beforeEach(async () => {
    mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    const mockRepo = {
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      beginTransaction: jest.fn().mockResolvedValue(mockClient),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      findSectionById: jest.fn().mockResolvedValue(mockSection),
      findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
      findSubSectionById: jest.fn().mockResolvedValue(mockSubSection),
      findQuestionById: jest.fn().mockResolvedValue(mockQuestion),
      recalculateCertificateQuestionNumbers: jest.fn().mockResolvedValue(undefined),
      recalculateHierarchicalShortCodes: jest.fn().mockResolvedValue(undefined),
      // reorder helpers
      shiftSectionRanksForDelete: jest.fn().mockResolvedValue(undefined),
      shiftSectionRanksForInsert: jest.fn().mockResolvedValue(undefined),
      updateSectionParentAndRank: jest.fn().mockResolvedValue(undefined),
      shiftSubSectionRanksForDelete: jest.fn().mockResolvedValue(undefined),
      shiftSubSectionRanksForInsert: jest.fn().mockResolvedValue(undefined),
      updateSubSectionParentAndRank: jest.fn().mockResolvedValue(undefined),
      shiftQuestionRanksForDelete: jest.fn().mockResolvedValue(undefined),
      shiftQuestionRanksForInsert: jest.fn().mockResolvedValue(undefined),
      updateQuestionParentAndRank: jest.fn().mockResolvedValue(undefined),
      renumberLocalQuestionNumbers: jest.fn().mockResolvedValue(undefined),
      nullifyLocalQuestionNumbers: jest.fn().mockResolvedValue(undefined),
      // cascade helpers
      cascadeSectionChildren: jest.fn().mockResolvedValue(undefined),
      cascadeSubSectionChildren: jest.fn().mockResolvedValue(undefined),
      // rank getters for auto-assign
      getMaxSectionRankForMainSection: jest.fn().mockResolvedValue(3),
      getMaxSubSectionRankForSection: jest.fn().mockResolvedValue(3),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateStructureService,
        { provide: CertificateRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CertificateStructureService>(CertificateStructureService);
    repo = module.get(CertificateRepository);
  });

  it('throws NotFoundException when certificate does not exist', async () => {
    (repo.findCertificateById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId,
        new_parent_id: mainId1,
        new_rank: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when section to reorder is not found', async () => {
    (repo.findSectionById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: 'nonexistent',
        new_parent_id: mainId1,
        new_rank: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when section belongs to different certificate', async () => {
    (repo.findSectionById as jest.Mock).mockResolvedValue({
      ...mockSection,
      certificate_id: 'other-cert',
    });

    await expect(
      service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId,
        new_parent_id: mainId1,
        new_rank: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('reorders section within same parent and commits', async () => {
    await service.reorderItem(certId, {
      item_type: ReorderItemType.SECTION,
      item_id: secId,
      new_parent_id: mainId1,
      new_rank: 3,
    });

    expect(mockClient.query).toHaveBeenCalled();
    expect(repo.commitTransaction).toHaveBeenCalledWith(mockClient);
    expect(repo.recalculateCertificateQuestionNumbers).toHaveBeenCalledWith(
      mockClient,
      certId,
    );
  });

  it('reorders section to a different parent main section', async () => {
    (repo.findMainSectionById as jest.Mock).mockResolvedValue(mockMainSection2);
    (repo.findSectionById as jest.Mock).mockResolvedValue({
      ...mockSection,
      main_id: mainId1, // different from new parent mainId2
    });

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SECTION,
      item_id: secId,
      new_parent_id: mainId2,
      new_rank: 1,
    });

    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('throws NotFoundException when new parent main section not found', async () => {
    (repo.findMainSectionById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId,
        new_parent_id: 'nonexistent-main',
        new_rank: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for invalid item_type', async () => {
    await expect(
      service.reorderItem(certId, {
        item_type: 'invalid_type' as any,
        item_id: secId,
        new_parent_id: mainId1,
        new_rank: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rolls back on error', async () => {
    (repo.findSectionById as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(
      service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId,
        new_parent_id: mainId1,
        new_rank: 1,
      }),
    ).rejects.toThrow();

    expect(repo.rollbackTransaction).toHaveBeenCalledWith(mockClient);
  });

  it('reorders sub-section and commits', async () => {
    (repo.findSubSectionById as jest.Mock).mockResolvedValue(mockSubSection);
    (repo.findSectionById as jest.Mock).mockResolvedValue(mockSection);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SUB_SECTION,
      item_id: subSecId,
      new_parent_id: secId,
      new_rank: 2,
    });

    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('reorders question and commits', async () => {
    (repo.findQuestionById as jest.Mock).mockResolvedValue(mockQuestion);
    (repo.findSectionById as jest.Mock).mockResolvedValue(mockSection);
    // reorderQuestion uses client.query directly to count questions for new_question_number
    mockClient.query.mockResolvedValue({ rows: [{ cnt: '3' }] });

    await service.reorderItem(certId, {
      item_type: ReorderItemType.QUESTION,
      item_id: qId,
      new_parent_id: secId,
      new_parent_type: 'section' as any,
      new_rank: 2,
    });

    expect(repo.commitTransaction).toHaveBeenCalled();
  });
});

// ─── Regression: existing flat question flows ────────────────────────────────

describe('Regression – flat question flows still work', () => {
  let service: CertificateStructureService;
  let repo: jest.Mocked<CertificateRepository>;
  let mockClient: any;

  const certId = 'cert-1';
  const mainId = 'main-1';
  const secId = 'sec-1';

  const mockSection = {
    id: secId,
    certificate_id: certId,
    main_id: mainId,
    name: 'Section',
    rank: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockClient = { query: jest.fn() };

    let callCount = 0;
    const mockRepo = {
      beginTransaction: jest.fn().mockResolvedValue(mockClient),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      findSectionById: jest.fn().mockResolvedValue(mockSection),
      getMaxQuestionRankForSection: jest.fn().mockResolvedValue(0),
      getMaxQuestionNumberForSection: jest.fn().mockResolvedValue(0),
      getMaxCertificateQuestionNumber: jest.fn().mockResolvedValue(0),
      shiftQuestionNumbersForSectionInsert: jest.fn().mockResolvedValue(undefined),
      shiftCertificateQuestionNumbersForInsert: jest.fn().mockResolvedValue(undefined),
      createQuestionForSection: jest.fn().mockImplementation(() =>
        Promise.resolve({ id: `q-${++callCount}`, question: 'Q', rank: callCount, score: 10 }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateStructureService,
        { provide: CertificateRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CertificateStructureService>(CertificateStructureService);
    repo = module.get(CertificateRepository);
  });

  it('adds multiple flat questions with auto-incrementing ranks', async () => {
    await service.addQuestions(secId, {
      section_type: SectionType.SECTION,
      questions: [
        { question: 'Q1', type: QuestionType.TEXT },
        { question: 'Q2', type: QuestionType.NUMBER },
        { question: 'Q3', type: QuestionType.FILE },
      ],
    });

    expect(repo.createQuestionForSection).toHaveBeenCalledTimes(3);

    const ranks = (repo.createQuestionForSection as jest.Mock).mock.calls.map(
      (c: any[]) => c[1].rank,
    );
    expect(ranks).toEqual([1, 2, 3]);
  });

  it('passes options to multiple_choice and checkbox questions', async () => {
    const options = ['Option A', 'Option B', 'Option C'];

    await service.addQuestions(secId, {
      section_type: SectionType.SECTION,
      questions: [{ question: 'Pick one', type: QuestionType.MULTIPLE_CHOICE, options }],
    });

    expect(repo.createQuestionForSection).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ options }),
    );
  });

  it('passes score and criteria to the repository', async () => {
    await service.addQuestions(secId, {
      section_type: SectionType.SECTION,
      questions: [
        {
          question: 'Weighted Q',
          type: QuestionType.BOOLEAN,
          score: 100,
          criteria: 'Must be compliant',
        },
      ],
    });

    expect(repo.createQuestionForSection).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ score: 100, criteria: 'Must be compliant' }),
    );
  });
});
