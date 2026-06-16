import { Test, TestingModule } from '@nestjs/testing';
import { AuditAdminController } from '../controllers/audit-admin.controller';
import { AuditLogRepository } from '../audit-log.repository';
import {
  AuditLogQueryDto,
  AuditLogExportDto,
} from '../dto/audit-log-query.dto';
import type { AuditLog } from '../interfaces/audit-log.interface';
import type { Response } from 'express';

const makeAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: 'log-uuid-1',
  action: 'auth.login',
  category: 'AUTH',
  actor_id: 'user-uuid',
  actor_role: 'admin',
  target_entity: null,
  target_id: null,
  http_method: 'POST',
  http_path: '/api/auth/login',
  http_status_code: 200,
  request_id: 'req-uuid',
  ip_address: '127.0.0.1',
  user_agent: 'jest/1.0',
  metadata: null,
  error_message: null,
  duration_ms: 25,
  created_at: new Date('2024-06-01T00:00:00Z'),
  ...overrides,
});

describe('AuditAdminController', () => {
  let controller: AuditAdminController;
  let repo: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    const mockRepo: jest.Mocked<AuditLogRepository> = {
      bulkInsert: jest.fn(),
      findPaginated: jest.fn(),
      findForExport: jest.fn(),
      deleteOlderThan: jest.fn(),
    } as unknown as jest.Mocked<AuditLogRepository>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditAdminController],
      providers: [{ provide: AuditLogRepository, useValue: mockRepo }],
    })
      // Skip guards in unit tests
      .overrideGuard(require('@nestjs/passport').AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../../auth/role.guard').RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditAdminController>(AuditAdminController);
    repo = module.get(AuditLogRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns items and meta with correct total and page', async () => {
      const logs = [makeAuditLog(), makeAuditLog({ id: 'log-uuid-2' })];
      repo.findPaginated.mockResolvedValue({ items: logs, total: 2 });

      const query: AuditLogQueryDto = { page: 1, limit: 20 };
      const result = await controller.findAll(query);

      expect(result.items).toEqual(logs);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('calculates totalPages correctly', async () => {
      repo.findPaginated.mockResolvedValue({ items: [], total: 55 });

      const result = await controller.findAll({ page: 1, limit: 20 });
      expect(result.meta.totalPages).toBe(3); // ceil(55/20)
    });

    it('caps limit at 100', async () => {
      repo.findPaginated.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll({ page: 1, limit: 999 });

      const [, , actualLimit] = repo.findPaginated.mock.calls[0];
      expect(actualLimit).toBe(100);
    });

    it('defaults to page=1 and limit=20 when not provided', async () => {
      repo.findPaginated.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll({});

      const [, page, limit] = repo.findPaginated.mock.calls[0];
      expect(page).toBe(1);
      expect(limit).toBe(20);
    });

    it('passes date filters as Date objects', async () => {
      repo.findPaginated.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll({
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T00:00:00Z',
        page: 1,
        limit: 10,
      });

      const [filters] = repo.findPaginated.mock.calls[0];
      expect(filters.from).toBeInstanceOf(Date);
      expect(filters.to).toBeInstanceOf(Date);
    });

    it('passes actor_id, action, category filters', async () => {
      repo.findPaginated.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll({
        actor_id: 'user-1',
        action: 'auth.login',
        category: 'AUTH',
      });

      const [filters] = repo.findPaginated.mock.calls[0];
      expect(filters.actor_id).toBe('user-1');
      expect(filters.action).toBe('auth.login');
      expect(filters.category).toBe('AUTH');
    });

    it('leaves date filters undefined when not provided', async () => {
      repo.findPaginated.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll({ page: 1, limit: 10 });

      const [filters] = repo.findPaginated.mock.calls[0];
      expect(filters.from).toBeUndefined();
      expect(filters.to).toBeUndefined();
    });
  });

  // ─── export ────────────────────────────────────────────────────────────────

  describe('export()', () => {
    function makeRes(): jest.Mocked<Response> {
      return {
        setHeader: jest.fn(),
        json: jest.fn(),
      } as unknown as jest.Mocked<Response>;
    }

    it('calls findForExport and sends JSON response', async () => {
      const logs = [makeAuditLog()];
      repo.findForExport.mockResolvedValue(logs);

      const res = makeRes();
      await controller.export({}, res);

      expect(repo.findForExport).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('audit-logs-'),
      );
      expect(res.json).toHaveBeenCalledWith(logs);
    });

    it('sets Content-Disposition with attachment filename', async () => {
      repo.findForExport.mockResolvedValue([]);
      const res = makeRes();

      await controller.export({ from: '2024-01-01', to: '2024-01-31' }, res);

      const dispositionCall = (res.setHeader as jest.Mock).mock.calls.find(
        (c) => c[0] === 'Content-Disposition',
      );
      expect(dispositionCall?.[1]).toContain('attachment');
      expect(dispositionCall?.[1]).toContain('2024-01-01');
    });

    it('passes hard limit of 10,000 rows to findForExport', async () => {
      repo.findForExport.mockResolvedValue([]);
      const res = makeRes();

      await controller.export({}, res);

      const [, , limit] = repo.findForExport.mock.calls[0];
      expect(limit).toBe(10_000);
    });

    it('caps from date to MAX_EXPORT_DAYS before to date', async () => {
      repo.findForExport.mockResolvedValue([]);
      const res = makeRes();

      const maxExportDays = parseInt(
        process.env.AUDIT_LOG_MAX_EXPORT_DAYS ?? '90',
        10,
      );

      const to = new Date('2024-12-31');
      // Request a date far in the past (beyond MAX_EXPORT_DAYS)
      const tooFarBack = new Date('2020-01-01');

      await controller.export(
        { from: tooFarBack.toISOString(), to: to.toISOString() },
        res,
      );

      const [from] = repo.findForExport.mock.calls[0];
      const expectedEarliest = new Date(
        to.getTime() - maxExportDays * 24 * 60 * 60 * 1000,
      );

      // The actual from should not be earlier than the cap
      expect(from.getTime()).toBeGreaterThanOrEqual(
        expectedEarliest.getTime() - 1000,
      );
    });

    it('defaults to (now - MAX_EXPORT_DAYS) when from is not provided', async () => {
      repo.findForExport.mockResolvedValue([]);
      const res = makeRes();

      const before = Date.now();
      await controller.export({}, res);
      const after = Date.now();

      const [from] = repo.findForExport.mock.calls[0];
      const maxExportDays = parseInt(
        process.env.AUDIT_LOG_MAX_EXPORT_DAYS ?? '90',
        10,
      );

      const expectedMin = before - maxExportDays * 24 * 60 * 60 * 1000 - 5000;
      const expectedMax = after - maxExportDays * 24 * 60 * 60 * 1000 + 5000;

      expect(from.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(from.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });
});
