import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PoolClient } from 'pg';

@Injectable()
export class IndustryRepository {
  constructor(private db: DatabaseService) {}

  async create(
    name: string,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    const insertQuery = `
      INSERT INTO industry (name, created_by, updated_by)
      VALUES ($1, $2, $2)
      RETURNING id, name, created_by, updated_by, created_at, updated_at
    `;
    const { rows } = await this.db.query(insertQuery, [
      name,
      userId || null,
    ]);
    return rows[0] as Record<string, unknown>;
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const query = `
      SELECT 
        i.id, 
        i.name, 
        i.created_by, 
        i.updated_by, 
        i.created_at, 
        i.updated_at,
        COALESCE(
          NULLIF(TRIM(COALESCE(cb_emp.first_name, '') || ' ' || COALESCE(cb_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_aud.first_name, '') || ' ' || COALESCE(cb_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_rev.first_name, '') || ' ' || COALESCE(cb_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_sub.first_name, '') || ' ' || COALESCE(cb_sub.last_name, '')), ''),
          cb_user.email
        ) as created_by_name,
        COALESCE(
          NULLIF(TRIM(COALESCE(ub_emp.first_name, '') || ' ' || COALESCE(ub_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_aud.first_name, '') || ' ' || COALESCE(ub_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_rev.first_name, '') || ' ' || COALESCE(ub_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_sub.first_name, '') || ' ' || COALESCE(ub_sub.last_name, '')), ''),
          ub_user.email
        ) as updated_by_name
      FROM industry i
      LEFT JOIN users cb_user ON i.created_by = cb_user.id
      LEFT JOIN employee cb_emp ON cb_user.id = cb_emp.user_id
      LEFT JOIN auditor cb_aud ON cb_user.id = cb_aud.user_id
      LEFT JOIN reviewer cb_rev ON cb_user.id = cb_rev.user_id
      LEFT JOIN subadmin cb_sub ON cb_user.id = cb_sub.user_id
      LEFT JOIN users ub_user ON i.updated_by = ub_user.id
      LEFT JOIN employee ub_emp ON ub_user.id = ub_emp.user_id
      LEFT JOIN auditor ub_aud ON ub_user.id = ub_aud.user_id
      LEFT JOIN reviewer ub_rev ON ub_user.id = ub_rev.user_id
      LEFT JOIN subadmin ub_sub ON ub_user.id = ub_sub.user_id
      WHERE i.id = $1
    `;
    const { rows } = await this.db.query(query, [id]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async findByName(name: string): Promise<Record<string, unknown> | null> {
    const query = `
      SELECT 
        i.id, 
        i.name, 
        i.created_by, 
        i.updated_by, 
        i.created_at, 
        i.updated_at,
        COALESCE(
          NULLIF(TRIM(COALESCE(cb_emp.first_name, '') || ' ' || COALESCE(cb_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_aud.first_name, '') || ' ' || COALESCE(cb_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_rev.first_name, '') || ' ' || COALESCE(cb_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_sub.first_name, '') || ' ' || COALESCE(cb_sub.last_name, '')), ''),
          cb_user.email
        ) as created_by_name,
        COALESCE(
          NULLIF(TRIM(COALESCE(ub_emp.first_name, '') || ' ' || COALESCE(ub_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_aud.first_name, '') || ' ' || COALESCE(ub_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_rev.first_name, '') || ' ' || COALESCE(ub_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_sub.first_name, '') || ' ' || COALESCE(ub_sub.last_name, '')), ''),
          ub_user.email
        ) as updated_by_name
      FROM industry i
      LEFT JOIN users cb_user ON i.created_by = cb_user.id
      LEFT JOIN employee cb_emp ON cb_user.id = cb_emp.user_id
      LEFT JOIN auditor cb_aud ON cb_user.id = cb_aud.user_id
      LEFT JOIN reviewer cb_rev ON cb_user.id = cb_rev.user_id
      LEFT JOIN subadmin cb_sub ON cb_user.id = cb_sub.user_id
      LEFT JOIN users ub_user ON i.updated_by = ub_user.id
      LEFT JOIN employee ub_emp ON ub_user.id = ub_emp.user_id
      LEFT JOIN auditor ub_aud ON ub_user.id = ub_aud.user_id
      LEFT JOIN reviewer ub_rev ON ub_user.id = ub_rev.user_id
      LEFT JOIN subadmin ub_sub ON ub_user.id = ub_sub.user_id
      WHERE LOWER(i.name) = LOWER($1)
    `;
    const { rows } = await this.db.query(query, [name]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async findAll(
    limit: number = 10,
    offset: number = 0,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
  }> {
    const queryTotal = `SELECT COUNT(*) as count FROM industry`;
    const totalResult = await this.db.query(queryTotal);
    const total = Number(
      (totalResult.rows[0] as Record<string, unknown>).count,
    );

    const queryData = `
      SELECT 
        i.id, 
        i.name, 
        i.created_by, 
        i.updated_by, 
        i.created_at, 
        i.updated_at,
        COALESCE(
          NULLIF(TRIM(COALESCE(cb_emp.first_name, '') || ' ' || COALESCE(cb_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_aud.first_name, '') || ' ' || COALESCE(cb_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_rev.first_name, '') || ' ' || COALESCE(cb_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(cb_sub.first_name, '') || ' ' || COALESCE(cb_sub.last_name, '')), ''),
          cb_user.email
        ) as created_by_name,
        COALESCE(
          NULLIF(TRIM(COALESCE(ub_emp.first_name, '') || ' ' || COALESCE(ub_emp.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_aud.first_name, '') || ' ' || COALESCE(ub_aud.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_rev.first_name, '') || ' ' || COALESCE(ub_rev.last_name, '')), ''),
          NULLIF(TRIM(COALESCE(ub_sub.first_name, '') || ' ' || COALESCE(ub_sub.last_name, '')), ''),
          ub_user.email
        ) as updated_by_name
      FROM industry i
      LEFT JOIN users cb_user ON i.created_by = cb_user.id
      LEFT JOIN employee cb_emp ON cb_user.id = cb_emp.user_id
      LEFT JOIN auditor cb_aud ON cb_user.id = cb_aud.user_id
      LEFT JOIN reviewer cb_rev ON cb_user.id = cb_rev.user_id
      LEFT JOIN subadmin cb_sub ON cb_user.id = cb_sub.user_id
      LEFT JOIN users ub_user ON i.updated_by = ub_user.id
      LEFT JOIN employee ub_emp ON ub_user.id = ub_emp.user_id
      LEFT JOIN auditor ub_aud ON ub_user.id = ub_aud.user_id
      LEFT JOIN reviewer ub_rev ON ub_user.id = ub_rev.user_id
      LEFT JOIN subadmin ub_sub ON ub_user.id = ub_sub.user_id
      ORDER BY i.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await this.db.query(queryData, [limit, offset]);

    return {
      data: dataResult.rows as Record<string, unknown>[],
      total,
    };
  }

  async update(
    id: string,
    name: string,
    userId?: string,
  ): Promise<Record<string, unknown> | null> {
    const updateQuery = `
      UPDATE industry
      SET name = $1, updated_by = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, name, created_by, updated_by, created_at, updated_at
    `;
    const { rows } = await this.db.query(updateQuery, [name, userId || null, id]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async beginTransaction(): Promise<PoolClient> {
    const client = await this.db.getClient();
    await client.query('BEGIN');
    return client;
  }

  async commitTransaction(client: PoolClient): Promise<void> {
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }

  async rollbackTransaction(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ROLLBACK failed — connection is broken, destroy instead of recycling
      client.release(true);
      return;
    }
    client.release();
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.beginTransaction();
    try {
      await client.query(
        'DELETE FROM organization_industries WHERE industry_id = $1',
        [id],
      );

      // Batch update: unpublish certificates that only had this one industry
      await client.query(
        `UPDATE certificates
         SET industry_ids = array_remove(industry_ids, $1::uuid),
             is_published = CASE WHEN array_length(industry_ids, 1) = 1 THEN FALSE ELSE is_published END,
             updated_at = NOW()
         WHERE industry_ids @> ARRAY[$1]::uuid[]`,
        [id],
      );

      await client.query('DELETE FROM industry WHERE id = $1', [id]);

      await this.commitTransaction(client);
      return true;
    } catch (error) {
      await this.rollbackTransaction(client);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    const query = `SELECT 1 FROM industry WHERE id = $1 LIMIT 1`;
    const { rows } = await this.db.query(query, [id]);
    return rows.length > 0;
  }
}
