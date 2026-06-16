import { Test, TestingModule } from '@nestjs/testing';
import { CertificateController } from '../certificate.controller';
import { CertificateService } from '../services/certificate.service';
import { CertificateStructureService } from '../services/certificate-structure.service';
import { CertificateQueryService } from '../services/certificate-query.service';
import { CertificateDuplicateService } from '../services/certificate-duplicate.service';
import { CertificateDevService } from '../services/certificate-dev.service';
import { CertificationOverviewService } from '../services/certification-overview.service';
import { HttpStatus } from '@nestjs/common';

const mockCertificateService = {
  getCertificateById: jest.fn(),
  createCertificate: jest.fn(),
  getCertificates: jest.fn(),
  deleteCertificate: jest.fn(),
};

const mockStructureService = {
  addQuestions: jest.fn(),
  reorderItem: jest.fn(),
};

describe('CertificateController', () => {
  let controller: CertificateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificateController],
      providers: [
        { provide: CertificateService, useValue: mockCertificateService },
        { provide: CertificateStructureService, useValue: mockStructureService },
        { provide: CertificateQueryService, useValue: {} },
        { provide: CertificateDuplicateService, useValue: {} },
        { provide: CertificateDevService, useValue: {} },
        { provide: CertificationOverviewService, useValue: {} },
      ],
    }).compile();

    controller = module.get<CertificateController>(CertificateController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addQuestions', () => {
    it('should call structureService.addQuestions and return created response', async () => {
      const mockResult = [{ id: 'q-1', question: 'Is it ok?', rank: 1 }];
      mockStructureService.addQuestions.mockResolvedValue(mockResult);

      const result = await controller.addQuestions('section-1', {
        section_type: 'section' as any,
        questions: [{ question: 'Is it ok?', type: 'boolean' as any }],
      });

      expect(mockStructureService.addQuestions).toHaveBeenCalledWith('section-1', expect.any(Object));
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(HttpStatus.CREATED);
    });
  });

  describe('reorderItem', () => {
    it('should call structureService.reorderItem and return ok response', async () => {
      mockStructureService.reorderItem.mockResolvedValue(undefined);

      const result = await controller.reorderItem('cert-1', {
        item_type: 'section' as any,
        item_id: 'section-1',
        new_parent_id: 'main-1',
        new_rank: 2,
      });

      expect(mockStructureService.reorderItem).toHaveBeenCalledWith('cert-1', expect.any(Object));
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(HttpStatus.OK);
    });
  });
});
