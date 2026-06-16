import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SupportTicketService } from '../support-ticket.service';
import { SupportTicketRepository } from '../support-ticket.repository';
import { CertificateRepository } from '../../certificate/certificate.repository';
import { ChatService } from '../../chat/chat.service';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationRepository } from '../../notification/notification.repository';

describe('SupportTicketService', () => {
  let service: SupportTicketService;
  let ticketRepo: jest.Mocked<SupportTicketRepository>;
  let certificateRepo: jest.Mocked<CertificateRepository>;
  let notificationService: jest.Mocked<NotificationService>;

  const mockCertificate = {
    id: 'cert-uuid-1',
    certificate_id: 'CERT-001',
    name: 'ISO 27001',
    disclosure_price: 100,
    is_published: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTicket = {
    id: 'ticket-uuid-1',
    user_id: 'user-uuid-1',
    subject: 'Certificate renewal issue',
    category: 'renewal',
    certificate_id: 'cert-uuid-1',
    description: 'I need help with my certificate renewal process.',
    supporting_document: 'https://example.com/doc.pdf',
    ticket_type: 'support' as const,
    target_type: 'certificate' as const,
    target_id: 'cert-uuid-1',
    metadata: {} as Record<string, unknown>,
    resolved_by: null,
    resolved_at: null,
    status: 'pending' as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTicketWithCert = {
    ...mockTicket,
    certificate_name: 'ISO 27001',
    product_id: 'CERT-001',
  };

  beforeEach(async () => {
    const mockTicketRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
      delete: jest.fn(),
    };

    const mockCertificateRepo = {
      findCertificateById: jest.fn(),
    };

    const mockChatService = {
      createSupportTicketThread: jest.fn(),
      lockSupportTicketThread: jest.fn(),
    };

    const mockNotificationService = {
      notifyUser: jest.fn().mockResolvedValue(undefined),
      notifyUsers: jest.fn().mockResolvedValue(undefined),
      notifyRole: jest.fn().mockResolvedValue(undefined),
      notifyRoles: jest.fn().mockResolvedValue(undefined),
      broadcast: jest.fn().mockResolvedValue(undefined),
      notify: jest.fn().mockResolvedValue(undefined),
    };

    const mockNotificationRepo = {
      getUserIdsByRoles: jest.fn().mockResolvedValue(['admin-uuid-1', 'admin-uuid-2']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketService,
        { provide: SupportTicketRepository, useValue: mockTicketRepo },
        { provide: CertificateRepository, useValue: mockCertificateRepo },
        { provide: ChatService, useValue: mockChatService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: NotificationRepository, useValue: mockNotificationRepo },
      ],
    }).compile();

    service = module.get<SupportTicketService>(SupportTicketService);
    ticketRepo = module.get(SupportTicketRepository);
    certificateRepo = module.get(CertificateRepository);
    notificationService = module.get(NotificationService);
  });

  describe('create', () => {
    it('should create a support ticket successfully', async () => {
      certificateRepo.findCertificateById.mockResolvedValue(
        mockCertificate as any,
      );
      ticketRepo.create.mockResolvedValue(mockTicket);

      const result = await service.create('user-uuid-1', {
        subject: 'Certificate renewal issue',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        description: 'I need help with my certificate renewal process.',
        supporting_document: 'https://example.com/doc.pdf',
      });

      expect(result.id).toBe('ticket-uuid-1');
      expect(result.certificate_name).toBe('ISO 27001');
      expect(result.product_id).toBe('CERT-001');
      expect(ticketRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-uuid-1',
          subject: 'Certificate renewal issue',
          category: 'renewal',
          certificate_id: 'cert-uuid-1',
          description: 'I need help with my certificate renewal process.',
          supporting_document: 'https://example.com/doc.pdf',
          ticket_type: 'support',
          target_type: 'certificate',
          target_id: 'cert-uuid-1',
        }),
      );
    });

    it('should throw NotFoundException when certificate does not exist', async () => {
      certificateRepo.findCertificateById.mockResolvedValue(null);

      await expect(
        service.create('user-uuid-1', {
          subject: 'Test',
          category: 'general',
          certificate_id: 'non-existent',
          description: 'This is a test description for the ticket.',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should notify admins when ticket is created', async () => {
      certificateRepo.findCertificateById.mockResolvedValue(
        mockCertificate as any,
      );
      ticketRepo.create.mockResolvedValue(mockTicket);

      await service.create('user-uuid-1', {
        subject: 'Certificate renewal issue',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        description: 'I need help with my certificate renewal process.',
      });

      expect(notificationService.notifyUsers).toHaveBeenCalledWith(
        ['admin-uuid-1', 'admin-uuid-2'],
        expect.objectContaining({
          type: 'action_required',
          title: 'New Support Ticket',
          module: 'support',
          metadata: expect.objectContaining({
            support_ticket_id: 'ticket-uuid-1',
            ticket_type: 'support',
            category: 'renewal',
            subject: 'Certificate renewal issue',
          }),
        }),
      );
    });

    it('should still create ticket if notification fails', async () => {
      certificateRepo.findCertificateById.mockResolvedValue(
        mockCertificate as any,
      );
      ticketRepo.create.mockResolvedValue(mockTicket);
      notificationService.notifyUsers.mockRejectedValue(
        new Error('Notification failed'),
      );

      const result = await service.create('user-uuid-1', {
        subject: 'Certificate renewal issue',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        description: 'I need help with my certificate renewal process.',
      });

      expect(result.id).toBe('ticket-uuid-1');
    });

    it('should create a ticket without supporting_document', async () => {
      certificateRepo.findCertificateById.mockResolvedValue(
        mockCertificate as any,
      );
      const ticketWithoutDoc = { ...mockTicket, supporting_document: null };
      ticketRepo.create.mockResolvedValue(ticketWithoutDoc);

      const result = await service.create('user-uuid-1', {
        subject: 'Certificate renewal issue',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        description: 'I need help with my certificate renewal process.',
      });

      expect(result.supporting_document).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a ticket with certificate data', async () => {
      ticketRepo.findById.mockResolvedValue(mockTicketWithCert);

      const result = await service.findById('ticket-uuid-1');

      expect(result.id).toBe('ticket-uuid-1');
      expect(result.certificate_name).toBe('ISO 27001');
      expect(result.product_id).toBe('CERT-001');
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      ticketRepo.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated tickets', async () => {
      ticketRepo.findAll.mockResolvedValue({
        data: [mockTicketWithCert],
        total: 1,
      });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should pass filters to repository', async () => {
      ticketRepo.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.findAll({
        page: 1,
        limit: 10,
        status: 'pending',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        user_id: 'user-uuid-1',
      });

      expect(ticketRepo.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: 'pending',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        user_id: 'user-uuid-1',
      });
    });
  });

  describe('updateStatus', () => {
    it('should update ticket status successfully', async () => {
      ticketRepo.findById.mockResolvedValue(mockTicketWithCert);
      const updatedTicket = {
        ...mockTicketWithCert,
        status: 'in_progress' as const,
      };
      ticketRepo.updateStatus.mockResolvedValue(updatedTicket);

      const result = await service.updateStatus(
        'ticket-uuid-1',
        'in_progress',
        'admin-uuid-1',
      );

      expect(result.status).toBe('in_progress');
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      ticketRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent', 'in_progress', 'admin-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is the same', async () => {
      ticketRepo.findById.mockResolvedValue(mockTicketWithCert);

      await expect(
        service.updateStatus('ticket-uuid-1', 'pending', 'admin-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should notify the ticket creator when status changes', async () => {
      ticketRepo.findById.mockResolvedValue(mockTicketWithCert);
      const updatedTicket = {
        ...mockTicketWithCert,
        status: 'in_progress' as const,
      };
      ticketRepo.updateStatus.mockResolvedValue(updatedTicket);

      await service.updateStatus(
        'ticket-uuid-1',
        'in_progress',
        'admin-uuid-1',
      );

      expect(notificationService.notifyUser).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          type: 'info',
          title: 'Support Ticket Updated',
          module: 'support',
          metadata: expect.objectContaining({
            support_ticket_id: 'ticket-uuid-1',
            new_status: 'in_progress',
          }),
        }),
      );
    });

    it('should still update status if notification fails', async () => {
      ticketRepo.findById.mockResolvedValue(mockTicketWithCert);
      const updatedTicket = {
        ...mockTicketWithCert,
        status: 'in_progress' as const,
      };
      ticketRepo.updateStatus.mockResolvedValue(updatedTicket);
      notificationService.notifyUser.mockRejectedValue(
        new Error('Notification failed'),
      );

      const result = await service.updateStatus(
        'ticket-uuid-1',
        'in_progress',
        'admin-uuid-1',
      );

      expect(result.status).toBe('in_progress');
    });

    it('should notify user and lock chat when status is terminal', async () => {
      ticketRepo.findById.mockResolvedValue(mockTicketWithCert);
      const resolvedTicket = {
        ...mockTicketWithCert,
        status: 'completed' as const,
      };
      ticketRepo.updateStatus.mockResolvedValue(resolvedTicket);

      await service.updateStatus(
        'ticket-uuid-1',
        'completed',
        'admin-uuid-1',
      );

      expect(notificationService.notifyUser).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          title: 'Support Ticket Updated',
          metadata: expect.objectContaining({
            new_status: 'completed',
          }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete a ticket successfully', async () => {
      ticketRepo.findById.mockResolvedValue(mockTicketWithCert);
      ticketRepo.delete.mockResolvedValue(true);

      await expect(service.delete('ticket-uuid-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      ticketRepo.findById.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
