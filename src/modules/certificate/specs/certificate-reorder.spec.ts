/**
 * Comprehensive tests for the Reorder API overhaul.
 *
 * Covers:
 *  1. Unique constraint fix (nullify-then-recalculate)
 *  2. Cascade children parent IDs on section/sub-section move
 *  3. Promote/demote between hierarchy levels
 *  4. Optional rank (auto-assign to end)
 *  5. Regressions: same-parent reorder, cross-parent question move
 */

/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CertificateStructureService } from '../services/certificate-structure.service';
import { CertificateRepository } from '../certificate.repository';
import {
  ReorderItemType,
  ReorderParentType,
  ReorderOperationType,
} from '../dto/reorder-item.dto';

// ─── shared helpers ──────────────────────────────────────────────────────────

function buildMockRepo(overrides: Record<string, any> = {}) {
  const mockClient: any = { query: jest.fn().mockResolvedValue({ rows: [{ cnt: '0' }] }) };

  const base: Record<string, jest.Mock> = {
    findCertificateById: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(mockClient),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    // finders
    findMainSectionById: jest.fn(),
    findSectionById: jest.fn(),
    findSubSectionById: jest.fn(),
    findQuestionById: jest.fn(),
    // answer-existence guards (default: no answers, so guards are no-ops)
    countAnswersForQuestionTree: jest.fn().mockResolvedValue(0),
    countAnswersByStructural: jest.fn().mockResolvedValue(0),
    // rank getters
    getMaxMainSectionRank: jest.fn().mockResolvedValue(3),
    getMaxSectionRankForMainSection: jest.fn().mockResolvedValue(3),
    getMaxSubSectionRankForSection: jest.fn().mockResolvedValue(3),
    getMaxQuestionRankForSection: jest.fn().mockResolvedValue(3),
    getMaxQuestionRankForSubSection: jest.fn().mockResolvedValue(3),
    // shift helpers
    shiftSectionRanksForDelete: jest.fn().mockResolvedValue(undefined),
    shiftSectionRanksForInsert: jest.fn().mockResolvedValue(undefined),
    shiftSubSectionRanksForDelete: jest.fn().mockResolvedValue(undefined),
    shiftSubSectionRanksForInsert: jest.fn().mockResolvedValue(undefined),
    shiftQuestionRanksForDelete: jest.fn().mockResolvedValue(undefined),
    shiftQuestionRanksForInsert: jest.fn().mockResolvedValue(undefined),
    nullifyLocalQuestionNumbers: jest.fn().mockResolvedValue(undefined),
    // update helpers
    updateSectionParentAndRank: jest.fn().mockResolvedValue(undefined),
    updateSubSectionParentAndRank: jest.fn().mockResolvedValue(undefined),
    updateQuestionParentAndRank: jest.fn().mockResolvedValue(undefined),
    updateMainSectionRank: jest.fn().mockResolvedValue(undefined),
    // cascade
    cascadeSectionChildren: jest.fn().mockResolvedValue(undefined),
    cascadeSubSectionChildren: jest.fn().mockResolvedValue(undefined),
    // recalculate
    recalculateCertificateQuestionNumbers: jest.fn().mockResolvedValue(undefined),
    recalculateHierarchicalShortCodes: jest.fn().mockResolvedValue(undefined),
    renumberLocalQuestionNumbers: jest.fn().mockResolvedValue(undefined),
    // promote/demote
    createMainSectionFromName: jest.fn().mockResolvedValue({ id: 'new-main-1' }),
    createSectionFromName: jest.fn().mockResolvedValue({ id: 'new-sec-1' }),
    createSubSectionFromName: jest.fn().mockResolvedValue({ id: 'new-subsec-1' }),
    reassignSectionChildrenToNewMain: jest.fn().mockResolvedValue(undefined),
    reassignSubSectionQuestionsToSection: jest.fn().mockResolvedValue(undefined),
    reassignSectionQuestionsToSubSection: jest.fn().mockResolvedValue(undefined),
    deleteMainSection: jest.fn().mockResolvedValue(undefined),
    deleteSection: jest.fn().mockResolvedValue(undefined),
    deleteSubSection: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return { mockClient, mockRepo: base };
}

async function createService(mockRepo: Record<string, jest.Mock>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CertificateStructureService,
      { provide: CertificateRepository, useValue: mockRepo },
    ],
  }).compile();
  return {
    service: module.get<CertificateStructureService>(CertificateStructureService),
    repo: module.get(CertificateRepository) as jest.Mocked<CertificateRepository>,
  };
}

