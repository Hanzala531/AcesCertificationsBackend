import { Test, TestingModule } from '@nestjs/testing';
import { AuditorController } from '../auditor.controller';
import { AuditorService } from '../auditor.service';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../../auth/auth.service';

describe('AuditorController', () => {
  let controller: AuditorController;
  let auditorService: jest.Mocked<AuditorService>;

  beforeEach(async () => {
    const mockAuditorService = {
      findAll: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      unassignCertificates: jest.fn(),
      assignToAssessment: jest.fn(),
      updateAuditDate: jest.fn(),
      getAssignedAssessments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditorController],
      providers: [
        { provide: AuditorService, useValue: mockAuditorService },
        { provide: UsersService, useValue: {} },
        { provide: AuthService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AuditorController>(AuditorController);
    auditorService = module.get(AuditorService);
  });

  it('should return auditors list with name derived from first/last when present', async () => {
    const mockAuditorRow = {
      id: 'aud-1',
      user_id: 'user-1',
      first_name: 'John',
      last_name: 'Doe',
      region: 'Europe',
      profile_picture: null,
      assigned_certificates: [],
      status: 'active',
      email: 'john.doe@example.com',
      certificate_details: [],
    } as any;

    auditorService.findAll.mockResolvedValue({
      auditors: [mockAuditorRow],
      total: 1,
    });

    const res = await controller.listAuditors();
    expect(res.data).toHaveLength(1);
    expect(res.data[0].name).toBe('John Doe');
    expect(res.data[0].email).toBe('john.doe@example.com');
  });

  it('should fallback name to email when first/last missing', async () => {
    const mockAuditorRow = {
      id: null,
      user_id: 'user-2',
      first_name: null,
      last_name: null,
      region: null,
      profile_picture: null,
      assigned_certificates: [],
      status: 'active',
      email: 'auditor@example.com',
      certificate_details: [],
    } as any;

    auditorService.findAll.mockResolvedValue({
      auditors: [mockAuditorRow],
      total: 1,
    });

    const res = await controller.listAuditors();
    expect(res.data).toHaveLength(1);
    expect(res.data[0].name).toBe('auditor@example.com');
    expect(res.data[0].id).toBe('user-2');
  });

  describe('updateAuditDate', () => {
    it('should update audit date successfully', async () => {
      const assessmentId = '550e8400-e29b-41d4-a716-446655440003';
      const auditDate = '2026-02-15T14:30:00.000Z';
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      const mockRequest = {
        user: { sub: userId },
      } as any;

      auditorService.updateAuditDate.mockResolvedValue({
        assessmentId,
        auditDate,
      });

      const result = await controller.updateAuditDate(
        mockRequest,
        assessmentId,
        { auditDate },
      );

      expect(result).toEqual({
        success: true,
        message: 'Audit date updated successfully',
        data: {
          assessmentId,
          auditDate,
        },
      });

      expect(auditorService.updateAuditDate).toHaveBeenCalledWith(
        assessmentId,
        userId,
        auditDate,
      );
    });
  });

  describe('getAssignedAssessments', () => {
    it('should use token user for auditor role', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440010';
      const mockRequest = {
        user: { sub: userId, role: 'auditor' },
      } as any;

      auditorService.getAssignedAssessments.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const result = await controller.getAssignedAssessments(
        mockRequest,
        1,
        10,
      );

      expect(result).toEqual({
        message: 'Assigned assessments retrieved successfully',
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      expect(auditorService.getAssignedAssessments).toHaveBeenCalledWith(
        userId,
        1,
        10,
        undefined,
        undefined,
      );
    });

    it('should pass assignedBy when provided', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440020';
      const assignerId = '550e8400-e29b-41d4-a716-446655440999';
      const mockRequest = {
        user: { sub: userId, role: 'auditor' },
      } as any;

      auditorService.getAssignedAssessments.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const result = await controller.getAssignedAssessments(
        mockRequest,
        1,
        10,
        undefined,
        undefined,
        assignerId as any,
      );

      expect(result).toEqual({
        message: 'Assigned assessments retrieved successfully',
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      expect(auditorService.getAssignedAssessments).toHaveBeenCalledWith(
        userId,
        1,
        10,
        undefined,
        assignerId,
      );
    });

    it('should allow admin to fetch by auditorId', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440011';
      const auditorId = '550e8400-e29b-41d4-a716-446655440012';
      const mockRequest = {
        user: { sub: userId, role: 'admin' },
      } as any;

      auditorService.findById.mockResolvedValue({
        id: auditorId,
        user_id: '550e8400-e29b-41d4-a716-446655440013',
      } as any);

      auditorService.getAssignedAssessments.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 5,
      });

      const result = await controller.getAssignedAssessments(
        mockRequest,
        2,
        5,
        'submitted',
        auditorId,
      );

      expect(result).toEqual({
        message: 'Assigned assessments retrieved successfully',
        data: [],
        total: 0,
        page: 2,
        limit: 5,
      });

      expect(auditorService.findById).toHaveBeenCalledWith(auditorId);
      expect(auditorService.getAssignedAssessments).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440013',
        2,
        5,
        'submitted',
        undefined,
      );
    });
  });
});
