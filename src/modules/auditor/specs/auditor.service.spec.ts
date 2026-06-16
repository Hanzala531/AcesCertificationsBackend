import { Test, TestingModule } from '@nestjs/testing';
import { AuditorService } from '../auditor.service';
import { AuditorRepository } from '../auditor.repository';
import { AssessmentRepository } from '../../assessment/assessment.repository';
import { ChatService } from '../../chat/chat.service';
import { AssessmentInvitationService } from '../../assessment-invitation/assessment-invitation.service';
import { NotificationService } from '../../notification/services/notification.service';
import { AuditRepository } from '../../audit/audit.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AuditorService', () => {
  let service: AuditorService;
  let auditorRepo: jest.Mocked<AuditorRepository>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockAuditorId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCertificateId = '550e8400-e29b-41d4-a716-446655440002';

  const mockAuditor = {
    id: mockAuditorId,
    user_id: mockUserId,
    first_name: 'John',
    last_name: 'Doe',
    region: 'North America',
    profile_picture: 'https://example.com/avatar.jpg',
    assigned_certificates: [mockCertificateId],
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockAuditorRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      unassignCertificates: jest.fn(),
      delete: jest.fn(),
      addAssignedAssessment: jest.fn().mockResolvedValue(undefined),
      removeAssignedAssessment: jest.fn().mockResolvedValue(undefined),
      getCertificateName: jest.fn().mockResolvedValue('Test Certificate'),
      getOrganizationUserIds: jest.fn().mockResolvedValue([]),
    };

    const mockAssessmentRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAssessmentById: jest.fn(),
      assignAuditor: jest.fn(),
      updateAuditDate: jest.fn(),
      findAuditorByUserId: jest.fn(),
    };

    const mockChatService = {
      addParticipantToAssessmentThread: jest.fn().mockResolvedValue(undefined),
    };

    const mockInvitationService = {
      createInvitation: jest.fn(),
    };

    const mockNotificationService = {
      notifyUser: jest.fn().mockResolvedValue(undefined),
      notifyUsers: jest.fn().mockResolvedValue(undefined),
    };

    const mockAuditRepository = {
      createAuditOnAssignment: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditorService,
        { provide: AuditorRepository, useValue: mockAuditorRepository },
        { provide: AssessmentRepository, useValue: mockAssessmentRepository },
        { provide: ChatService, useValue: mockChatService },
        {
          provide: AssessmentInvitationService,
          useValue: mockInvitationService,
        },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AuditRepository, useValue: mockAuditRepository },
      ],
    }).compile();

    service = module.get<AuditorService>(AuditorService);
    auditorRepo = module.get(AuditorRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create auditor successfully with all fields', async () => {
      auditorRepo.create.mockResolvedValue(mockAuditor);

      const result = await service.create(
        mockUserId,
        'John',
        'Doe',
        'North America',
        'CA',
        'San Francisco',
        'https://example.com/avatar.jpg',
        [mockCertificateId],
        'active',
      );

      expect(result).toEqual(mockAuditor);
      expect(auditorRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'John',
        'Doe',
        'North America',
        'CA',
        'San Francisco',
        'https://example.com/avatar.jpg',
        [mockCertificateId],
        'active',
        undefined,
      );
    });

    it('should create auditor successfully with minimal required fields', async () => {
      const minimalAuditor = {
        ...mockAuditor,
        region: null,
        profile_picture: null,
        assigned_certificates: [],
        status: 'available',
      };
      auditorRepo.create.mockResolvedValue(minimalAuditor);

      const result = await service.create(mockUserId, 'Jane', 'Smith');

      expect(result).toEqual(minimalAuditor);
      expect(auditorRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'Jane',
        'Smith',
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        'available',
        undefined,
      );
    });

    it('should create auditor with custom status', async () => {
      const customAuditor = { ...mockAuditor, status: 'inactive' };
      auditorRepo.create.mockResolvedValue(customAuditor);

      const result = await service.create(
        mockUserId,
        'Bob',
        'Johnson',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'inactive',
      );

      expect(result).toEqual(customAuditor);
      expect(auditorRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'Bob',
        'Johnson',
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        'inactive',
        undefined,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.create('', 'John', 'Doe')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty first name', async () => {
      await expect(service.create(mockUserId, '', 'Doe')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty last name', async () => {
      await expect(service.create(mockUserId, 'John', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should find auditor by user ID', async () => {
      auditorRepo.findByUserId.mockResolvedValue(mockAuditor);

      const result = await service.findByUserId(mockUserId);

      expect(result).toEqual(mockAuditor);
      expect(auditorRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('should return null when auditor not found by user ID', async () => {
      auditorRepo.findByUserId.mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent-user-id');

      expect(result).toBeNull();
      expect(auditorRepo.findByUserId).toHaveBeenCalledWith(
        'nonexistent-user-id',
      );
    });
  });

  describe('findById', () => {
    it('should find auditor by ID', async () => {
      auditorRepo.findById.mockResolvedValue(mockAuditor);

      const result = await service.findById(mockAuditorId);

      expect(result).toEqual(mockAuditor);
      expect(auditorRepo.findById).toHaveBeenCalledWith(mockAuditorId);
    });

    it('should throw NotFoundException when auditor not found by ID', async () => {
      auditorRepo.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent-auditor-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    const mockAuditors = [mockAuditor];

    it('should return all auditors', async () => {
      auditorRepo.findAll.mockResolvedValue({
        auditors: mockAuditors,
        total: 1,
      });

      const result = await service.findAll();

      expect(result).toEqual({ auditors: mockAuditors, total: 1 });
      expect(auditorRepo.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no auditors exist', async () => {
      auditorRepo.findAll.mockResolvedValue({ auditors: [], total: 0 });

      const result = await service.findAll();

      expect(result).toEqual({ auditors: [], total: 0 });
    });
  });

  describe('update', () => {
    it('should update auditor successfully', async () => {
      const updateFields = {
        first_name: 'Updated John',
        last_name: 'Updated Doe',
        region: 'Europe',
        status: 'inactive',
      };
      const updatedAuditor = { ...mockAuditor, ...updateFields };
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.update.mockResolvedValue(updatedAuditor);

      const result = await service.update(mockAuditorId, updateFields);

      expect(result).toEqual(updatedAuditor);
      expect(auditorRepo.findById).toHaveBeenCalledWith(mockAuditorId);
      expect(auditorRepo.update).toHaveBeenCalledWith(
        mockAuditorId,
        updateFields,
      );
    });

    it('should update single field', async () => {
      const updateFields = { first_name: 'New Name' };
      const updatedAuditor = { ...mockAuditor, first_name: 'New Name' };
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.update.mockResolvedValue(updatedAuditor);

      const result = await service.update(mockAuditorId, updateFields);

      expect(result?.first_name).toBe('New Name');
      expect(auditorRepo.update).toHaveBeenCalledWith(
        mockAuditorId,
        updateFields,
      );
    });

    it('should update assigned certificates', async () => {
      const updateFields = { assigned_certificates: ['cert-1', 'cert-2'] };
      const updatedAuditor = {
        ...mockAuditor,
        assigned_certificates: ['cert-1', 'cert-2'],
      };
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.update.mockResolvedValue(updatedAuditor);

      const result = await service.update(mockAuditorId, updateFields);

      expect(result?.assigned_certificates).toEqual(['cert-1', 'cert-2']);
    });

    it('should update profile picture', async () => {
      const updateFields = { profile_picture: 'https://new-avatar.jpg' };
      const updatedAuditor = {
        ...mockAuditor,
        profile_picture: 'https://new-avatar.jpg',
      };
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.update.mockResolvedValue(updatedAuditor);

      const result = await service.update(mockAuditorId, updateFields);

      expect(result?.profile_picture).toBe('https://new-avatar.jpg');
    });

    it('should return original auditor when no valid fields provided', async () => {
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.update.mockResolvedValue(mockAuditor);

      const result = await service.update(mockAuditorId, {
        invalid_field: 'value',
      } as any);

      expect(result).toEqual(mockAuditor);
    });

    it('should throw NotFoundException when auditor to update not found', async () => {
      auditorRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-auditor', { first_name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty update object', async () => {
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.update.mockResolvedValue(mockAuditor);

      const result = await service.update(mockAuditorId, {});

      expect(result).toEqual(mockAuditor);
    });
  });

  describe('unassignCertificates', () => {
    it('should unassign certificates successfully', async () => {
      const updatedAuditor = { ...mockAuditor, assigned_certificates: [] };
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.unassignCertificates.mockResolvedValue(updatedAuditor);

      const result = await service.unassignCertificates(mockAuditorId, [
        mockCertificateId,
      ]);

      expect(result?.assigned_certificates).toEqual([]);
      expect(auditorRepo.findById).toHaveBeenCalledWith(mockAuditorId);
      expect(auditorRepo.unassignCertificates).toHaveBeenCalledWith(
        mockAuditorId,
        [mockCertificateId],
      );
    });

    it('should unassign multiple certificates', async () => {
      const certIds = ['cert-1', 'cert-2', 'cert-3'];
      const updatedAuditor = { ...mockAuditor, assigned_certificates: [] };
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.unassignCertificates.mockResolvedValue(updatedAuditor);

      const result = await service.unassignCertificates(mockAuditorId, certIds);

      expect(result?.assigned_certificates).toEqual([]);
      expect(auditorRepo.unassignCertificates).toHaveBeenCalledWith(
        mockAuditorId,
        certIds,
      );
    });

    it('should handle empty certificates array', async () => {
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.unassignCertificates.mockResolvedValue(mockAuditor); // No change

      const result = await service.unassignCertificates(mockAuditorId, []);

      expect(result?.assigned_certificates).toEqual([mockCertificateId]);
    });

    it('should throw NotFoundException when auditor not found for certificate unassignment', async () => {
      auditorRepo.findById.mockResolvedValue(null);

      await expect(
        service.unassignCertificates('nonexistent-auditor', [
          mockCertificateId,
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle unassigning non-existent certificates', async () => {
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.unassignCertificates.mockResolvedValue(mockAuditor); // Certificates remain unchanged

      const result = await service.unassignCertificates(mockAuditorId, [
        'non-existent-cert',
      ]);

      expect(result?.assigned_certificates).toEqual([mockCertificateId]);
    });
  });

  describe('delete', () => {
    it('should delete auditor successfully', async () => {
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.delete.mockResolvedValue(true);

      const result = await service.delete(mockAuditorId);

      expect(result).toBe(true);
      expect(auditorRepo.findById).toHaveBeenCalledWith(mockAuditorId);
      expect(auditorRepo.delete).toHaveBeenCalledWith(mockAuditorId);
    });

    it('should throw NotFoundException when auditor to delete not found', async () => {
      auditorRepo.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent-auditor')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete auditor lifecycle', async () => {
      // Create User qyery
      auditorRepo.create.mockResolvedValue(mockAuditor);
      const created = await service.create(
        mockUserId,
        'John',
        'Doe',
        'North America',
        'CA',
        'San Francisco',
        'avatar.jpg',
        [mockCertificateId],
        'active',
      );
      expect(created).toEqual(mockAuditor);

      // Find by ID
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      const found = await service.findById(mockAuditorId);
      expect(found).toEqual(mockAuditor);

      // Find by user ID
      auditorRepo.findByUserId.mockResolvedValue(mockAuditor);
      const findByUser = await service.findByUserId(mockUserId);
      expect(findByUser).toEqual(mockAuditor);

      // Find all
      auditorRepo.findAll.mockResolvedValue({
        auditors: [mockAuditor],
        total: 1,
      });
      const all = await service.findAll();
      expect(all.auditors).toHaveLength(1);

      // Update
      const updateFields = { first_name: 'Updated John', region: 'Europe' };
      const updatedAuditor = { ...mockAuditor, ...updateFields };
      auditorRepo.findById.mockResolvedValue(mockAuditor);
      auditorRepo.update.mockResolvedValue(updatedAuditor);
      const updated = await service.update(mockAuditorId, updateFields);
      expect(updated?.first_name).toBe('Updated John');
      expect(updated?.region).toBe('Europe');

      // Unassign certificates
      const auditorWithoutCerts = {
        ...updatedAuditor,
        assigned_certificates: [],
      };
      auditorRepo.findById.mockResolvedValue(updatedAuditor);
      auditorRepo.unassignCertificates.mockResolvedValue(auditorWithoutCerts);
      const withoutCerts = await service.unassignCertificates(mockAuditorId, [
        mockCertificateId,
      ]);
      expect(withoutCerts?.assigned_certificates).toEqual([]);

      // Delete
      auditorRepo.findById.mockResolvedValue(auditorWithoutCerts);
      auditorRepo.delete.mockResolvedValue(true);
      const deleted = await service.delete(mockAuditorId);
      expect(deleted).toBe(true);

      // Verify all repository methods were called appropriately
      expect(auditorRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'John',
        'Doe',
        'North America',
        'CA',
        'San Francisco',
        'avatar.jpg',
        [mockCertificateId],
        'active',
        undefined,
      );
      expect(auditorRepo.findById).toHaveBeenCalledTimes(4);
      expect(auditorRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(auditorRepo.findAll).toHaveBeenCalled();
      expect(auditorRepo.update).toHaveBeenCalled();
      expect(auditorRepo.unassignCertificates).toHaveBeenCalled();
      expect(auditorRepo.delete).toHaveBeenCalled();
    });

    it('should handle multiple auditors operations', async () => {
      const auditor1 = {
        ...mockAuditor,
        id: 'aud-1',
        user_id: 'user-1',
        first_name: 'Alice',
        region: 'Asia',
      };
      const auditor2 = {
        ...mockAuditor,
        id: 'aud-2',
        user_id: 'user-2',
        first_name: 'Bob',
        region: 'Europe',
      };
      const allAuditors = [auditor1, auditor2];

      // Create multiple auditors
      auditorRepo.create
        .mockResolvedValueOnce(auditor1)
        .mockResolvedValueOnce(auditor2);

      const created1 = await service.create(
        'user-1',
        'Alice',
        'Johnson',
        'Asia',
      );
      const created2 = await service.create('user-2', 'Bob', 'Smith', 'Europe');

      expect(created1.first_name).toBe('Alice');
      expect(created2.first_name).toBe('Bob');
      expect(created1.region).toBe('Asia');
      expect(created2.region).toBe('Europe');

      // Find all auditors
      auditorRepo.findAll.mockResolvedValue({
        auditors: allAuditors,
        total: 2,
      });
      const foundAll = await service.findAll();
      expect(foundAll.auditors).toHaveLength(2);

      // Find specific auditors
      auditorRepo.findById
        .mockResolvedValueOnce(auditor1)
        .mockResolvedValueOnce(auditor2);

      const found1 = await service.findById('aud-1');
      const found2 = await service.findById('aud-2');

      expect(found1.first_name).toBe('Alice');
      expect(found2.first_name).toBe('Bob');
    });

    it('should handle certificate assignment operations', async () => {
      // Create auditor with certificates
      const auditorWithCerts = {
        ...mockAuditor,
        assigned_certificates: ['cert-1', 'cert-2', 'cert-3'],
      };
      auditorRepo.create.mockResolvedValue(auditorWithCerts);

      const created = await service.create(
        mockUserId,
        'Sarah',
        'Wilson',
        'North America',
        undefined,
        undefined,
        undefined,
        ['cert-1', 'cert-2', 'cert-3'],
      );
      expect(created.assigned_certificates).toHaveLength(3);

      // Update certificates
      const updatedCerts = {
        ...auditorWithCerts,
        assigned_certificates: ['cert-4', 'cert-5'],
      };
      auditorRepo.findById.mockResolvedValue(auditorWithCerts);
      auditorRepo.update.mockResolvedValue(updatedCerts);

      const updated = await service.update(mockAuditorId, {
        assigned_certificates: ['cert-4', 'cert-5'],
      });
      expect(updated?.assigned_certificates).toEqual(['cert-4', 'cert-5']);

      // Unassign some certificates
      const partiallyUnassigned = {
        ...updatedCerts,
        assigned_certificates: ['cert-4'],
      };
      auditorRepo.findById.mockResolvedValue(updatedCerts);
      auditorRepo.unassignCertificates.mockResolvedValue(partiallyUnassigned);

      const unassigned = await service.unassignCertificates(mockAuditorId, [
        'cert-5',
      ]);
      expect(unassigned?.assigned_certificates).toEqual(['cert-4']);

      // Unassign all certificates
      const noCerts = { ...partiallyUnassigned, assigned_certificates: [] };
      auditorRepo.findById.mockResolvedValue(partiallyUnassigned);
      auditorRepo.unassignCertificates.mockResolvedValue(noCerts);

      const fullyUnassigned = await service.unassignCertificates(
        mockAuditorId,
        ['cert-4'],
      );
      expect(fullyUnassigned?.assigned_certificates).toEqual([]);
    });

    // Validation scenarios testing
    it('should handle validation errors gracefully', async () => {
      await expect(service.create('', 'John', 'Doe')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockUserId, '', 'Doe')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockUserId, 'John', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('nonexistent', {})).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        service.unassignCertificates('nonexistent', []),
      ).rejects.toThrow(NotFoundException);

      expect(auditorRepo.create).not.toHaveBeenCalled();
      expect(auditorRepo.delete).not.toHaveBeenCalled();
      expect(auditorRepo.unassignCertificates).not.toHaveBeenCalled();
    });

    it('should handle status changes', async () => {
      const statuses = ['active', 'inactive', 'suspended', 'on_leave'];

      for (const status of statuses) {
        const auditorWithStatus = { ...mockAuditor, status };
        auditorRepo.findById.mockResolvedValue(mockAuditor);
        auditorRepo.update.mockResolvedValue(auditorWithStatus);

        const result = await service.update(mockAuditorId, { status });

        expect(result?.status).toBe(status);
      }
    });

    it('should handle regional assignments', async () => {
      const regions = ['North America', 'Europe', 'Asia', 'South America'];

      for (const region of regions) {
        const auditorInRegion = { ...mockAuditor, region };
        auditorRepo.create.mockResolvedValue(auditorInRegion);

        const result = await service.create(
          mockUserId,
          'Regional',
          'Auditor',
          region,
        );
        expect(result?.region).toBe(region);
      }
    });
  });

  describe('assignToAssessment', () => {
    it('should assign auditor to assessment with auditDate', async () => {
      const assessmentId = '550e8400-e29b-41d4-a716-446655440003';
      const auditDate = '2026-02-10T10:00:00.000Z';

      const mockAssessment = {
        id: assessmentId,
        organization_id: 'org-123',
        branch_id: 'branch-123',
        certificate_id: mockCertificateId,
        payment_id: 'payment-123',
        assessment_type: 'self_disclosure',
        badge_id: null,
        score: null,
        is_submitted: false,
        status: 'in_progress',
        submitted_at: null,
        completed_at: null,
        assigned_auditor_id: null,
        assigned_reviewer_id: null,
        audit_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdatedAssessment = {
        ...mockAssessment,
        assigned_auditor_id: mockUserId,
        audit_date: new Date(auditDate),
      };

      auditorRepo.findById.mockResolvedValue(mockAuditor);
      const mockAssessmentRepo = {
        findAssessmentById: jest.fn().mockResolvedValue(mockAssessment),
        assignAuditor: jest.fn().mockResolvedValue(mockUpdatedAssessment),
      };
      (service as any).assessmentRepo = mockAssessmentRepo;

      const result = await service.assignToAssessment(
        assessmentId,
        mockAuditorId,
        auditDate,
      );

      expect(result).toEqual({
        assessmentId: assessmentId,
        auditorId: mockAuditorId,
        auditorName: 'John Doe',
        auditDate: new Date(auditDate).toISOString(),
      });

      expect(mockAssessmentRepo.assignAuditor).toHaveBeenCalledWith(
        assessmentId,
        mockUserId,
        new Date(auditDate),
        undefined,
      );
    });

    it('should unassign auditor when auditorId is null', async () => {
      const assessmentId = '550e8400-e29b-41d4-a716-446655440003';

      const mockAssessment = {
        id: assessmentId,
        organization_id: 'org-123',
        branch_id: 'branch-123',
        certificate_id: mockCertificateId,
        payment_id: 'payment-123',
        assessment_type: 'self_disclosure',
        badge_id: null,
        score: null,
        is_submitted: false,
        status: 'in_progress',
        submitted_at: null,
        completed_at: null,
        assigned_auditor_id: mockUserId,
        assigned_reviewer_id: null,
        audit_date: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdatedAssessment = {
        ...mockAssessment,
        assigned_auditor_id: null,
        audit_date: null,
      };

      const mockAssessmentRepo = {
        findAssessmentById: jest.fn().mockResolvedValue(mockAssessment),
        assignAuditor: jest.fn().mockResolvedValue(mockUpdatedAssessment),
      };
      (service as any).assessmentRepo = mockAssessmentRepo;

      const result = await service.assignToAssessment(assessmentId, null);

      expect(result).toEqual({
        assessmentId: assessmentId,
        auditorId: null,
        auditorName: null,
        auditDate: null,
      });
    });

    it('should throw NotFoundException when assessment not found', async () => {
      const assessmentId = 'non-existent';

      const mockAssessmentRepo = {
        findAssessmentById: jest.fn().mockResolvedValue(null),
      };
      (service as any).assessmentRepo = mockAssessmentRepo;

      const assignerId = 'assigner-id';
      await expect(
        service.assignToAssessment(
          assessmentId,
          mockAuditorId,
          undefined,
          assignerId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when auditor not found', async () => {
      const assessmentId = '550e8400-e29b-41d4-a716-446655440003';

      const mockAssessment = {
        id: assessmentId,
        organization_id: 'org-123',
        branch_id: 'branch-123',
        certificate_id: mockCertificateId,
        payment_id: 'payment-123',
        assessment_type: 'self_disclosure',
        badge_id: null,
        score: null,
        is_submitted: false,
        status: 'in_progress',
        submitted_at: null,
        completed_at: null,
        assigned_auditor_id: null,
        assigned_reviewer_id: null,
        audit_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockAssessmentRepo = {
        findAssessmentById: jest.fn().mockResolvedValue(mockAssessment),
      };
      (service as any).assessmentRepo = mockAssessmentRepo;
      auditorRepo.findById.mockResolvedValue(null);

      await expect(
        service.assignToAssessment(assessmentId, 'non-existent-auditor'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAuditDate', () => {
    it('should update audit date for auditor assigned to assessment', async () => {
      const assessmentId = '550e8400-e29b-41d4-a716-446655440003';
      const auditDate = '2026-02-15T14:30:00.000Z';

      const mockAssessment = {
        id: assessmentId,
        organization_id: 'org-123',
        branch_id: 'branch-123',
        certificate_id: mockCertificateId,
        payment_id: 'payment-123',
        assessment_type: 'self_disclosure',
        badge_id: null,
        score: null,
        is_submitted: false,
        status: 'in_progress',
        submitted_at: null,
        completed_at: null,
        assigned_auditor_id: mockUserId,
        assigned_reviewer_id: null,
        audit_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdatedAssessment = {
        ...mockAssessment,
        audit_date: new Date(auditDate),
      };

      const mockAssessmentRepo = jest.mocked(service['assessmentRepo'] as any);
      mockAssessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);
      mockAssessmentRepo.findAuditorByUserId.mockResolvedValue({
        id: mockUserId,
      });
      mockAssessmentRepo.updateAuditDate.mockResolvedValue(
        mockUpdatedAssessment,
      );

      const result = await service.updateAuditDate(
        assessmentId,
        mockUserId,
        auditDate,
      );

      expect(result).toEqual({
        assessmentId: assessmentId,
        auditDate: new Date(auditDate).toISOString(),
      });

      expect(mockAssessmentRepo.updateAuditDate).toHaveBeenCalledWith(
        assessmentId,
        new Date(auditDate),
      );
    });

    it('should throw BadRequestException when auditor is not assigned to assessment', async () => {
      const assessmentId = '550e8400-e29b-41d4-a716-446655440003';
      const auditDate = '2026-02-15T14:30:00.000Z';
      const otherAuditorId = '550e8400-e29b-41d4-a716-446655440099';

      const mockAssessment = {
        id: assessmentId,
        organization_id: 'org-123',
        branch_id: 'branch-123',
        certificate_id: mockCertificateId,
        payment_id: 'payment-123',
        assessment_type: 'self_disclosure',
        badge_id: null,
        score: null,
        is_submitted: false,
        status: 'in_progress',
        submitted_at: null,
        completed_at: null,
        assigned_auditor_id: otherAuditorId,
        assigned_reviewer_id: null,
        audit_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockAssessmentRepo = jest.mocked(service['assessmentRepo'] as any);
      mockAssessmentRepo.findAssessmentById.mockResolvedValue(mockAssessment);

      await expect(
        service.updateAuditDate(assessmentId, mockUserId, auditDate),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when assessment not found', async () => {
      const assessmentId = 'non-existent';
      const auditDate = '2026-02-15T14:30:00.000Z';

      const mockAssessmentRepo = jest.mocked(service['assessmentRepo'] as any);
      mockAssessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.updateAuditDate(assessmentId, mockUserId, auditDate),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAssignedAssessments', () => {
    it('should retrieve assigned assessments without filters', async () => {
      const mockAssessments = {
        data: [
          {
            id: 'assessment-1',
            organization_id: 'org-1',
            certificate_id: 'cert-1',
            assigned_auditor_id: mockUserId,
            assigned_by: 'admin-user-id',
          } as any,
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      auditorRepo.findByUserId.mockResolvedValue(mockAuditor);
      const mockAssessmentRepo = {
        findAssessmentsByAuditor: jest.fn().mockResolvedValue(mockAssessments),
      };
      (service as any).assessmentRepo = mockAssessmentRepo;

      const result = await service.getAssignedAssessments(mockUserId, 1, 10);

      expect(result).toEqual(mockAssessments);
      expect(mockAssessmentRepo.findAssessmentsByAuditor).toHaveBeenCalledWith(
        mockUserId,
        {
          page: 1,
          limit: 10,
          status: undefined,
          assignedByRole: undefined,
        },
      );
    });

    it('should retrieve assigned assessments with status filter', async () => {
      const mockAssessments = {
        data: [
          {
            id: 'assessment-1',
            status: 'submitted',
            assigned_auditor_id: mockUserId,
          } as any,
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      auditorRepo.findByUserId.mockResolvedValue(mockAuditor);
      const mockAssessmentRepo = {
        findAssessmentsByAuditor: jest.fn().mockResolvedValue(mockAssessments),
      };
      (service as any).assessmentRepo = mockAssessmentRepo;

      const result = await service.getAssignedAssessments(
        mockUserId,
        1,
        10,
        'submitted',
      );

      expect(result).toEqual(mockAssessments);
      expect(mockAssessmentRepo.findAssessmentsByAuditor).toHaveBeenCalledWith(
        mockUserId,
        {
          page: 1,
          limit: 10,
          status: 'submitted',
          assignedByRole: undefined,
        },
      );
    });

    it('should retrieve assigned assessments with assignedByRole filter', async () => {
      const adminRole = 'admin';
      const mockAssessments = {
        data: [
          {
            id: 'assessment-1',
            assigned_auditor_id: mockUserId,
            assigned_by: 'some-admin-id',
          } as any,
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      auditorRepo.findByUserId.mockResolvedValue(mockAuditor);
      const mockAssessmentRepo = {
        findAssessmentsByAuditor: jest.fn().mockResolvedValue(mockAssessments),
      };
      (service as any).assessmentRepo = mockAssessmentRepo;

      const result = await service.getAssignedAssessments(
        mockUserId,
        1,
        10,
        undefined,
        adminRole as any,
      );

      expect(result).toEqual(mockAssessments);
      expect(mockAssessmentRepo.findAssessmentsByAuditor).toHaveBeenCalledWith(
        mockUserId,
        {
          page: 1,
          limit: 10,
          status: undefined,
          assignedByRole: adminRole,
        },
      );
    });

    it('should throw NotFoundException when auditor not found', async () => {
      auditorRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.getAssignedAssessments(mockUserId, 1, 10),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignToAssessment with assigned_by', () => {
    it('should assign auditor and track who assigned it', async () => {
      const assessmentId = '550e8400-e29b-41d4-a716-446655440003';
      const auditDate = '2026-02-10T10:00:00.000Z';
      const assignerId = '550e8400-e29b-41d4-a716-446655440099';

      const mockAssessment = {
        id: assessmentId,
        organization_id: 'org-123',
        assigned_auditor_id: null,
        assigned_by: null,
      } as any;

      const mockUpdatedAssessment = {
        ...mockAssessment,
        assigned_auditor_id: mockUserId,
        assigned_by: assignerId,
        audit_date: new Date(auditDate),
      };

      auditorRepo.findById.mockResolvedValue(mockAuditor);
      const mockAssessmentRepo = {
        findAssessmentById: jest.fn().mockResolvedValue(mockAssessment),
        assignAuditor: jest.fn().mockResolvedValue(mockUpdatedAssessment),
      };
      (service as any).assessmentRepo = mockAssessmentRepo;

      const result = await service.assignToAssessment(
        assessmentId,
        mockAuditorId,
        auditDate,
        assignerId,
      );

      expect(result.auditorName).toBe('John Doe');
      expect(mockAssessmentRepo.assignAuditor).toHaveBeenCalledWith(
        assessmentId,
        mockUserId,
        new Date(auditDate),
        assignerId,
      );
    });
  });
});
