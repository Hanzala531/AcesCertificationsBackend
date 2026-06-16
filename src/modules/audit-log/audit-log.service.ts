import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditLogRepository } from './audit-log.repository';
import type { CreateAuditLogInput } from './interfaces/audit-log.interface';

@Injectable()
export class AuditLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditLogService.name);

  private readonly queue: CreateAuditLogInput[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;

  private isFlushing = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private firstEnqueuedAt: number | null = null;
  private readonly maxWaitMs: number;

  constructor(private readonly repo: AuditLogRepository) {
    this.batchSize = parseInt(process.env.AUDIT_LOG_BATCH_SIZE ?? '50', 10);
    this.flushIntervalMs = parseInt(
      process.env.AUDIT_LOG_FLUSH_INTERVAL_MS ?? '2000',
      10,
    );
    this.maxQueueSize = parseInt(
      process.env.AUDIT_LOG_MAX_QUEUE_SIZE ?? '10000',
      10,
    );
    this.maxWaitMs = parseInt(process.env.AUDIT_LOG_MAX_WAIT_MS ?? '10000', 10);
  }

  onModuleInit(): void {
    this.flushTimer = setInterval(
      () => void this.flush(),
      this.flushIntervalMs,
    );
  }


  log(entry: CreateAuditLogInput): void {
    try {
      if (this.queue.length >= this.maxQueueSize) {
        this.queue.shift();
      }
      if (this.queue.length === 0) {
        this.firstEnqueuedAt = Date.now();
      }
      this.queue.push(entry);

      if (this.queue.length >= this.batchSize) {
        void this.flush();
      }
    } catch {
    }
  }

  async flush(force = false): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;

    const batchReady = this.queue.length >= this.batchSize;
    const maxWaitExceeded =
      this.firstEnqueuedAt !== null &&
      Date.now() - this.firstEnqueuedAt >= this.maxWaitMs;

    if (!force && !batchReady && !maxWaitExceeded) return;

    this.isFlushing = true;
    this.firstEnqueuedAt = null;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.repo.bulkInsert(batch);
    } catch (err) {
      this.logger.error('Failed to flush audit log batch', err);
      this.queue.unshift(...batch);
    } finally {
      this.isFlushing = false;
    }
  }

  @Cron('0 3 * * *', { name: 'audit-log-gdpr-cleanup' })
  async gdprCleanup(): Promise<void> {
    const retentionDays = parseInt(
      process.env.AUDIT_LOG_GDPR_RETENTION_DAYS ?? '365',
      10,
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    try {
      const deleted = await this.repo.deleteOlderThan(cutoff);
      this.logger.log(
        `GDPR cleanup: removed ${deleted} audit log entries older than ${retentionDays} days`,
      );
    } catch (err) {
      this.logger.error('GDPR audit log cleanup failed', err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush(true);
  }
}
