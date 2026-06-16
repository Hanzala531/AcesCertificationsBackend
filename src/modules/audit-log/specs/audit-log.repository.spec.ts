import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogRepository } from '../audit-log.repository';
import { DatabaseService } from '../../../database/database.service';
import type { CreateAuditLogInput } from '../interfaces/audit-log.interface';

const makeEntry = (
  overrides: Partial<CreateAuditLogInput> = {},
): CreateAuditLogInput => ({
  action: 'auth.login',
  category: 'AUTH',
  actor_id: 'actor-uuid',
  actor_role: 'admin',
  http_method: 'POST',
  http_path: '/api/auth/login',
  http_status_code: 200,
  request_id: 'req-uuid',
  ip_address: '127.0.0.1',
  user_agent: 'jest-test',
  metadata: null,
  error_message: null,
  duration_ms: 42,
  ...overrides,
});

describe('AuditLogRepository', () => {
  let repo: AuditLogRepository;
  let db: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const mockDb = {
      query: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogRepository,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    repo = module.get<AuditLogRepository>(AuditLogRepository);
    db = module.get(DatabaseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  // ─── bulkInsert ────────────────────────────────────────────────────────────

  describe('bulkInsert()', () => {
    it('does nothing when entries array is empty', async () => {
      await repo.bulkInsert([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('calls db.query with correct INSERT SQL for one entry', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await repo.bulkInsert([makeEntry()]);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO audit_logs');
      expect(sql).toContain('VALUES');
      expect(params).toHaveLength(15); // 15 columns × 1 row
    });

    it('builds correct parameter count for multiple entries', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 3 } as never);

      await repo.bulkInsert([makeEntry(), makeEntry(), makeEntry()]);

      const [, params] = db.query.mock.calls[0];
      expect((params as unknown[]).length).toBe(45); // 15 × 3
    });

    it('uses null for undefined optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await repo.bulkInsert([
        { action: 'resource.create', category: 'RESOURCE' },
      ]);

      const [, params] = db.query.mock.calls[0];
      // actor_id, actor_role, target_entity etc. should all be null
      expect((params as unknown[])[2]).toBeNull(); // actor_id
      expect((params as unknown[])[3]).toBeNull(); // actor_role
    });

    it('JSON-stringifies metadata', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await repo.bulkInsert([makeEntry({ metadata: { key: 'value' } })]);

      const [, params] = db.query.mock.calls[0];
      expect((params as unknown[])[12]).toBe('{"key":"value"}');
    });
  });

  // ─── findPaginated ─────────────────────────────────────────────────────────

  describe('findPaginated()', () => {
    const mockRows = [
      { id: 'log-1', action: 'auth.login', created_at: new Date() },
    ];

    beforeEach(() => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never) // COUNT
        .mockResolvedValueOnce({ rows: mockRows, rowCount: 1 } as never); // SELECT
    });

    it('returns items and total', async () => {
      const result = await repo.findPaginated({}, 1, 20);
      expect(result.total).toBe(1);
      expect(result.items).toEqual(mockRows);
    });

    it('applies no WHERE clause when no filters provided', async () => {
      await repo.findPaginated({}, 1, 20);
      const [countSql] = db.query.mock.calls[0];
      expect(countSql).not.toContain('WHERE');
    });

    it('applies actor_id filter correctly', async () => {
      db.query.mockReset();
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await repo.findPaginated({ actor_id: 'user-123' }, 1, 10);

      const [countSql, countParams] = db.query.mock.calls[0];
      expect(countSql).toContain('WHERE');
      expect(countSql).toContain('actor_id =');
      expect(countParams).toContain('user-123');
    });

    it('applies date range filters correctly', async () => {
      db.query.mockReset();
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      await repo.findPaginated({ from, to }, 1, 10);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('created_at >=');
      expect(sql).toContain('created_at <=');
      expect(params).toContain(from);
      expect(params).toContain(to);
    });

    it('applies correct OFFSET for page 2', async () => {
      await repo.findPaginated({}, 2, 10);

      const [dataSql, dataParams] = db.query.mock.calls[1];
      expect(dataSql).toContain('OFFSET');
      // offset should be (page-1)*limit = 10
      expect(dataParams).toContain(10);
    });

    it('applies action and category filters', async () => {
      db.query.mockReset();
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await repo.findPaginated(
        { action: 'auth.login', category: 'AUTH' },
        1,
        10,
      );

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('action =');
      expect(sql).toContain('category =');
      expect(params).toContain('auth.login');
      expect(params).toContain('AUTH');
    });
  });

  // ─── findForExport ─────────────────────────────────────────────────────────

  describe('findForExport()', () => {
    it('returns rows from db query', async () => {
      const rows = [{ id: 'log-export-1' }];
      db.query.mockResolvedValueOnce({ rows, rowCount: 1 } as never);

      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      const result = await repo.findForExport(from, to, 1000);

      expect(result).toEqual(rows);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('LIMIT');
      expect(params).toContain(from);
      expect(params).toContain(to);
      expect(params).toContain(1000);
    });
  });

  // ─── deleteOlderThan ───────────────────────────────────────────────────────

  describe('deleteOlderThan()', () => {
    it('returns the number of deleted rows', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 17 } as never);

      const cutoff = new Date('2023-01-01');
      const count = await repo.deleteOlderThan(cutoff);

      expect(count).toBe(17);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM audit_logs WHERE created_at <');
      expect(params).toContain(cutoff);
    });

    it('returns 0 when rowCount is null', async () => {
      db.query.mockResolvedValueOnce({ rows: [], rowCount: null } as never);

      const count = await repo.deleteOlderThan(new Date());
      expect(count).toBe(0);
    });
  });
});
