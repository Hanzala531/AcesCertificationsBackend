import { AuditLogService } from '../audit-log.service';
import { AuditLogRepository } from '../audit-log.repository';
import type { CreateAuditLogInput } from '../interfaces/audit-log.interface';

// Freeze timers for all tests
jest.useFakeTimers();

const makeEntry = (
  overrides: Partial<CreateAuditLogInput> = {},
): CreateAuditLogInput => ({
  action: 'auth.login',
  category: 'AUTH',
  actor_id: 'user-uuid',
  actor_role: 'admin',
  ...overrides,
});

function makeRepo(): jest.Mocked<AuditLogRepository> {
  return {
    bulkInsert: jest.fn().mockResolvedValue(undefined),
    findPaginated: jest.fn(),
    findForExport: jest.fn(),
    deleteOlderThan: jest.fn(),
  } as unknown as jest.Mocked<AuditLogRepository>;
}

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: jest.Mocked<AuditLogRepository>;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuditLogService(repo);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── log() ────────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('enqueues an entry without throwing', () => {
      expect(() => service.log(makeEntry())).not.toThrow();
    });

    it('does not call bulkInsert immediately for a single entry', () => {
      service.log(makeEntry());
      expect(repo.bulkInsert).not.toHaveBeenCalled();
    });

    it('calls flush when queue reaches batch size', async () => {
      const batchSize = parseInt(process.env.AUDIT_LOG_BATCH_SIZE ?? '50', 10);
      for (let i = 0; i < batchSize; i++) {
        service.log(makeEntry({ action: `action.${i}` }));
      }
      // Allow microtasks (the void flush() promise) to settle
      await Promise.resolve();
      expect(repo.bulkInsert).toHaveBeenCalledTimes(1);
    });

    it('drops oldest entry when queue overflows maxQueueSize', () => {
      process.env.AUDIT_LOG_MAX_QUEUE_SIZE = '3';

      const smallRepo = makeRepo();
      const smallService = new AuditLogService(smallRepo);
      smallService.onModuleInit();

      smallService.log(makeEntry({ action: 'first' }));
      smallService.log(makeEntry({ action: 'second' }));
      smallService.log(makeEntry({ action: 'third' }));
      // This should drop 'first'
      smallService.log(makeEntry({ action: 'fourth' }));

      const queue = (
        smallService as unknown as { queue: CreateAuditLogInput[] }
      ).queue;
      expect(queue.length).toBe(3);
      expect(queue[0].action).toBe('second');
      expect(queue[2].action).toBe('fourth');

      void smallService.onModuleDestroy();
      delete process.env.AUDIT_LOG_MAX_QUEUE_SIZE;
    });
  });

  // ─── flush() ──────────────────────────────────────────────────────────────

  describe('flush()', () => {
    it('does nothing when queue is empty', async () => {
      await service.flush();
      expect(repo.bulkInsert).not.toHaveBeenCalled();
    });

    it('inserts queued entries and clears the queue', async () => {
      service.log(makeEntry({ action: 'a' }));
      service.log(makeEntry({ action: 'b' }));

      await service.flush(true);

      expect(repo.bulkInsert).toHaveBeenCalledTimes(1);
      const inserted = repo.bulkInsert.mock.calls[0][0];
      expect(inserted).toHaveLength(2);
      expect(inserted[0].action).toBe('a');
      expect(inserted[1].action).toBe('b');

      const queue = (service as unknown as { queue: CreateAuditLogInput[] })
        .queue;
      expect(queue).toHaveLength(0);
    });

    it('does not run concurrent flushes (flush lock)', async () => {
      // Make bulkInsert resolve synchronously so no timers are needed
      repo.bulkInsert.mockResolvedValue(undefined);

      service.log(makeEntry());

      const p1 = service.flush(true);
      // p2 should hit the lock immediately and return without calling bulkInsert again
      const p2 = service.flush(true);
      await Promise.all([p1, p2]);

      expect(repo.bulkInsert).toHaveBeenCalledTimes(1);
    });

    it('re-enqueues batch to front on bulkInsert failure', async () => {
      repo.bulkInsert.mockRejectedValueOnce(new Error('DB error'));

      service.log(makeEntry({ action: 'retry-me' }));
      await service.flush(true);

      const queue = (service as unknown as { queue: CreateAuditLogInput[] })
        .queue;
      expect(queue[0].action).toBe('retry-me');
    });

    it('flushes on interval timer', async () => {
      service.log(makeEntry());

      // Advance past maxWaitMs (10000ms default) so flush() guard allows it
      jest.advanceTimersByTime(
        parseInt(process.env.AUDIT_LOG_MAX_WAIT_MS ?? '10000', 10) + 100,
      );
      await Promise.resolve();

      expect(repo.bulkInsert).toHaveBeenCalled();
    });
  });

  // ─── onModuleDestroy() ────────────────────────────────────────────────────

  describe('onModuleDestroy()', () => {
    it('flushes remaining entries on shutdown', async () => {
      service.log(makeEntry({ action: 'shutdown-entry' }));
      await service.onModuleDestroy();

      expect(repo.bulkInsert).toHaveBeenCalledTimes(1);
      expect(repo.bulkInsert.mock.calls[0][0][0].action).toBe('shutdown-entry');
    });

    it('clears the flush timer on shutdown', async () => {
      await service.onModuleDestroy();
      const timer = (service as unknown as { flushTimer: unknown }).flushTimer;
      expect(timer).toBeNull();
    });
  });

  // ─── gdprCleanup() ────────────────────────────────────────────────────────

  describe('gdprCleanup()', () => {
    it('deletes entries older than retention period and logs count', async () => {
      repo.deleteOlderThan.mockResolvedValue(42);
      const logSpy = jest.spyOn(
        (service as unknown as { logger: { log: jest.Mock } }).logger,
        'log',
      );

      await service.gdprCleanup();

      expect(repo.deleteOlderThan).toHaveBeenCalledTimes(1);
      const cutoffArg: Date = repo.deleteOlderThan.mock.calls[0][0];
      const retentionDays = parseInt(
        process.env.AUDIT_LOG_GDPR_RETENTION_DAYS ?? '365',
        10,
      );
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - retentionDays);

      expect(
        Math.abs(cutoffArg.getTime() - expectedCutoff.getTime()),
      ).toBeLessThan(5000);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('42'));
    });

    it('does not throw when deleteOlderThan fails', async () => {
      repo.deleteOlderThan.mockRejectedValueOnce(new Error('DB down'));
      await expect(service.gdprCleanup()).resolves.not.toThrow();
    });
  });
});
