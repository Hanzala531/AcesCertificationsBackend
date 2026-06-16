import { NotFoundException } from '@nestjs/common';
import { AssessmentAdminService } from '../services/assessment-admin.service';

describe('AssessmentAdminService certificate block toggle', () => {
  function createService(assessmentRepo: any) {
    return new AssessmentAdminService(
      assessmentRepo,
      { getOrganizationUsers: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
    );
  }

  it('blocks certificate allocation for an assessment', async () => {
    const assessmentRepo = {
      findAssessmentWithDetails: jest.fn().mockResolvedValue({
        id: 'assessment-1',
        organization_id: 'org-1',
        certificate_name: 'ISO 27001',
      }),
      setCertificateBlockStatus: jest.fn().mockResolvedValue({}),
    };
    const service = createService(assessmentRepo);

    const result = await service.setCertificateBlockStatus(
      'assessment-1',
      true,
      'Missing required policy documents',
    );

    expect(assessmentRepo.setCertificateBlockStatus).toHaveBeenCalledWith(
      'assessment-1',
      true,
      'Missing required policy documents',
    );
    expect(result).toEqual({
      assessmentId: 'assessment-1',
      isBlocked: true,
      reason: 'Missing required policy documents',
    });
  });

  it('throws when reason is missing for blocking', async () => {
    const assessmentRepo = {
      findAssessmentWithDetails: jest.fn().mockResolvedValue({
        id: 'assessment-1',
        organization_id: 'org-1',
        certificate_name: 'ISO 27001',
      }),
      setCertificateBlockStatus: jest.fn().mockResolvedValue({}),
    };
    const service = createService(assessmentRepo);

    await expect(
      service.setCertificateBlockStatus('assessment-1', true, ''),
    ).rejects.toThrow('Blocking reason is required when isBlocked is true');
  });

  it('throws when assessment is not found', async () => {
    const assessmentRepo = {
      findAssessmentWithDetails: jest.fn().mockResolvedValue(null),
      setCertificateBlockStatus: jest.fn(),
    };
    const service = createService(assessmentRepo);

    await expect(
      service.setCertificateBlockStatus('missing-assessment', true),
    ).rejects.toThrow(NotFoundException);
  });
});
