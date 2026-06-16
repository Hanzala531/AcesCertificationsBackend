import { CertificateDuplicateService } from '../services/certificate-duplicate.service';

describe('CertificateDuplicateService duplicateCertificate', () => {
  it('duplicates certificate with versioned id and name', async () => {
    const mockClient = { query: jest.fn() } as any;
    const certificateRepo = {
      findCertificateWithDetails: jest.fn().mockResolvedValue({
        id: 'source-cert-id',
        certificate_id: 'CERT-001',
        name: 'Food Safety',
        industry_ids: ['11111111-1111-1111-1111-111111111111'],
        disclosure_price: 100,
        assured_price: 200,
        validity_days: 0,
        validity_months: 12,
        validity_years: 0,
        compulsory_docs: ['doc-1'],
        description: 'desc',
        is_published: true,
        badges: [
          {
            slot: 1,
            name: 'rated',
            colors: [{ color: '#fff', min_score: 70, max_score: 79 }],
          },
        ],
        main_sections: [
          {
            name: 'Main 1',
            rank: 1,
            sections: [
              {
                name: 'Section 1',
                rank: 1,
                questions: [
                  {
                    question: 'Q1',
                    hint: 'hint',
                    type: 'text',
                    criteria: 'criteria',
                    conditions: null,
                    rank: 1,
                    question_number: 1,
                    certificate_question_number: 1,
                  },
                ],
                sub_sections: [],
              },
            ],
          },
        ],
      }),
      findCertificateByCertificateId: jest.fn().mockResolvedValue(null),
      findMaxVersionByCertificateIdBase: jest.fn().mockResolvedValue(1),
      beginTransaction: jest.fn().mockResolvedValue(mockClient),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      createCertificate: jest.fn().mockResolvedValue({ id: 'new-cert-id' }),
      createBadge: jest.fn().mockResolvedValue({ id: 'new-badge-id' }),
      createBadgeColors: jest.fn(),
      createMainSection: jest.fn().mockResolvedValue({ id: 'main-new' }),
      createSection: jest.fn().mockResolvedValue({ id: 'section-new' }),
      createSubSection: jest.fn(),
      createQuestionForSection: jest.fn(),
      createQuestionForSubSection: jest.fn(),
      recalculateHierarchicalShortCodes: jest.fn().mockResolvedValue(undefined),
      findCertificates: jest.fn(),
    };

    const service = new CertificateDuplicateService(
      certificateRepo as any,
    );

    const result = await service.duplicateCertificate(
      'source-cert-id',
      'admin-id',
    );

    expect(certificateRepo.createCertificate).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        certificate_id: 'CERT-001-v2',
        name: 'Food Safety (Version 2)',
        is_published: false,
      }),
    );
    expect(certificateRepo.createBadge).toHaveBeenCalled();
    expect(certificateRepo.createMainSection).toHaveBeenCalled();
    expect(certificateRepo.createSection).toHaveBeenCalled();
    expect(certificateRepo.createQuestionForSection).toHaveBeenCalled();
    expect(certificateRepo.commitTransaction).toHaveBeenCalledWith(mockClient);
    expect(result).toEqual({
      id: 'new-cert-id',
      certificate_id: 'CERT-001-v2',
      name: 'Food Safety (Version 2)',
    });
  });
});
