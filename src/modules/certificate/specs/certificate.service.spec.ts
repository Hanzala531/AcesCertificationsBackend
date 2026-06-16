import { Test, TestingModule } from '@nestjs/testing';
import { CertificateQueryService } from '../services/certificate-query.service';
import { CertificateStructureService } from '../services/certificate-structure.service';
import { CertificateRepository } from '../certificate.repository';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';
import { CacheService } from '../../../common/services/cache.service';
import { QuestionType } from '../types/certificate.types';

describe('CertificateService - Question Numbering', () => {
  let queryService: CertificateQueryService;
  let structureService: CertificateStructureService;
  let certificateRepo: jest.Mocked<CertificateRepository>;

  const mockCertificateId = '550e8400-e29b-41d4-a716-446655440000';
  const mockMainSectionId = '550e8400-e29b-41d4-a716-446655440001';
  const mockSectionId = '550e8400-e29b-41d4-a716-446655440002';
  const mockSubSectionId = '550e8400-e29b-41d4-a716-446655440003';
  const mockQuestionId1 = '550e8400-e29b-41d4-a716-446655440010';
  const mockQuestionId2 = '550e8400-e29b-41d4-a716-446655440011';
  const mockQuestionId3 = '550e8400-e29b-41d4-a716-446655440012';

  const mockCertificate = {
    id: mockCertificateId,
    certificate_id: mockCertificateId,
    name: 'Test Certificate',
    short_code: 'EW',
    disclosure_price: 0,
    is_published: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockMainSection = {
    id: mockMainSectionId,
    certificate_id: mockCertificateId,
    name: 'Main Section 1',
    short_code: 'EW1',
    rank: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSection = {
    id: mockSectionId,
    certificate_id: mockCertificateId,
    main_id: mockMainSectionId,
    name: 'Section 1',
    short_code: 'EW1.1',
    rank: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSubSection = {
    id: mockSubSectionId,
    certificate_id: mockCertificateId,
    main_id: mockMainSectionId,
    section_id: mockSectionId,
    name: 'Sub Section 1',
    short_code: 'EW1.1.1',
    rank: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockQuestion1 = {
    id: mockQuestionId1,
    certificate_id: mockCertificateId,
    main_section_id: mockMainSectionId,
    section_id: mockSectionId,
    sub_section_id: null,
    question: 'Question 1',
    short_code: 'EW1.1.0.1',
    hint: undefined,
    type: QuestionType.TEXT,
    is_third_level: false,
    rank: 1,
    score: 10,
    question_number: 1,
    certificate_question_number: 1,
    criteria: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockQuestion2 = {
    id: mockQuestionId2,
    certificate_id: mockCertificateId,
    main_section_id: mockMainSectionId,
    section_id: mockSectionId,
    sub_section_id: null,
    question: 'Question 2',
    short_code: 'EW1.1.0.2',
    hint: undefined,
    type: QuestionType.TEXT,
    is_third_level: false,
    rank: 2,
    score: 10,
    question_number: 2,
    certificate_question_number: 2,
    criteria: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockQuestion3 = {
    id: mockQuestionId3,
    certificate_id: mockCertificateId,
    main_section_id: mockMainSectionId,
    section_id: mockSectionId,
    sub_section_id: mockSubSectionId,
    question: 'Question 3',
    short_code: 'EW1.1.1.1',
    hint: undefined,
    type: QuestionType.TEXT,
    is_third_level: true,
    rank: 1,
    score: 10,
    question_number: 1,
    certificate_question_number: 3,
    criteria: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockCertificateRepository = {
      findCertificateById: jest.fn(),
      findQuestionById: jest.fn(),
      // answer-existence guards (default: no answers, so guards are no-ops)
      countAnswersForQuestionTree: jest.fn().mockResolvedValue(0),
      countAnswersByStructural: jest.fn().mockResolvedValue(0),
      findQuestionBySectionNumber: jest.fn(),
      findQuestionBySubSectionNumber: jest.fn(),
      findQuestionByCertificateNumber: jest.fn(),
      findMainSectionById: jest.fn(),
      findMainSectionByRank: jest.fn(),
      findSectionByRank: jest.fn(),
      findSubSectionByRank: jest.fn(),
      findMainSectionByName: jest.fn(),
      findSectionByName: jest.fn(),
      findSectionByNameInCertificate: jest.fn(),
      findSubSectionByName: jest.fn(),
      findSubSectionByNameInCertificate: jest.fn(),
      findSectionById: jest.fn(),
      findSubSectionById: jest.fn(),
      countQuestionsInSection: jest.fn(),
      countQuestionsInSubSection: jest.fn(),
      countQuestionsInCertificate: jest.fn(),
      getMainSectionChildren: jest.fn(),
      getSectionChildren: jest.fn(),
      getSubSectionQuestions: jest.fn(),
      getSectionQuestions: jest.fn(),
      getMainSectionFullTree: jest.fn(),
      getSectionFullTree: jest.fn(),
      getMaxMainSectionRank: jest.fn(),
      getMaxSectionRank: jest.fn(),
      getMaxSubSectionRank: jest.fn(),
      getMaxQuestionRankForSection: jest.fn(),
      getMaxQuestionRankForSubSection: jest.fn(),
      getMaxQuestionNumberForSection: jest.fn(),
      getMaxQuestionNumberForSubSection: jest.fn(),
      getMaxCertificateQuestionNumber: jest.fn(),
      createMainSection: jest.fn(),
      createSection: jest.fn(),
      createSubSection: jest.fn(),
      createQuestionForSection: jest.fn(),
      createQuestionForSubSection: jest.fn(),
      getQuestionChildrenByTrigger: jest.fn(),
      deleteQuestion: jest.fn(),
      updateQuestion: jest.fn(),
      updateMainSection: jest.fn(),
      updateSection: jest.fn(),
      updateSubSection: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      recalculateHierarchicalShortCodes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateQueryService,
        CertificateStructureService,
        {
          provide: CertificateRepository,
          useValue: mockCertificateRepository,
        },
        {
          provide: OrganizationRepository,
          useValue: {},
        },
        {
          provide: EmployeeRepository,
          useValue: {},
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            getOrSet: jest.fn().mockImplementation((_key, _ttl, factory) => factory()),
            invalidate: jest.fn(),
            invalidatePrefix: jest.fn(),
          },
        },
      ],
    }).compile();

    queryService = module.get<CertificateQueryService>(CertificateQueryService);
    structureService = module.get<CertificateStructureService>(CertificateStructureService);
    certificateRepo = module.get(CertificateRepository);
  });

  describe('Adding Questions', () => {
    it('should create hierarchy short codes exactly from the admin root code', async () => {
      const mockClient = { query: jest.fn() } as any;

      certificateRepo.findCertificateById.mockResolvedValue(mockCertificate as any);
      certificateRepo.beginTransaction.mockResolvedValue(mockClient);
      certificateRepo.getMaxMainSectionRank.mockResolvedValue(0);
      certificateRepo.createMainSection.mockResolvedValue({
        id: mockMainSectionId,
        name: 'Environment & Waste',
        short_code: 'EW1',
        rank: 1,
      } as any);

      const mainSections = await structureService.createMainSections(
        mockCertificateId,
        {
          sections: [{ name: 'Environment & Waste' }],
        } as any,
      );

      expect(mainSections[0].short_code).toBe('EW1');
      expect(certificateRepo.createMainSection).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ short_code: 'EW1', rank: 1 }),
      );

      certificateRepo.findMainSectionById.mockResolvedValue(mockMainSection as any);
      certificateRepo.getMaxSectionRank.mockResolvedValue(0);
      certificateRepo.createSection.mockResolvedValue({
        id: mockSectionId,
        name: 'Section 1',
        short_code: 'EW1.1',
        rank: 1,
      } as any);

      const sections = await structureService.createSubsections(
        mockMainSectionId,
        {
          parent_type: 'main',
          sections: [{ name: 'Section 1' }],
        } as any,
      );

      expect(sections[0].short_code).toBe('EW1.1');
      expect(certificateRepo.createSection).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ short_code: 'EW1.1', rank: 1 }),
      );

      certificateRepo.findSectionById.mockResolvedValue(mockSection as any);
      certificateRepo.getMaxSubSectionRank.mockResolvedValue(0);
      certificateRepo.createSubSection.mockResolvedValue({
        id: mockSubSectionId,
        name: 'Subsection 1',
        short_code: 'EW1.1.1',
        rank: 1,
      } as any);

      const subSections = await structureService.createSubsections(
        mockSectionId,
        {
          parent_type: 'section',
          sections: [{ name: 'Subsection 1' }],
        } as any,
      );

      expect(subSections[0].short_code).toBe('EW1.1.1');
      expect(certificateRepo.createSubSection).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ short_code: 'EW1.1.1', rank: 1 }),
      );
    });

    it('should allow adding a boolean question to a section', async () => {
      certificateRepo.findSectionById.mockResolvedValue(mockSection);
      certificateRepo.getMaxQuestionRankForSection.mockResolvedValue(1);
      certificateRepo.getMaxQuestionNumberForSection.mockResolvedValue(1);
      certificateRepo.getMaxCertificateQuestionNumber.mockResolvedValue(1);

      certificateRepo.createQuestionForSection.mockResolvedValue({
        id: mockQuestionId1,
        question: 'Is it okay?',
        rank: 1,
        question_number: 2,
        certificate_question_number: 2,
        criteria: undefined,
      } as any);

      const result = await structureService.addQuestions(mockSectionId, {
        section_type: 'section',
        questions: [
          {
            question: 'Is it okay?',
            type: 'boolean' as any,
          },
        ],
      } as any);

      expect(result).toHaveLength(1);
      expect(certificateRepo.createQuestionForSection).toHaveBeenCalled();
      expect(certificateRepo.createQuestionForSection).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ short_code: 'EW1.1.0.2' }),
      );
    });

    it('should add subsection question short codes from section and subsection indexes', async () => {
      certificateRepo.findSubSectionById.mockResolvedValue(mockSubSection);
      certificateRepo.findSectionById.mockResolvedValue(mockSection);
      certificateRepo.getMaxQuestionRankForSubSection.mockResolvedValue(0);
      certificateRepo.getMaxQuestionNumberForSubSection.mockResolvedValue(0);
      certificateRepo.getMaxCertificateQuestionNumber.mockResolvedValue(0);

      certificateRepo.createQuestionForSubSection.mockResolvedValue({
        id: mockQuestionId3,
        question: 'Is storage labeled?',
        short_code: 'EW1.1.1.1',
        rank: 1,
        question_number: 1,
        certificate_question_number: 1,
        criteria: undefined,
      } as any);

      const result = await structureService.addQuestions(mockSubSectionId, {
        section_type: 'sub_section',
        questions: [
          {
            question: 'Is storage labeled?',
            type: 'boolean' as any,
          },
        ],
      } as any);

      expect(result[0].short_code).toBe('EW1.1.1.1');
      expect(certificateRepo.createQuestionForSubSection).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ short_code: 'EW1.1.1.1' }),
      );
    });
  });

  describe('Updating Questions', () => {
    it('should update question with question_number and certificate_question_number', async () => {
      certificateRepo.findQuestionById.mockResolvedValue(mockQuestion1);
      certificateRepo.updateQuestion.mockResolvedValue({
        ...mockQuestion1,
        question: 'Updated question',
        question_number: 5,
        certificate_question_number: 10,
      });

      const result = await structureService.updateQuestion(mockQuestionId1, {
        question: 'Updated question',
        question_number: 5,
        certificate_question_number: 10,
      });

      expect(result.id).toBe(mockQuestionId1);
      expect(result.question).toBe('Updated question');
      expect(certificateRepo.updateQuestion).toHaveBeenCalledWith(
        mockQuestionId1,
        {
          question: 'Updated question',
          hint: undefined,
          type: undefined,
          criteria: undefined,
          rank: undefined,
          question_number: 5,
          certificate_question_number: 10,
          score: undefined,
          options: undefined,
        },
      );
    });

    it('should update question with only partial fields', async () => {
      certificateRepo.findQuestionById.mockResolvedValue(mockQuestion1);
      certificateRepo.updateQuestion.mockResolvedValue({
        ...mockQuestion1,
        score: 500,
      });

      const result = await structureService.updateQuestion(mockQuestionId1, {
        score: 500,
      });

      expect(result.id).toBe(mockQuestionId1);
      expect(certificateRepo.updateQuestion).toHaveBeenCalledWith(
        mockQuestionId1,
        expect.objectContaining({ score: 500 }),
      );
    });

    it('should throw NotFoundException when question does not exist', async () => {
      certificateRepo.findQuestionById.mockResolvedValue(null);

      await expect(
        structureService.updateQuestion('bad-id', { question: 'New text' }),
      ).rejects.toThrow('Question not found');
    });

    it('should support adding nested yes/no sub-questions during update', async () => {
      const mockClient = { query: jest.fn() } as any;

      certificateRepo.findQuestionById.mockResolvedValue({
        ...mockQuestion1,
        type: QuestionType.BOOLEAN,
      } as any);
      certificateRepo.beginTransaction.mockResolvedValue(mockClient);
      certificateRepo.updateQuestion.mockResolvedValue(mockQuestion1 as any);
      certificateRepo.getMaxQuestionRankForSection.mockResolvedValue(2);
      certificateRepo.getMaxCertificateQuestionNumber.mockResolvedValue(4);
      certificateRepo.getQuestionChildrenByTrigger.mockResolvedValue([] as any);
      certificateRepo.createQuestionForSection
        .mockResolvedValueOnce({ id: 'yes-child', question: 'Y', rank: 3 } as any)
        .mockResolvedValueOnce({ id: 'no-child', question: 'N', rank: 4 } as any);

      await structureService.updateQuestion(mockQuestionId1, {
        yes_sub_questions: [{ question: 'Yes branch child', type: QuestionType.TEXT }],
        no_sub_questions: [{ question: 'No branch child', type: QuestionType.TEXT }],
      });

      expect(certificateRepo.beginTransaction).toHaveBeenCalled();
      expect(certificateRepo.createQuestionForSection).toHaveBeenCalledTimes(2);
      expect(certificateRepo.commitTransaction).toHaveBeenCalledWith(mockClient);
      expect(certificateRepo.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should update existing nested sub-question when id is provided', async () => {
      const mockClient = { query: jest.fn() } as any;
      const existingYesChild = {
        id: 'child-yes-1',
        certificate_id: mockCertificateId,
        main_section_id: mockMainSectionId,
        section_id: mockSectionId,
        sub_section_id: null,
        question: 'Old nested question',
        type: QuestionType.TEXT,
        is_third_level: false,
        rank: 2,
        score: 10,
        parent_question_id: mockQuestionId1,
        parent_trigger_value: 'yes',
        created_at: new Date(),
        updated_at: new Date(),
      };

      certificateRepo.findQuestionById.mockResolvedValue({
        ...mockQuestion1,
        type: QuestionType.BOOLEAN,
      } as any);
      certificateRepo.beginTransaction.mockResolvedValue(mockClient);
      certificateRepo.updateQuestion.mockResolvedValue(mockQuestion1 as any);
      certificateRepo.getMaxQuestionRankForSection.mockResolvedValue(2);
      certificateRepo.getMaxCertificateQuestionNumber.mockResolvedValue(4);
      certificateRepo.getQuestionChildrenByTrigger.mockImplementation(
        async (_parentId: string, trigger: 'yes' | 'no') => (
          trigger === 'yes' ? ([existingYesChild] as any) : ([] as any)
        ),
      );

      await structureService.updateQuestion(mockQuestionId1, {
        yes_sub_questions: [
          {
            id: 'child-yes-1',
            question: 'Updated nested question',
          },
        ],
      } as any);

      expect(certificateRepo.createQuestionForSection).not.toHaveBeenCalled();
      expect(certificateRepo.updateQuestion).toHaveBeenCalledWith(
        'child-yes-1',
        expect.objectContaining({ question: 'Updated nested question' }),
        mockClient,
      );
      expect(certificateRepo.commitTransaction).toHaveBeenCalledWith(mockClient);
    });
  });

  describe('Updating Sections', () => {
    it('should update main section', async () => {
      certificateRepo.findMainSectionById.mockResolvedValue(mockMainSection);
      certificateRepo.updateMainSection.mockResolvedValue({
        ...mockMainSection,
        name: 'Updated Main',
      });

      const result = await structureService.updateMainSection(mockMainSectionId, {
        name: 'Updated Main',
      });

      expect(result.id).toBe(mockMainSectionId);
      expect(result.name).toBe('Updated Main');
    });

    it('should update section', async () => {
      certificateRepo.findSectionById.mockResolvedValue(mockSection);
      certificateRepo.updateSection.mockResolvedValue({
        ...mockSection,
        name: 'Updated Section',
      });

      const result = await structureService.updateSection(mockSectionId, {
        name: 'Updated Section',
      });

      expect(result.id).toBe(mockSectionId);
      expect(result.name).toBe('Updated Section');
    });

    it('should update subsection', async () => {
      certificateRepo.findSubSectionById.mockResolvedValue(mockSubSection);
      certificateRepo.updateSubSection.mockResolvedValue({
        ...mockSubSection,
        name: 'Updated Sub',
      });

      const result = await structureService.updateSubSection(mockSubSectionId, {
        name: 'Updated Sub',
      });

      expect(result.id).toBe(mockSubSectionId);
      expect(result.name).toBe('Updated Sub');
    });
  });
});
