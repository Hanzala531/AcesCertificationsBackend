import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type {
  AuditLog,
  CreateAuditLogInput,
} from './interfaces/audit-log.interface';

export interface AuditLogFilters {
  from?: Date;
  to?: Date;
  actor_id?: string;
  action?: string;
  category?: string;
}

@Injectable()
export class AuditLogRepository {
  constructor(private readonly db: DatabaseService) {}

  async bulkInsert(entries: CreateAuditLogInput[]): Promise<void> {
    if (entries.length === 0) return;

    const values: unknown[] = [];
    const placeholders = entries.map((entry, i) => {
      const base = i * 15;
      values.push(
        entry.action,
        entry.category,
        entry.actor_id ?? null,
        entry.actor_role ?? null,
        entry.target_entity ?? null,
        entry.target_id ?? null,
        entry.http_method ?? null,
        entry.http_path ?? null,
        entry.http_status_code ?? null,
        entry.request_id ?? null,
        entry.ip_address ?? null,
        entry.user_agent ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.error_message ?? null,
        entry.duration_ms ?? null,
      );
      return (
        `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},` +
        `$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},` +
        `$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15})`
      );
    });

    await this.db.query(
      `INSERT INTO audit_logs
        (action, category, actor_id, actor_role, target_entity, target_id,
         http_method, http_path, http_status_code, request_id, ip_address,
         user_agent, metadata, error_message, duration_ms)
       VALUES ${placeholders.join(',')}`,
      values,
    );
  }

  async findPaginated(
    filters: AuditLogFilters,
    page: number,
    limit: number,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.from) {
      params.push(filters.from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      conditions.push(`created_at <= $${params.length}`);
    }
    if (filters.actor_id) {
      params.push(filters.actor_id);
      conditions.push(`actor_id = $${params.length}`);
    }
    if (filters.action) {
      params.push(filters.action);
      conditions.push(`action = $${params.length}`);
    }
    if (filters.category) {
      params.push(filters.category);
      conditions.push(`category = $${params.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query(
      `SELECT COUNT(*) FROM audit_logs ${where}`,
      params,
    );
    const total = parseInt((countRes.rows[0] as { count: string }).count, 10);

    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];

    const dataRes = await this.db.query(
      `SELECT * FROM audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { items: dataRes.rows as AuditLog[], total };
  }

  async findForExport(
    from: Date,
    to: Date,
    limit: number,
  ): Promise<AuditLog[]> {
    const res = await this.db.query(
      `SELECT * FROM audit_logs
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [from, to, limit],
    );
    return res.rows as AuditLog[];
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const res = await this.db.query(
      `DELETE FROM audit_logs WHERE created_at < $1`,
      [date],
    );
    return res.rowCount ?? 0;
  }
}
