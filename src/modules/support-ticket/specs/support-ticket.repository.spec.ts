import { Test, TestingModule } from '@nestjs/testing';
import { SupportTicketRepository } from '../support-ticket.repository';
import { DatabaseService } from '../../../database/database.service';

describe('SupportTicketRepository', () => {
  let repository: SupportTicketRepository;
  let db: any;

  const mockTicketRow = {
    id: 'ticket-uuid-1',
    user_id: 'user-uuid-1',
    subject: 'Certificate renewal issue',
    category: 'renewal',
    certificate_id: 'cert-uuid-1',
    description: 'I need help with my certificate renewal process.',
    supporting_document: 'https://example.com/doc.pdf',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTicketWithCertRow = {
    ...mockTicketRow,
    certificate_name: 'ISO 27001',
    product_id: 'CERT-001',
  };

  beforeEach(async () => {
    const mockDb = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketRepository,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    repository = module.get<SupportTicketRepository>(SupportTicketRepository);
    db = module.get(DatabaseService);
  });

  describe('create', () => {
    it('should insert a support ticket and return it', async () => {
      db.query.mockResolvedValue({ rows: [mockTicketRow], rowCount: 1 });

      const result = await repository.create({
        user_id: 'user-uuid-1',
        subject: 'Certificate renewal issue',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
        description: 'I need help with my certificate renewal process.',
        supporting_document: 'https://example.com/doc.pdf',
      });

      expect(result.id).toBe('ticket-uuid-1');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO support_tickets'),
        expect.any(Array),
      );
    });
  });

  describe('findById', () => {
    it('should return ticket with certificate join data', async () => {
      db.query.mockResolvedValue({
        rows: [mockTicketWithCertRow],
        rowCount: 1,
      });

      const result = await repository.findById('ticket-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.certificate_name).toBe('ISO 27001');
      expect(result!.product_id).toBe('CERT-001');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN certificates'),
        ['ticket-uuid-1'],
      );
    });

    it('should return null when ticket not found', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated results with total count', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockTicketWithCertRow], rowCount: 1 });

      const result = await repository.findAll({ page: 1, limit: 10 });

      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(1);
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should apply status filter', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockTicketWithCertRow], rowCount: 1 });

      await repository.findAll({ page: 1, limit: 10, status: 'pending' });

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('st.status = $1');
      expect(countCall[1]).toContain('pending');
    });

    it('should apply category filter', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockTicketWithCertRow], rowCount: 1 });

      await repository.findAll({ page: 1, limit: 10, category: 'renewal' });

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('st.category = $1');
      expect(countCall[1]).toContain('renewal');
    });

    it('should apply certificate_id filter', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockTicketWithCertRow], rowCount: 1 });

      await repository.findAll({
        page: 1,
        limit: 10,
        certificate_id: 'cert-uuid-1',
      });

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('st.certificate_id = $1');
    });

    it('should apply multiple filters together', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockTicketWithCertRow], rowCount: 1 });

      await repository.findAll({
        page: 1,
        limit: 10,
        status: 'pending',
        category: 'renewal',
        certificate_id: 'cert-uuid-1',
      });

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('st.status = $1');
      expect(countCall[0]).toContain('st.category = $2');
      expect(countCall[0]).toContain('st.certificate_id = $3');
    });
  });

  describe('updateStatus', () => {
    it('should update status and return updated ticket', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ ...mockTicketWithCertRow, status: 'in_progress' }],
          rowCount: 1,
        });

      const result = await repository.updateStatus(
        'ticket-uuid-1',
        'in_progress',
      );

      expect(result).not.toBeNull();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE support_tickets SET status'),
        ['in_progress', 'ticket-uuid-1'],
      );
    });
  });

  describe('delete', () => {
    it('should delete a ticket and return true', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await repository.delete('ticket-uuid-1');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM support_tickets'),
        ['ticket-uuid-1'],
      );
    });

    it('should return false when ticket not found', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });
});
