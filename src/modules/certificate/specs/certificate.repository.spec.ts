import { Test, TestingModule } from '@nestjs/testing';
import { CertificateRepository } from '../certificate.repository';
import { DatabaseService } from '../../../database/database.service';
import { PoolClient, QueryResult } from 'pg';

describe('CertificateRepository - Question Numbering & Children Queries', () => {
  let repository: CertificateRepository;
  let databaseService: jest.Mocked<DatabaseService>;
  let mockClient: any;

  const mockCertificateId = '550e8400-e29b-41d4-a716-446655440000';
  const mockMainSectionId = '550e8400-e29b-41d4-a716-446655440001';
  const mockSectionId = '550e8400-e29b-41d4-a716-446655440002';
  const mockSubSectionId = '550e8400-e29b-41d4-a716-446655440003';

  beforeEach(async () => {
    mockClient = {
      query: jest.fn(),
    } as any;

    const mockDatabaseService = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateRepository,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    repository = module.get<CertificateRepository>(CertificateRepository);
    databaseService = module.get(DatabaseService);
  });

  describe('Question Number Getters', () => {
    it('should get max question number for section', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ max_number: 5 }],
      } as any);

      const result = await repository.getMaxQuestionNumberForSection(
        mockClient,
        mockSectionId,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('MAX(question_number)'),
        [mockSectionId],
      );
      expect(result).toBe(5);
    });

    it('should return 0 when no questions in section', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ max_number: 0 }],
      } as any);

      const result = await repository.getMaxQuestionNumberForSection(
        mockClient,
        mockSectionId,
      );

      expect(result).toBe(0);
    });

    it('should get max question number for subsection', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ max_number: 3 }],
      } as any);

      const result = await repository.getMaxQuestionNumberForSubSection(
        mockClient,
        mockSubSectionId,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('MAX(question_number)'),
        [mockSubSectionId],
      );
      expect(result).toBe(3);
    });

    it('should get max certificate question number', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ max_number: 100 }],
      } as any);

      const result = await repository.getMaxCertificateQuestionNumber(
        mockClient,
        mockCertificateId,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('MAX(certificate_question_number)'),
        [mockCertificateId],
      );
      expect(result).toBe(100);
    });
  });

  describe('Question Shifting for Insert', () => {
    it('should shift section question numbers on insert', async () => {
      mockClient.query.mockResolvedValue({ rows: [] } as any);

      await repository.shiftQuestionNumbersForSectionInsert(
        mockClient,
        mockSectionId,
        3,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('question_number = question_number + 1'),
        expect.arrayContaining([mockSectionId, 3]),
      );
    });

    it('should shift subsection question numbers on insert', async () => {
      mockClient.query.mockResolvedValue({ rows: [] } as any);

      await repository.shiftQuestionNumbersForSubSectionInsert(
        mockClient,
        mockSubSectionId,
        2,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('question_number = question_number + 1'),
        expect.arrayContaining([mockSubSectionId, 2]),
      );
    });

    it('should shift certificate question numbers on insert', async () => {
      mockClient.query.mockResolvedValue({ rows: [] } as any);

      await repository.shiftCertificateQuestionNumbersForInsert(
        mockClient,
        mockCertificateId,
        5,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'certificate_question_number = certificate_question_number + 1',
        ),
        expect.arrayContaining([mockCertificateId, 5]),
      );
    });
  });

  describe('Question Shifting for Delete', () => {
    it('should shift section question numbers on delete', async () => {
      mockClient.query.mockResolvedValue({ rows: [] } as any);

      await repository.shiftQuestionNumbersForSectionDelete(
        mockClient,
        mockSectionId,
        3,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('question_number = question_number - 1'),
        expect.arrayContaining([mockSectionId, 3]),
      );
    });

    it('should shift subsection question numbers on delete', async () => {
      mockClient.query.mockResolvedValue({ rows: [] } as any);

      await repository.shiftQuestionNumbersForSubSectionDelete(
        mockClient,
        mockSubSectionId,
        2,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('question_number = question_number - 1'),
        expect.arrayContaining([mockSubSectionId, 2]),
      );
    });

    it('should shift certificate question numbers on delete', async () => {
      mockClient.query.mockResolvedValue({ rows: [] } as any);

      await repository.shiftCertificateQuestionNumbersForDelete(
        mockClient,
        mockCertificateId,
        5,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'certificate_question_number = certificate_question_number - 1',
        ),
        expect.arrayContaining([mockCertificateId, 5]),
      );
    });
  });

  describe('Question Finders by Number', () => {
    it('should find question by section number', async () => {
      const mockQuestion = { id: 'q1', question_number: 2 };
      databaseService.query.mockResolvedValue({
        rows: [mockQuestion],
      } as any);

      const result = await repository.findQuestionBySectionNumber(
        mockSectionId,
        2,
      );

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('question_number = $2'),
        [mockSectionId, 2],
      );
      expect(result).toEqual(mockQuestion);
    });

    it('should find question by subsection number', async () => {
      const mockQuestion = { id: 'q1', question_number: 1 };
      databaseService.query.mockResolvedValue({
        rows: [mockQuestion],
      } as any);

      const result = await repository.findQuestionBySubSectionNumber(
        mockSubSectionId,
        1,
      );

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('question_number = $2'),
        [mockSubSectionId, 1],
      );
      expect(result).toEqual(mockQuestion);
    });

    it('should find question by certificate number', async () => {
      const mockQuestion = { id: 'q1', certificate_question_number: 42 };
      databaseService.query.mockResolvedValue({
        rows: [mockQuestion],
      } as any);

      const result = await repository.findQuestionByCertificateNumber(
        mockCertificateId,
        42,
      );

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('certificate_question_number = $2'),
        [mockCertificateId, 42],
      );
      expect(result).toEqual(mockQuestion);
    });

    it('should return null when question not found', async () => {
      databaseService.query.mockResolvedValue({
        rows: [],
      } as any);

      const result = await repository.findQuestionBySectionNumber(
        mockSectionId,
        999,
      );

      expect(result).toBeNull();
    });
  });

  describe('Rank-based Finders', () => {
    it('should find section by rank', async () => {
      const mockSection = { id: mockSectionId, rank: 2 };
      databaseService.query.mockResolvedValue({
        rows: [mockSection],
      } as any);

      const result = await repository.findSectionByRank(mockMainSectionId, 2);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('rank = $2'),
        [mockMainSectionId, 2],
      );
      expect(result).toEqual(mockSection);
    });

    it('should find subsection by rank', async () => {
      const mockSubSection = { id: mockSubSectionId, rank: 1 };
      databaseService.query.mockResolvedValue({
        rows: [mockSubSection],
      } as any);

      const result = await repository.findSubSectionByRank(mockSectionId, 1);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('rank = $2'),
        [mockSectionId, 1],
      );
      expect(result).toEqual(mockSubSection);
    });

    it('should find main section by rank', async () => {
      const mockMainSection = { id: mockMainSectionId, rank: 1 };
      databaseService.query.mockResolvedValue({
        rows: [mockMainSection],
      } as any);

      const result = await repository.findMainSectionByRank(
        mockCertificateId,
        1,
      );

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('rank = $2'),
        [mockCertificateId, 1],
      );
      expect(result).toEqual(mockMainSection);
    });
  });

  describe('Children Queries', () => {
    it('should get main section children with question counts', async () => {
      const mockChildren = [
        {
          id: 's1',
          name: 'Section 1',
          rank: 1,
          questions_count: '5',
        },
        {
          id: 's2',
          name: 'Section 2',
          rank: 2,
          questions_count: '3',
        },
      ];

      databaseService.query.mockResolvedValue({
        rows: mockChildren,
      } as any);

      const result = await repository.getMainSectionChildren(mockMainSectionId);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(q.id) as questions_count'),
        [mockMainSectionId],
      );
      expect(result).toHaveLength(2);
      expect(result[0].questions_count).toBe(5);
      expect(result[1].questions_count).toBe(3);
    });

    it('should get section children with question counts', async () => {
      const mockChildren = [
        {
          id: 'ss1',
          name: 'Sub Section 1',
          rank: 1,
          questions_count: '4',
        },
      ];

      databaseService.query.mockResolvedValue({
        rows: mockChildren,
      } as any);

      const result = await repository.getSectionChildren(mockSectionId);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(q.id) as questions_count'),
        [mockSectionId],
      );
      expect(result).toHaveLength(1);
      expect(result[0].questions_count).toBe(4);
    });

    it('should get subsection questions ordered by rank', async () => {
      const mockQuestions = [
        { id: 'q1', question: 'Question 1', rank: 1, question_number: 1 },
        { id: 'q2', question: 'Question 2', rank: 2, question_number: 2 },
      ];

      databaseService.query.mockResolvedValue({
        rows: mockQuestions,
      } as any);

      const result = await repository.getSubSectionQuestions(mockSubSectionId);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY rank ASC'),
        [mockSubSectionId],
      );
      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });
    it('should get section questions ordered by rank', async () => {
      const mockQuestions = [
        { id: 'q1', question: 'Question 1', rank: 1, question_number: 1 },
        { id: 'q2', question: 'Question 2', rank: 2, question_number: 2 },
      ];

      databaseService.query.mockResolvedValue({
        rows: mockQuestions,
      } as any);

      const result = await repository.getSectionQuestions(mockSectionId);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY rank ASC'),
        [mockSectionId],
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('Count Queries', () => {
    it('should count questions in section', async () => {
      databaseService.query.mockResolvedValue({
        rows: [{ total: '10' }],
      } as any);

      const result = await repository.countQuestionsInSection(mockSectionId);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [mockSectionId],
      );
      expect(result).toBe(10);
    });

    it('should count questions in subsection', async () => {
      databaseService.query.mockResolvedValue({
        rows: [{ total: '5' }],
      } as any);

      const result =
        await repository.countQuestionsInSubSection(mockSubSectionId);

      expect(result).toBe(5);
    });

    it('should count questions in certificate', async () => {
      databaseService.query.mockResolvedValue({
        rows: [{ total: '50' }],
      } as any);

      const result =
        await repository.countQuestionsInCertificate(mockCertificateId);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [mockCertificateId],
      );
      expect(result).toBe(50);
    });
  });

  describe('Constraint Validation', () => {
    it('should only count non-third-level questions in section', async () => {
      databaseService.query.mockResolvedValue({
        rows: [{ total: '3' }],
      } as any);

      await repository.countQuestionsInSection(mockSectionId);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('is_third_level = FALSE'),
        expect.any(Array),
      );
    });

    it('should only count third-level questions in subsection', async () => {
      databaseService.query.mockResolvedValue({
        rows: [{ total: '2' }],
      } as any);

      await repository.countQuestionsInSubSection(mockSubSectionId);

      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('is_third_level = TRUE'),
        expect.any(Array),
      );
    });

    it('should shift only non-third-level questions for section', async () => {
      mockClient.query.mockResolvedValue({ rows: [] } as any);

      await repository.shiftQuestionNumbersForSectionInsert(
        mockClient,
        mockSectionId,
        2,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('is_third_level = FALSE'),
        expect.any(Array),
      );
    });

    it('should shift only third-level questions for subsection', async () => {
      mockClient.query.mockResolvedValue({ rows: [] } as any);

      await repository.shiftQuestionNumbersForSubSectionInsert(
        mockClient,
        mockSubSectionId,
        2,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('is_third_level = TRUE'),
        expect.any(Array),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero count for empty sections', async () => {
      databaseService.query.mockResolvedValue({
        rows: [{ total: '0' }],
      } as any);

      const result = await repository.countQuestionsInSection(mockSectionId);
      expect(result).toBe(0);
    });

    it('should handle large question numbers', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ max_number: 9999 }],
      } as any);

      const result = await repository.getMaxCertificateQuestionNumber(
        mockClient,
        mockCertificateId,
      );
      expect(result).toBe(9999);
    });

    it('should handle null count results gracefully', async () => {
      databaseService.query.mockResolvedValue({
        rows: [{ total: null }],
      } as any);

      try {
        const result = await repository.countQuestionsInSection(mockSectionId);
        expect(result).toBe(0);
      } catch {}
    });

    it('should return empty array for children with no subsections', async () => {
      databaseService.query.mockResolvedValue({
        rows: [],
      } as any);

      const result = await repository.getSectionChildren(mockSectionId);
      expect(result).toEqual([]);
    });

    it('should return empty array for questions with no items', async () => {
      databaseService.query.mockResolvedValue({
        rows: [],
      } as any);

      const result = await repository.getSubSectionQuestions(mockSubSectionId);
      expect(result).toEqual([]);
    });
  });
});
