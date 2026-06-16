import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ActivityType } from './dto/get-activity.dto';

export interface ActivityLogRow {
  action: string;
  metadata: Record<string, unknown> | null;
  http_path?: string | null;
  created_at: Date;
}

export interface ActivityFilters {
  type?: ActivityType;
  fromDate?: string;
  toDate?: string;
  page: number;
  limit: number;
}

@Injectable()
export class ActivityRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByUser(
    userId: string,
    filters: ActivityFilters,
  ): Promise<{ items: ActivityLogRow[]; total: number }> {
    const includeLoginLogs = !filters.type || filters.type === ActivityType.AUTH;
    const params: unknown[] = [
      userId,
      filters.type ?? null,
      filters.fromDate ?? null,
      filters.toDate ?? null,
      includeLoginLogs,
    ];

    const baseQuery = `
      WITH combined_activity AS (
        SELECT
          action,
          metadata,
          http_path,
          created_at
        FROM audit_logs
        WHERE actor_id = $1
          AND ($2::text IS NULL OR category = $2::text)
          AND ($3::timestamptz IS NULL OR created_at >= $3::timestamptz)
          AND ($4::timestamptz IS NULL OR created_at <= $4::timestamptz)
          AND (
            LOWER(category::text) = 'auth'
            OR action ILIKE '%login%'
            OR action ILIKE '%logout%'
            OR action ILIKE '%password%'
            OR action ILIKE '%profile%'
            OR (
              action ILIKE '%.update'
              AND (
                http_path ILIKE '%password%'
                OR http_path ILIKE '%change-password%'
                OR http_path ILIKE '%profile%'
                OR http_path ILIKE '%/users/me%'
                OR http_path ILIKE '%/users/%/profile%'
              )
            )
          )

        UNION ALL

        SELECT
          'auth.login' AS action,
          jsonb_strip_nulls(
            jsonb_build_object(
              'email', email,
              'device', device,
              'location', location
            )
          ) AS metadata,
          NULL::text AS http_path,
          created_at
        FROM login_logs
        WHERE $5::boolean = true
          AND user_id::text = $1
          AND ($3::timestamptz IS NULL OR created_at >= $3::timestamptz)
          AND ($4::timestamptz IS NULL OR created_at <= $4::timestamptz)
      )
    `;

    const countResult = await this.db.query(
      `${baseQuery}
       SELECT COUNT(*)::int AS total
       FROM combined_activity`,
      params,
    );

    const total = (countResult.rows[0] as { total: number }).total;

    const offset = (filters.page - 1) * filters.limit;
    const dataParams = [...params, filters.limit, offset];

    const dataResult = await this.db.query(
      `${baseQuery}
       SELECT
         action,
         metadata,
         http_path,
         created_at
       FROM combined_activity
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      items: dataResult.rows as ActivityLogRow[],
      total,
    };
  }
}
