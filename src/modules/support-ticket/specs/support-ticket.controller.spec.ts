import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { SupportTicketController } from '../support-ticket.controller';
import { SupportTicketService } from '../support-ticket.service';

describe('SupportTicketController', () => {
  let controller: SupportTicketController;
  let service: jest.Mocked<SupportTicketService>;

  const mockTicketWithCert = {
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
    certificate_name: 'ISO 27001',
    product_id: 'CERT-001',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockReq = {
    user: { sub: 'user-uuid-1', role: 'organization' },
  } as any;

  const mockAdminReq = {
    user: { sub: 'admin-uuid-1', role: 'admin' },
  } as any;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportTicketController],
      providers: [{ provide: SupportTicketService, useValue: mockService }],
    }).compile();

    controller = module.get<SupportTicketController>(SupportTicketController);
    service = module.get(SupportTicketService);
  });

  describe('create', () => {
    it('should create a ticket and return envelope response', async () => {
      service.create.mockResolvedValue(mockTicketWithCert);

      const result = await controller.create(mockReq, {
        subject: 'Certificate renewal issue',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        description: 'I need help with my certificate renewal process.',
        supporting_document: 'https://example.com/doc.pdf',
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(HttpStatus.CREATED);
      expect(result.data.certificate_name).toBe('ISO 27001');
      expect(result.data.product_id).toBe('CERT-001');
      expect(service.create).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.any(Object),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated tickets for regular user (scoped to own)', async () => {
      service.findAll.mockResolvedValue({
        data: [mockTicketWithCert],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.findAll(mockReq, 1, 10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-uuid-1' }),
      );
    });

    it('should return all tickets for admin (no user_id filter)', async () => {
      service.findAll.mockResolvedValue({
        data: [mockTicketWithCert],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.findAll(mockAdminReq, 1, 10);

      expect(result.success).toBe(true);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: undefined }),
      );
    });

    it('should pass filters through', async () => {
      service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await controller.findAll(
        mockReq,
        1,
        10,
        'pending',
        'renewal',
        'cert-uuid-1',
      );

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          category: 'renewal',
          certificate_id: 'cert-uuid-1',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a ticket by id', async () => {
      service.findById.mockResolvedValue(mockTicketWithCert);

      const result = await controller.findOne('ticket-uuid-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('ticket-uuid-1');
      expect(result.data.certificate_name).toBe('ISO 27001');
    });
  });

  describe('updateStatus', () => {
    it('should update ticket status', async () => {
      const updatedTicket = {
        ...mockTicketWithCert,
        status: 'in_progress' as const,
      };
      service.updateStatus.mockResolvedValue(updatedTicket);

      const result = await controller.updateStatus(
        'ticket-uuid-1',
        {
          status: 'in_progress',
        } as any,
        mockAdminReq,
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('in_progress');
    });
  });

  describe('delete', () => {
    it('should delete a ticket', async () => {
      service.delete.mockResolvedValue(undefined);

      const result = await controller.delete('ticket-uuid-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Support ticket deleted successfully');
    });
  });
});