// ─── constants ───────────────────────────────────────────────────────────────

const certId = 'cert-1';
const mainId1 = 'main-1';
const mainId2 = 'main-2';
const secId1 = 'sec-1';
const secId2 = 'sec-2';
const subSecId1 = 'subsec-1';
const subSecId2 = 'subsec-2';
const qId1 = 'q-1';

const mockCertificate = { id: certId, name: 'Test Cert' };
const mockMainSection1 = { id: mainId1, certificate_id: certId, name: 'Main 1', rank: 1 };
const mockMainSection2 = { id: mainId2, certificate_id: certId, name: 'Main 2', rank: 2 };
const mockSection1 = { id: secId1, certificate_id: certId, main_id: mainId1, name: 'Section 1', rank: 1 };
const mockSection2 = { id: secId2, certificate_id: certId, main_id: mainId2, name: 'Section 2', rank: 1 };
const mockSubSection1 = { id: subSecId1, certificate_id: certId, main_id: mainId1, section_id: secId1, name: 'SubSec 1', rank: 1 };
const mockSubSection2 = { id: subSecId2, certificate_id: certId, main_id: mainId2, section_id: secId2, name: 'SubSec 2', rank: 1 };
const mockQuestion1 = {
  id: qId1, certificate_id: certId, main_section_id: mainId1,
  section_id: secId1, sub_section_id: null, is_third_level: false, rank: 1,
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. UNIQUE CONSTRAINT FIX
// ═════════════════════════════════════════════════════════════════════════════

describe('Fix 1: recalculateCertificateQuestionNumbers (nullify approach)', () => {
  it('calls recalculate without throwing — swapping positions should work', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSectionById: jest.fn().mockResolvedValue(mockSection1),
      findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
    });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SECTION,
      item_id: secId1,
      new_parent_id: mainId1,
      new_rank: 3,
    });

    expect(repo.recalculateCertificateQuestionNumbers).toHaveBeenCalledWith(mockClient, certId);
    expect(repo.commitTransaction).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. CASCADE CHILDREN
// ═════════════════════════════════════════════════════════════════════════════

describe('Fix 2: Cascade children parent IDs', () => {
  describe('Section move to different main_section', () => {
    it('cascades children when section moves to a different main_section', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findSectionById: jest.fn().mockResolvedValue({ ...mockSection1, main_id: mainId1 }),
        findMainSectionById: jest.fn().mockResolvedValue(mockMainSection2),
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId1,
        new_parent_id: mainId2,
        new_rank: 1,
      });

      expect(repo.cascadeSectionChildren).toHaveBeenCalledWith(mockClient, secId1, mainId2);
      expect(repo.commitTransaction).toHaveBeenCalled();
    });

    it('does NOT cascade when section stays in same main_section', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findSectionById: jest.fn().mockResolvedValue(mockSection1),
        findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId1,
        new_parent_id: mainId1,
        new_rank: 2,
      });

      expect(repo.cascadeSectionChildren).not.toHaveBeenCalled();
    });
  });

  describe('Sub-section move to different section', () => {
    it('cascades children when sub-section moves to a different section', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findSubSectionById: jest.fn().mockResolvedValue(mockSubSection1),
        findSectionById: jest.fn().mockResolvedValue(mockSection2),
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.SUB_SECTION,
        item_id: subSecId1,
        new_parent_id: secId2,
        new_rank: 1,
      });

      expect(repo.cascadeSubSectionChildren).toHaveBeenCalledWith(
        mockClient, subSecId1, mockSection2.main_id, secId2,
      );
      expect(repo.commitTransaction).toHaveBeenCalled();
    });

    it('does NOT cascade when sub-section stays in same section', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findSubSectionById: jest.fn().mockResolvedValue(mockSubSection1),
        findSectionById: jest.fn().mockResolvedValue(mockSection1),
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.SUB_SECTION,
        item_id: subSecId1,
        new_parent_id: secId1,
        new_rank: 2,
      });

      expect(repo.cascadeSubSectionChildren).not.toHaveBeenCalled();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. PROMOTE / DEMOTE
// ═════════════════════════════════════════════════════════════════════════════

