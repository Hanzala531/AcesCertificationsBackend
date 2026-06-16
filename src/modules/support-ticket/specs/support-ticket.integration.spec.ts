import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupportTicketController } from '../support-ticket.controller';
import { SupportTicketService } from '../support-ticket.service';
import { SupportTicketRepository } from '../support-ticket.repository';
import { CertificateRepository } from '../../certificate/certificate.repository';
import { ChatService } from '../../chat/chat.service';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationRepository } from '../../notification/notification.repository';
import { DatabaseService } from '../../../database/database.service';

/**
 * Integration tests: wires Controller → Service → Repository with a mocked DatabaseService
 * to verify the full request flow through the real DI graph.
 */
describe('SupportTicket Integration', () => {
  let controller: SupportTicketController;
  let db: any;

  const now = new Date();

  const mockCertificateRow = {
    id: 'cert-uuid-1',
    certificate_id: 'CERT-001',
    name: 'ISO 27001',
    disclosure_price: 100,
    is_published: true,
    created_at: now,
    updated_at: now,
  };

  const mockTicketRow = {
    id: 'ticket-uuid-1',
    user_id: 'user-uuid-1',
    subject: 'Certificate renewal issue',
    category: 'renewal',
    certificate_id: 'cert-uuid-1',
    description: 'I need help with my certificate renewal process.',
    supporting_document: 'https://example.com/doc.pdf',
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  const mockTicketWithCertRow = {
    ...mockTicketRow,
    certificate_name: 'ISO 27001',
    product_id: 'CERT-001',
  };

  const mockReq = { user: { sub: 'user-uuid-1', role: 'organization' } } as any;
  const mockAdminReq = { user: { sub: 'admin-uuid-1', role: 'admin' } } as any;

  beforeEach(async () => {
    const mockDb = { query: jest.fn() };

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
      getUserIdsByRoles: jest.fn().mockResolvedValue(['admin-uuid-1']),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportTicketController],
      providers: [
        SupportTicketService,
        SupportTicketRepository,
        CertificateRepository,
        { provide: ChatService, useValue: mockChatService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: NotificationRepository, useValue: mockNotificationRepo },
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    controller = module.get<SupportTicketController>(SupportTicketController);
    db = module.get(DatabaseService);
  });

  describe('Full create → fetch flow', () => {
    it('should create a ticket, then fetch it with certificate_name and product_id', async () => {
      // 1. findCertificateById called by service.create
      db.query
        .mockResolvedValueOnce({
          rows: [mockCertificateRow],
          rowCount: 1,
        } as any)
        // 2. INSERT support_tickets
        .mockResolvedValueOnce({ rows: [mockTicketRow], rowCount: 1 } as any);

      const createResult = await controller.create(mockReq, {
        subject: 'Certificate renewal issue',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        description: 'I need help with my certificate renewal process.',
        supporting_document: 'https://example.com/doc.pdf',
      });

      expect(createResult.success).toBe(true);
      expect(createResult.statusCode).toBe(HttpStatus.CREATED);
      expect(createResult.data.certificate_name).toBe('ISO 27001');
      expect(createResult.data.product_id).toBe('CERT-001');

      // 3. Now fetch the ticket by ID
      db.query.mockResolvedValueOnce({
        rows: [mockTicketWithCertRow],
        rowCount: 1,
      } as any);

      const getResult = await controller.findOne('ticket-uuid-1');

      expect(getResult.success).toBe(true);
      expect(getResult.data.certificate_name).toBe('ISO 27001');
      expect(getResult.data.product_id).toBe('CERT-001');
    });
  });

  describe('Full create → update status flow', () => {
    it('should create a ticket then update status from pending to in-progress', async () => {
      // create
      db.query
        .mockResolvedValueOnce({
          rows: [mockCertificateRow],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [mockTicketRow], rowCount: 1 } as any);

      await controller.create(mockReq, {
        subject: 'Certificate renewal issue',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        description: 'I need help with my certificate renewal process.',
      });

      // updateStatus: findById (check existence), then UPDATE, then findById (return)
      db.query
        .mockResolvedValueOnce({
          rows: [mockTicketWithCertRow],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
        .mockResolvedValueOnce({
          rows: [{ ...mockTicketWithCertRow, status: 'in_progress' }],
          rowCount: 1,
        } as any);

      const updateResult = await controller.updateStatus(
        'ticket-uuid-1',
        {
          status: 'in_progress',
        },
        mockAdminReq,
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.status).toBe('in_progress');
    });
  });

  describe('Filtering tickets', () => {
    it('should filter by status and return paginated results', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({
          rows: [mockTicketWithCertRow],
          rowCount: 1,
        } as any);

      const result = await controller.findAll(
        mockAdminReq,
        1,
        10,
        'pending',
        undefined,
        undefined,
      );

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);

      // Verify the count query includes the status filter
      const countQuery = db.query.mock.calls[0][0];
      expect(countQuery).toContain('st.status = $1');
    });

    it('non-admin users should only see their own tickets', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 } as any)
        .mockResolvedValueOnce({
          rows: [mockTicketWithCertRow],
          rowCount: 1,
        } as any);

      await controller.findAll(mockReq, 1, 10);

      // The user_id filter should be applied
      const countQuery = db.query.mock.calls[0][0];
      expect(countQuery).toContain('st.user_id = $1');
    });
  });

  describe('Validation failures', () => {
    it('should throw NotFoundException when creating ticket with non-existent certificate', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await expect(
        controller.create(mockReq, {
          subject: 'Test ticket',
          category: 'general',
          certificate_id: 'non-existent-uuid',
          description: 'This is a test ticket description.',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when fetching non-existent ticket', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await expect(controller.findOne('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when updating status of non-existent ticket', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      await expect(
        controller.updateStatus(
          'non-existent-uuid',
          { status: 'completed' },
          mockAdminReq,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updating to same status', async () => {
      db.query.mockResolvedValueOnce({
        rows: [mockTicketWithCertRow],
        rowCount: 1,
      });

      await expect(
        controller.updateStatus(
          'ticket-uuid-1',
          { status: 'pending' },
          mockAdminReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Delete flow', () => {
    it('should delete an existing ticket', async () => {
      // findById check
      db.query
        .mockResolvedValueOnce({ rows: [mockTicketWithCertRow], rowCount: 1 })
        // actual delete
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await controller.delete('ticket-uuid-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Support ticket deleted successfully');
    });

    it('should throw NotFoundException when deleting non-existent ticket', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(controller.delete('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
