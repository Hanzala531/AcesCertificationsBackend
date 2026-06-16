import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat.service';
import { ChatRepository } from '../chat.repository';
import { AssessmentRepository } from '../../assessment/assessment.repository';
import { SupportTicketRepository } from '../../support-ticket/support-ticket.repository';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let chatRepo: jest.Mocked<ChatRepository>;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;

  const mockThread = {
    id: 'thread-123',
    assessment_id: 'assessment-123',
    support_ticket_id: null,
    question_id: null,
    thread_type: 'auditor_applicant' as const,
    status: 'active' as const,
    created_at: new Date(),
    updated_at: new Date(),
    locked_at: null,
    locked_reason: null,
  };

  const mockThreadWithDetails = {
    ...mockThread,
    assessment_type: 'assured',
    certificate_name: 'Test Certificate',
    organization_name: 'Test Org',
    participant_count: 2,
  };

  const mockParticipant = {
    id: 'participant-123',
    thread_id: 'thread-123',
    user_id: 'user-123',
    role: 'applicant' as const,
    joined_at: new Date(),
    last_read_at: null,
  };

  const mockMessage = {
    id: 'message-123',
    thread_id: 'thread-123',
    sender_id: 'user-123',
    content: 'Test message',
    is_system_message: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAssessment = {
    id: 'assessment-123',
    organization_id: 'org-123',
    certificate_id: 'cert-123',
    status: 'in_progress',
    assigned_auditor_id: 'auditor-user-123',
    assigned_reviewer_id: 'reviewer-user-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: ChatRepository,
          useValue: {
            createThread: jest.fn(),
            findThreadById: jest.fn(),
            findThreadByAssessmentId: jest.fn(),
            findThreadByType: jest.fn(),
            findAllThreadsByAssessment: jest.fn(),
            findThreadWithDetails: jest.fn(),
            findThreadsForUser: jest.fn(),
            findThreadBySupportTicketId: jest.fn(),
            updateThreadStatus: jest.fn(),
            lockThreadsByAssessmentIds: jest.fn(),
            addParticipant: jest.fn(),
            findParticipant: jest.fn(),
            findParticipantsByThreadId: jest.fn(),
            updateLastRead: jest.fn(),
            createMessage: jest.fn(),
            findMessagesByThreadId: jest.fn(),
          },
        },
        {
          provide: AssessmentRepository,
          useValue: {
            findAssessmentById: jest.fn(),
            findAuditorByUserId: jest.fn(),
            findReviewerByUserId: jest.fn(),
            getOrganizationUserIds: jest.fn(),
            getApplicantUserIds: jest.fn(),
          },
        },
        {
          provide: SupportTicketRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    chatRepo = module.get(ChatRepository);
    assessmentRepo = module.get(AssessmentRepository);
  });

  describe('createThread', () => {
    it('should create a new auditor_applicant thread for active assessment', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      chatRepo.findThreadByType.mockResolvedValue(null);
      chatRepo.createThread.mockResolvedValue(mockThread);
      chatRepo.addParticipant.mockResolvedValue(mockParticipant);
      chatRepo.findThreadWithDetails.mockResolvedValue(mockThreadWithDetails);

      const result = await service.createThread(
        'assessment-123',
        'user-123',
        'applicant',
      );

      expect(result).toEqual(mockThreadWithDetails);
      expect(chatRepo.createThread).toHaveBeenCalledWith(
        'assessment-123',
        'auditor_applicant',
      );
      expect(chatRepo.addParticipant).toHaveBeenCalledWith(
        'thread-123',
        'user-123',
        'applicant',
      );
    });

    it('should return existing thread and add creator as participant if thread already exists', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      chatRepo.findThreadByType.mockResolvedValue(mockThread);
      chatRepo.findThreadWithDetails.mockResolvedValue(mockThreadWithDetails);
      chatRepo.addParticipant.mockResolvedValue(mockParticipant);

      const result = await service.createThread(
        'assessment-123',
        'user-123',
        'applicant',
      );

      expect(result).toEqual(mockThreadWithDetails);
      expect(chatRepo.createThread).not.toHaveBeenCalled();
      expect(chatRepo.addParticipant).toHaveBeenCalledWith(
        'thread-123',
        'user-123',
        'applicant',
      );
    });

    it('should throw NotFoundException if assessment not found', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.createThread('invalid-assessment', 'user-123', 'applicant'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for completed non-assured assessment', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue({
        ...mockAssessment,
        status: 'completed',
        assessment_type: 'self_disclosure',
      } as any);

      await expect(
        service.createThread('assessment-123', 'user-123', 'applicant'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getThread', () => {
    it('should return thread for participant', async () => {
      chatRepo.findThreadWithDetails.mockResolvedValue(mockThreadWithDetails);
      chatRepo.findParticipant.mockResolvedValue(mockParticipant);

      const result = await service.getThread('thread-123', 'user-123');

      expect(result).toEqual(mockThreadWithDetails);
    });

    it('should throw NotFoundException if thread not found', async () => {
      chatRepo.findThreadWithDetails.mockResolvedValue(null);

      await expect(
        service.getThread('invalid-thread', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not participant', async () => {
      chatRepo.findThreadWithDetails.mockResolvedValue(mockThreadWithDetails);
      chatRepo.findParticipant.mockResolvedValue(null);

      await expect(
        service.getThread('thread-123', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendMessage', () => {
    it('should send message to active thread', async () => {
      chatRepo.findThreadById.mockResolvedValue(mockThread);
      chatRepo.findParticipant.mockResolvedValue(mockParticipant);
      chatRepo.createMessage.mockResolvedValue(mockMessage);
      chatRepo.findParticipantsByThreadId.mockResolvedValue([
        { ...mockParticipant, first_name: 'John', last_name: 'Doe' },
      ]);

      const result = await service.sendMessage(
        'thread-123',
        'user-123',
        'Test message',
      );

      expect(result.content).toBe('Test message');
      expect(chatRepo.createMessage).toHaveBeenCalledWith(
        'thread-123',
        'user-123',
        'Test message',
      );
    });

    it('should throw BadRequestException for locked thread', async () => {
      chatRepo.findThreadById.mockResolvedValue({
        ...mockThread,
        status: 'locked',
      });

      await expect(
        service.sendMessage('thread-123', 'user-123', 'Test message'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user is not participant', async () => {
      chatRepo.findThreadById.mockResolvedValue(mockThread);
      chatRepo.findParticipant.mockResolvedValue(null);

      await expect(
        service.sendMessage('thread-123', 'other-user', 'Test message'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      chatRepo.findParticipant.mockResolvedValue(mockParticipant);
      chatRepo.findMessagesByThreadId.mockResolvedValue({
        messages: [mockMessage],
        total: 1,
      });

      const result = await service.getMessages('thread-123', 'user-123', {
        page: 1,
        limit: 50,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(chatRepo.updateLastRead).toHaveBeenCalledWith(
        'thread-123',
        'user-123',
      );
    });

    it('should throw ForbiddenException if user is not participant', async () => {
      chatRepo.findParticipant.mockResolvedValue(null);

      await expect(
        service.getMessages('thread-123', 'other-user', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('lockThread', () => {
    it('should lock active thread', async () => {
      chatRepo.findThreadById.mockResolvedValue(mockThread);
      chatRepo.updateThreadStatus.mockResolvedValue({
        ...mockThread,
        status: 'locked',
        locked_at: new Date(),
      });
      chatRepo.createMessage.mockResolvedValue(mockMessage);

      const result = await service.lockThread(
        'thread-123',
        'Certificate issued',
      );

      expect(result.status).toBe('locked');
      expect(chatRepo.updateThreadStatus).toHaveBeenCalledWith(
        'thread-123',
        'locked',
        'Certificate issued',
      );
    });

    it('should return thread if already locked', async () => {
      const lockedThread = { ...mockThread, status: 'locked' as const };
      chatRepo.findThreadById.mockResolvedValue(lockedThread);

      const result = await service.lockThread('thread-123', 'Already locked');

      expect(result).toEqual(lockedThread);
      expect(chatRepo.updateThreadStatus).not.toHaveBeenCalled();
    });
  });

  describe('validateChatAccess', () => {
    it('should allow organization member as applicant', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );

      const result = await service.validateChatAccess(
        'user-123',
        'organization_member',
        'assessment-123',
      );

      expect(result.canAccess).toBe(true);
      expect(result.participantRole).toBe('applicant');
    });

    it('should allow assigned auditor', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findAuditorByUserId.mockResolvedValue({
        id: 'auditor-user-123',
      });

      const result = await service.validateChatAccess(
        'auditor-user-123',
        'auditor',
        'assessment-123',
      );

      expect(result.canAccess).toBe(true);
      expect(result.participantRole).toBe('auditor');
    });

    it('should allow assigned reviewer', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findReviewerByUserId.mockResolvedValue({
        id: 'reviewer-user-123',
      });

      const result = await service.validateChatAccess(
        'reviewer-user-123',
        'reviewer',
        'assessment-123',
      );

      expect(result.canAccess).toBe(true);
      expect(result.participantRole).toBe('reviewer');
    });

    it('should deny unassigned auditor', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );
      assessmentRepo.findAuditorByUserId.mockResolvedValue(null);

      const result = await service.validateChatAccess(
        'other-auditor',
        'auditor',
        'assessment-123',
      );

      expect(result.canAccess).toBe(false);
      expect(result.participantRole).toBeNull();
    });

    it('should deny access for non-existent assessment', async () => {
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      const result = await service.validateChatAccess(
        'user-123',
        'organization',
        'invalid-assessment',
      );

      expect(result.canAccess).toBe(false);
    });
  });

  describe('findOrCreateTypedThread', () => {
    it('should return existing thread and add creator as participant if found', async () => {
      chatRepo.findThreadByType.mockResolvedValue(mockThread);
      chatRepo.addParticipant.mockResolvedValue(mockParticipant);
      chatRepo.findThreadWithDetails.mockResolvedValue(mockThreadWithDetails);

      const result = await service.findOrCreateTypedThread(
        'assessment-123',
        'auditor_reviewer',
        'auditor-user',
        'auditor',
      );

      expect(chatRepo.createThread).not.toHaveBeenCalled();
      expect(chatRepo.addParticipant).toHaveBeenCalledWith(
        'thread-123',
        'auditor-user',
        'auditor',
      );
      expect(result).toEqual(mockThreadWithDetails);
    });

    it('should create thread and add creator + secondary participants when not found', async () => {
      chatRepo.findThreadByType.mockResolvedValue(null);
      chatRepo.createThread.mockResolvedValue(mockThread);
      chatRepo.addParticipant.mockResolvedValue(mockParticipant);
      chatRepo.findThreadWithDetails.mockResolvedValue(mockThreadWithDetails);

      const result = await service.findOrCreateTypedThread(
        'assessment-123',
        'auditor_reviewer',
        'auditor-user',
        'auditor',
        ['reviewer-user-1'],
        'reviewer',
      );

      expect(chatRepo.createThread).toHaveBeenCalledWith(
        'assessment-123',
        'auditor_reviewer',
        undefined,
        undefined,
      );
      expect(chatRepo.addParticipant).toHaveBeenCalledWith(
        'thread-123',
        'auditor-user',
        'auditor',
      );
      expect(chatRepo.addParticipant).toHaveBeenCalledWith(
        'thread-123',
        'reviewer-user-1',
        'reviewer',
      );
      expect(result).toEqual(mockThreadWithDetails);
    });

    it('should create reviewer_applicant thread without secondary participants when none provided', async () => {
      chatRepo.findThreadByType.mockResolvedValue(null);
      chatRepo.createThread.mockResolvedValue(mockThread);
      chatRepo.addParticipant.mockResolvedValue(mockParticipant);
      chatRepo.findThreadWithDetails.mockResolvedValue(mockThreadWithDetails);

      await service.findOrCreateTypedThread(
        'assessment-123',
        'reviewer_applicant',
        'reviewer-user',
        'reviewer',
      );

      expect(chatRepo.createThread).toHaveBeenCalledWith(
        'assessment-123',
        'reviewer_applicant',
        undefined,
        undefined,
      );
      // Only creator participant added (no secondary)
      expect(chatRepo.addParticipant).toHaveBeenCalledTimes(1);
      expect(chatRepo.addParticipant).toHaveBeenCalledWith(
        'thread-123',
        'reviewer-user',
        'reviewer',
      );
    });
  });

  describe('getAssessmentThreadsForAdmin', () => {
    const mockAdminThread = {
      id: 'thread-123',
      assessment_id: 'assessment-123',
      question_id: null,
      thread_type: 'auditor_applicant' as const,
      status: 'active' as const,
      certificate_name: 'ISO 9001',
      organization_name: 'ACME Corp',
      assessment_type: 'assured',
      participant_count: 3,
      message_count: 10,
      last_message_preview: 'Please review',
      created_at: new Date(),
      updated_at: new Date(),
      locked_at: null,
      locked_reason: null,
    };

    it('should return all threads grouped under assessment info', async () => {
      chatRepo.findAllThreadsByAssessment.mockResolvedValue([mockAdminThread]);

      const result = await service.getAssessmentThreadsForAdmin('assessment-123');

      expect(result.assessmentId).toBe('assessment-123');
      expect(result.certificateName).toBe('ISO 9001');
      expect(result.organizationName).toBe('ACME Corp');
      expect(result.threads).toHaveLength(1);
      expect(result.threads[0].thread_type).toBe('auditor_applicant');
    });

    it('should return empty threads array and assessment info when no threads exist', async () => {
      chatRepo.findAllThreadsByAssessment.mockResolvedValue([]);
      assessmentRepo.findAssessmentById.mockResolvedValue(
        mockAssessment as any,
      );

      const result = await service.getAssessmentThreadsForAdmin('assessment-123');

      expect(result.assessmentId).toBe('assessment-123');
      expect(result.threads).toHaveLength(0);
    });

    it('should throw NotFoundException when assessment not found and no threads exist', async () => {
      chatRepo.findAllThreadsByAssessment.mockResolvedValue([]);
      assessmentRepo.findAssessmentById.mockResolvedValue(null);

      await expect(
        service.getAssessmentThreadsForAdmin('invalid-assessment'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getThreadBySupportTicketId', () => {
    const mockSupportThread = {
      ...mockThread,
      support_ticket_id: 'ticket-123',
      thread_type: 'support_ticket' as const,
    };

    const mockSupportThreadWithDetails = {
      ...mockSupportThread,
      assessment_type: null,
      certificate_name: null,
      organization_name: null,
      support_ticket_subject: 'Test Ticket',
      support_ticket_category: 'billing',
      participant_count: 1,
    };

    it('should return null when no thread exists for support ticket', async () => {
      chatRepo.findThreadBySupportTicketId.mockResolvedValue(null);

      const result = await service.getThreadBySupportTicketId(
        'ticket-123',
        'user-123',
        'admin',
      );

      expect(result).toBeNull();
    });

    it('should auto-add admin as participant when viewing thread', async () => {
      chatRepo.findThreadBySupportTicketId.mockResolvedValue(
        mockSupportThread as any,
      );
      chatRepo.addParticipant.mockResolvedValue(mockParticipant as any);
      chatRepo.findThreadWithDetails.mockResolvedValue(
        mockSupportThreadWithDetails as any,
      );

      const result = await service.getThreadBySupportTicketId(
        'ticket-123',
        'admin-user-123',
        'admin',
      );

      expect(chatRepo.addParticipant).toHaveBeenCalledWith(
        'thread-123',
        'admin-user-123',
        'admin',
      );
      expect(result).toBeDefined();
      expect(result?.support_ticket_subject).toBe('Test Ticket');
    });

    it('should throw ForbiddenException for non-admin non-participant', async () => {
      chatRepo.findThreadBySupportTicketId.mockResolvedValue(
        mockSupportThread as any,
      );
      chatRepo.findParticipant.mockResolvedValue(null);

      await expect(
        service.getThreadBySupportTicketId(
          'ticket-123',
          'random-user',
          'organization_member',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