describe('Fix 3: Promote and Demote between hierarchy levels', () => {
  describe('Reorder main_section (simple rank change)', () => {
    it('reorders main_section rank and commits', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.MAIN_SECTION,
        item_id: mainId1,
        new_parent_id: certId,
        new_rank: 3,
      });

      expect(repo.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('Promote section → main_section', () => {
    it('creates new main_section, reassigns children, deletes old section', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findSectionById: jest.fn().mockResolvedValue(mockSection1),
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId1,
        new_parent_id: certId,
        new_item_type: ReorderItemType.MAIN_SECTION,
        new_rank: 3,
      });

      expect(repo.createMainSectionFromName).toHaveBeenCalledWith(
        mockClient, certId, mockSection1.name, 3,
      );
      expect(repo.reassignSectionChildrenToNewMain).toHaveBeenCalledWith(
        mockClient, secId1, 'new-main-1',
      );
      expect(repo.deleteSection).toHaveBeenCalledWith(secId1, mockClient);
      expect(repo.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('Demote main_section → section', () => {
    it('creates new section under target main, reassigns children, deletes old main_section', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findMainSectionById: jest.fn()
          .mockResolvedValueOnce(mockMainSection1) // the item being moved
          .mockResolvedValueOnce(mockMainSection2), // the target parent
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.MAIN_SECTION,
        item_id: mainId1,
        new_parent_id: mainId2,
        new_item_type: ReorderItemType.SECTION,
        new_rank: 1,
      });

      expect(repo.createSectionFromName).toHaveBeenCalledWith(
        mockClient, certId, mainId2, mockMainSection1.name, 1,
      );
      // Children reassigned via direct client.query calls
      expect(mockClient.query).toHaveBeenCalled();
      expect(repo.deleteMainSection).toHaveBeenCalledWith(mainId1, mockClient);
      expect(repo.commitTransaction).toHaveBeenCalled();
    });

    it('throws NotFoundException when target main_section not found', async () => {
      const { mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findMainSectionById: jest.fn()
          .mockResolvedValueOnce(mockMainSection1)
          .mockResolvedValueOnce(null),
      });
      const { service } = await createService(mockRepo);

      await expect(
        service.reorderItem(certId, {
          item_type: ReorderItemType.MAIN_SECTION,
          item_id: mainId1,
          new_parent_id: 'nonexistent',
          new_item_type: ReorderItemType.SECTION,
          new_rank: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Promote sub_section → section', () => {
    it('creates new section, reassigns questions, deletes old sub_section', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findSubSectionById: jest.fn().mockResolvedValue(mockSubSection1),
        findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.SUB_SECTION,
        item_id: subSecId1,
        new_parent_id: mainId1,
        new_item_type: ReorderItemType.SECTION,
        new_rank: 2,
      });

      expect(repo.createSectionFromName).toHaveBeenCalledWith(
        mockClient, certId, mainId1, mockSubSection1.name, 2,
      );
      expect(repo.reassignSubSectionQuestionsToSection).toHaveBeenCalledWith(
        mockClient, subSecId1, 'new-sec-1', mainId1,
      );
      expect(repo.deleteSubSection).toHaveBeenCalledWith(subSecId1, mockClient);
      expect(repo.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('Demote section → sub_section', () => {
    it('creates new sub_section, flips questions to is_third_level=true, deletes old section', async () => {
      const { mockClient, mockRepo } = buildMockRepo({
        findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
        findSectionById: jest.fn()
          .mockResolvedValueOnce(mockSection1) // the item
          .mockResolvedValueOnce(mockSection2), // the target parent section
      });
      const { service, repo } = await createService(mockRepo);

      await service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId1,
        new_parent_id: secId2,
        new_item_type: ReorderItemType.SUB_SECTION,
        new_rank: 1,
      });

      expect(repo.createSubSectionFromName).toHaveBeenCalledWith(
        mockClient, certId, mockSection2.main_id, secId2, mockSection1.name, 1,
      );
      expect(repo.reassignSectionQuestionsToSubSection).toHaveBeenCalledWith(
        mockClient, secId1, 'new-subsec-1',
      );
      expect(repo.deleteSection).toHaveBeenCalledWith(secId1, mockClient);
      expect(repo.commitTransaction).toHaveBeenCalled();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. OPTIONAL RANK
// ═════════════════════════════════════════════════════════════════════════════

describe('Fix 4: Optional rank (auto-assign to end)', () => {
  it('auto-assigns rank when new_rank is omitted for section reorder', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSectionById: jest.fn().mockResolvedValue(mockSection1),
      findMainSectionById: jest.fn().mockResolvedValue(mockMainSection2),
      getMaxSectionRankForMainSection: jest.fn().mockResolvedValue(5),
    });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SECTION,
      item_id: secId1,
      new_parent_id: mainId2,
      // new_rank omitted
    });

    // Should have used rank 6 (max 5 + 1)
    expect(repo.updateSectionParentAndRank).toHaveBeenCalledWith(
      mockClient, secId1, mainId2, 6,
    );
  });

  it('uses provided rank when explicitly given', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSectionById: jest.fn().mockResolvedValue(mockSection1),
      findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
    });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SECTION,
      item_id: secId1,
      new_parent_id: mainId1,
      new_rank: 2,
    });

    expect(repo.updateSectionParentAndRank).toHaveBeenCalledWith(
      mockClient, secId1, mainId1, 2,
    );
  });

  it('auto-assigns rank for sub-section reorder', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSubSectionById: jest.fn().mockResolvedValue(mockSubSection1),
      findSectionById: jest.fn().mockResolvedValue(mockSection2),
      getMaxSubSectionRankForSection: jest.fn().mockResolvedValue(2),
    });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SUB_SECTION,
      item_id: subSecId1,
      new_parent_id: secId2,
      // new_rank omitted
    });

    expect(repo.updateSubSectionParentAndRank).toHaveBeenCalledWith(
      mockClient, subSecId1, secId2, mockSection2.main_id, 3,
    );
  });
});

