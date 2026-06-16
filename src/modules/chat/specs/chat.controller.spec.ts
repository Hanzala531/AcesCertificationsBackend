import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';
import { ChatGateway } from '../chat.gateway';
import { HttpStatus } from '@nestjs/common';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;

  const mockUser = {
    sub: 'user-123',
    role: 'organization_member',
  };

  const mockThread = {
    id: 'thread-123',
    assessment_id: 'assessment-123',
    status: 'active',
    certificate_name: 'Test Certificate',
    organization_name: 'Test Org',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockMessage = {
    id: 'message-123',
    thread_id: 'thread-123',
    sender_id: 'user-123',
    sender_name: 'John Doe',
    sender_role: 'applicant',
    content: 'Test message',
    is_system_message: false,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            validateChatAccess: jest.fn(),
            createThread: jest.fn(),
            getThread: jest.fn(),
            getThreadByAssessmentId: jest.fn(),
            getThreadsForUser: jest.fn(),
            sendMessage: jest.fn(),
            getMessages: jest.fn(),
            getParticipants: jest.fn(),
            addParticipant: jest.fn(),
            lockThread: jest.fn(),
            findOrCreateAuditorReviewerThread: jest.fn(),
          },
        },
        {
          provide: ChatGateway,
          useValue: {
            notifyNewMessage: jest.fn().mockResolvedValue(undefined),
            notifyThreadLocked: jest.fn().mockResolvedValue(undefined),
            broadcastToThread: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);
  });

  describe('createThread', () => {
    it('should create thread successfully', async () => {
      chatService.validateChatAccess.mockResolvedValue({
        canAccess: true,
        participantRole: 'applicant',
      });
      chatService.createThread.mockResolvedValue(mockThread as any);

      const result = await controller.createThread({ user: mockUser } as any, {
        assessmentId: 'assessment-123',
      });

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe('thread-123');
    });

    it('should return error if user cannot access assessment', async () => {
      chatService.validateChatAccess.mockResolvedValue({
        canAccess: false,
        participantRole: null,
      });

      const result = await controller.createThread({ user: mockUser } as any, {
        assessmentId: 'assessment-123',
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('getUserThreads', () => {
    it('should return user threads', async () => {
      chatService.getThreadsForUser.mockResolvedValue([mockThread] as any);

      const result = await controller.getUserThreads({ user: mockUser } as any);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getThread', () => {
    it('should return thread details', async () => {
      chatService.getThread.mockResolvedValue(mockThread as any);

      const result = await controller.getThread(
        { user: mockUser } as any,
        'thread-123',
      );

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('thread-123');
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      chatService.sendMessage.mockResolvedValue(mockMessage as any);

      const result = await controller.sendMessage(
        { user: mockUser } as any,
        'thread-123',
        { content: 'Test message' },
      );

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Test message');
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      chatService.getMessages.mockResolvedValue({
        messages: [mockMessage],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
        hasMore: false,
      } as any);

      const result = await controller.getMessages(
        { user: mockUser } as any,
        'thread-123',
        { page: 1, limit: 50 },
      );

      expect(result.success).toBe(true);
      expect(result.data.messages).toHaveLength(1);
      expect(result.data.total).toBe(1);
    });
  });

  describe('lockThread', () => {
    it('should lock thread successfully (admin)', async () => {
      chatService.lockThread.mockResolvedValue({
        ...mockThread,
        status: 'locked',
        locked_at: new Date(),
        locked_reason: 'Certificate issued',
      } as any);

      const result = await controller.lockThread('thread-123', {
        reason: 'Certificate issued',
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('locked');
    });
  });

  describe('getParticipants', () => {
    it('should return participants', async () => {
      chatService.getParticipants.mockResolvedValue([
        {
          id: 'participant-123',
          user_id: 'user-123',
          first_name: 'John',
          last_name: 'Doe',
          role: 'applicant',
          joined_at: new Date(),
        },
      ] as any);

      const result = await controller.getParticipants(
        { user: mockUser } as any,
        'thread-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('createAuditorReviewerThread', () => {
    const auditorUser = { sub: 'auditor-123', role: 'auditor' };

    it('should create thread without message', async () => {
      chatService.findOrCreateAuditorReviewerThread.mockResolvedValue(mockThread as any);

      const result = await controller.createAuditorReviewerThread(
        { user: auditorUser } as any,
        { assessmentId: 'assessment-123' },
      );

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('thread-123');
      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });

    it('should create thread and send first message when provided', async () => {
      chatService.findOrCreateAuditorReviewerThread.mockResolvedValue(mockThread as any);
      chatService.sendMessage.mockResolvedValue(mockMessage as any);

      const result = await controller.createAuditorReviewerThread(
        { user: auditorUser } as any,
        { assessmentId: 'assessment-123', message: 'Need to discuss findings' },
      );

      expect(result.success).toBe(true);
      expect(chatService.sendMessage).toHaveBeenCalledWith(
        'thread-123',
        'auditor-123',
        'Need to discuss findings',
        'auditor',
      );
    });

    it('should not send message when message is empty string', async () => {
      chatService.findOrCreateAuditorReviewerThread.mockResolvedValue(mockThread as any);

      await controller.createAuditorReviewerThread(
        { user: auditorUser } as any,
        { assessmentId: 'assessment-123', message: '   ' },
      );

      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });

    it('should work for reviewer role too', async () => {
      const reviewerUser = { sub: 'reviewer-123', role: 'reviewer' };
      chatService.findOrCreateAuditorReviewerThread.mockResolvedValue(mockThread as any);
      chatService.sendMessage.mockResolvedValue(mockMessage as any);

      const result = await controller.createAuditorReviewerThread(
        { user: reviewerUser } as any,
        { assessmentId: 'assessment-123', message: 'Starting review discussion' },
      );

      expect(result.success).toBe(true);
      expect(chatService.sendMessage).toHaveBeenCalledWith(
        'thread-123',
        'reviewer-123',
        'Starting review discussion',
        'reviewer',
      );
    });
  });
});
