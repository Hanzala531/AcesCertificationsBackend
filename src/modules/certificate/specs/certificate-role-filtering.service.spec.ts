import { CertificateService } from '../services/certificate.service';

describe('CertificateService role-aware getCertificates', () => {
  it('returns only published certificates and prioritizes recommended for organization', async () => {
    const certificateRepo = {
      findCertificates: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      }),
    };
    const organizationRepo = {
      findByUserId: jest.fn().mockResolvedValue({
        id: 'org-1',
        industry_ids: ['11111111-1111-1111-1111-111111111111'],
      }),
      findById: jest.fn(),
    };
    const employeeRepo = {
      findByUserId: jest.fn(),
    };

    const service = new CertificateService(
      certificateRepo as any,
      organizationRepo as any,
      employeeRepo as any,
    );

    await service.getCertificates({
      userId: 'user-1',
      userRole: 'organization',
      page: 1,
      limit: 10,
    });

    expect(certificateRepo.findCertificates).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        onlyPublished: true,
        prioritizeIndustryIds: ['11111111-1111-1111-1111-111111111111'],
      }),
    );
  });

  it('returns default certificate listing for admin', async () => {
    const certificateRepo = {
      findCertificates: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      }),
    };
    const organizationRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
    };
    const employeeRepo = {
      findByUserId: jest.fn(),
    };

    const service = new CertificateService(
      certificateRepo as any,
      organizationRepo as any,
      employeeRepo as any,
    );

    await service.getCertificates({
      userId: 'admin-user',
      userRole: 'admin',
      page: 2,
      limit: 20,
      industryId: 'abc',
    });

    expect(certificateRepo.findCertificates).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      industryId: 'abc',
    });
  });
});