describe('Fix 5: Explicit operation payloads', () => {
  it('supports change_rank payload for in-place section ranking', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSectionById: jest.fn().mockResolvedValue(mockSection1),
      getMaxSectionRankForMainSection: jest.fn().mockResolvedValue(4),
    });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      operation: ReorderOperationType.CHANGE_RANK,
      item_type: ReorderItemType.SECTION,
      item_id: secId1,
      new_rank: 2,
    });

    expect(repo.updateSectionParentAndRank).toHaveBeenCalledWith(
      mockClient,
      secId1,
      mockSection1.main_id,
      2,
    );
    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('rejects change_rank payload when new_rank is missing', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
    });
    const { service, repo } = await createService(mockRepo);

    await expect(
      service.reorderItem(certId, {
        operation: ReorderOperationType.CHANGE_RANK,
        item_type: ReorderItemType.SECTION,
        item_id: secId1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repo.rollbackTransaction).toHaveBeenCalledWith(mockClient);
  });

  it('rejects parent/type conversion fields for change_rank payload', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
    });
    const { service, repo } = await createService(mockRepo);

    await expect(
      service.reorderItem(certId, {
        operation: ReorderOperationType.CHANGE_RANK,
        item_type: ReorderItemType.QUESTION,
        item_id: qId1,
        new_rank: 1,
        new_parent_id: secId2,
      } as any),
    ).rejects.toThrow(BadRequestException);

    expect(repo.rollbackTransaction).toHaveBeenCalledWith(mockClient);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. REGRESSIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('Regressions', () => {
  it('throws NotFoundException when certificate does not exist', async () => {
    const { mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(null),
    });
    const { service } = await createService(mockRepo);

    await expect(
      service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId1,
        new_parent_id: mainId1,
        new_rank: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for section belonging to different certificate', async () => {
    const { mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSectionById: jest.fn().mockResolvedValue({ ...mockSection1, certificate_id: 'other-cert' }),
      findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
    });
    const { service } = await createService(mockRepo);

    await expect(
      service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId1,
        new_parent_id: mainId1,
        new_rank: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rolls back transaction on unexpected error', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSectionById: jest.fn().mockRejectedValue(new Error('DB down')),
    });
    const { service, repo } = await createService(mockRepo);

    await expect(
      service.reorderItem(certId, {
        item_type: ReorderItemType.SECTION,
        item_id: secId1,
        new_parent_id: mainId1,
        new_rank: 1,
      }),
    ).rejects.toThrow();

    expect(repo.rollbackTransaction).toHaveBeenCalledWith(mockClient);
  });

  it('same-parent section reorder works without cascading', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSectionById: jest.fn().mockResolvedValue(mockSection1),
      findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
    });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SECTION,
      item_id: secId1,
      new_parent_id: mainId1,
      new_rank: 3,
    });

    expect(repo.cascadeSectionChildren).not.toHaveBeenCalled();
    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('question reorder with new_parent_type still works', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findQuestionById: jest.fn().mockResolvedValue(mockQuestion1),
      findSectionById: jest.fn().mockResolvedValue(mockSection1),
      renumberLocalQuestionNumbers: jest.fn().mockResolvedValue(undefined),
    });
    mockClient.query.mockResolvedValue({ rows: [{ cnt: '2' }] });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.QUESTION,
      item_id: qId1,
      new_parent_id: secId1,
      new_parent_type: ReorderParentType.SECTION,
      new_rank: 2,
    });

    expect(repo.updateQuestionParentAndRank).toHaveBeenCalled();
    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('question move to a section in another main works without new_parent_type', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findQuestionById: jest.fn().mockResolvedValue(mockQuestion1),
      findSubSectionById: jest.fn().mockResolvedValue(null),
      findSectionById: jest
        .fn()
        .mockResolvedValueOnce(mockSection2)
        .mockResolvedValueOnce(mockSection2),
      renumberLocalQuestionNumbers: jest.fn().mockResolvedValue(undefined),
    });
    mockClient.query.mockResolvedValue({ rows: [{ cnt: '0' }] });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.QUESTION,
      item_id: qId1,
      new_parent_id: secId2,
      new_rank: 1,
    } as any);

    expect(repo.updateQuestionParentAndRank).toHaveBeenCalledWith(
      mockClient,
      qId1,
      expect.objectContaining({
        main_section_id: mockSection2.main_id,
        section_id: secId2,
        sub_section_id: null,
        is_third_level: false,
      }),
    );
    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('question move to a sub-section in another main works without new_parent_type', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findQuestionById: jest.fn().mockResolvedValue(mockQuestion1),
      findSubSectionById: jest.fn().mockResolvedValue(mockSubSection2),
      renumberLocalQuestionNumbers: jest.fn().mockResolvedValue(undefined),
    });
    mockClient.query.mockResolvedValue({ rows: [{ cnt: '1' }] });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.QUESTION,
      item_id: qId1,
      new_parent_id: subSecId2,
      new_rank: 2,
    } as any);

    expect(repo.updateQuestionParentAndRank).toHaveBeenCalledWith(
      mockClient,
      qId1,
      expect.objectContaining({
        main_section_id: mockSubSection2.main_id,
        section_id: mockSubSection2.section_id,
        sub_section_id: subSecId2,
        is_third_level: true,
      }),
    );

    const insertOrder =
      repo.shiftQuestionRanksForInsert.mock.invocationCallOrder[0];
    const updateOrder =
      repo.updateQuestionParentAndRank.mock.invocationCallOrder[0];
    const deleteOrder =
      repo.shiftQuestionRanksForDelete.mock.invocationCallOrder[0];

    expect(insertOrder).toBeLessThan(updateOrder);
    expect(updateOrder).toBeLessThan(deleteOrder);
    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('section in-place reorder works when new_parent_id is omitted', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSectionById: jest.fn().mockResolvedValue(mockSection1),
      findMainSectionById: jest.fn().mockResolvedValue(mockMainSection1),
    });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SECTION,
      item_id: secId1,
      new_rank: 2,
    } as any);

    expect(repo.updateSectionParentAndRank).toHaveBeenCalledWith(
      mockClient,
      secId1,
      mockSection1.main_id,
      2,
    );
    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('sub-section in-place reorder works when new_parent_id is omitted', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findSubSectionById: jest.fn().mockResolvedValue(mockSubSection1),
      findSectionById: jest.fn().mockResolvedValue(mockSection1),
    });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.SUB_SECTION,
      item_id: subSecId1,
      new_rank: 2,
    } as any);

    expect(repo.updateSubSectionParentAndRank).toHaveBeenCalledWith(
      mockClient,
      subSecId1,
      mockSubSection1.section_id,
      mockSection1.main_id,
      2,
    );
    expect(repo.commitTransaction).toHaveBeenCalled();
  });

  it('question in-place reorder works when new_parent_id and new_parent_type are omitted', async () => {
    const { mockClient, mockRepo } = buildMockRepo({
      findCertificateById: jest.fn().mockResolvedValue(mockCertificate),
      findQuestionById: jest.fn().mockResolvedValue(mockQuestion1),
      renumberLocalQuestionNumbers: jest.fn().mockResolvedValue(undefined),
    });
    mockClient.query.mockResolvedValue({ rows: [{ cnt: '1' }] });
    const { service, repo } = await createService(mockRepo);

    await service.reorderItem(certId, {
      item_type: ReorderItemType.QUESTION,
      item_id: qId1,
      new_rank: 2,
    } as any);

    expect(repo.updateQuestionParentAndRank).toHaveBeenCalledWith(
      mockClient,
      qId1,
      expect.objectContaining({
        main_section_id: mockQuestion1.main_section_id,
        section_id: mockQuestion1.section_id,
        sub_section_id: null,
        is_third_level: false,
      }),
    );
    expect(repo.commitTransaction).toHaveBeenCalled();
  });
});
