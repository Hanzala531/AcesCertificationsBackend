import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SubadminRepository {
  constructor(private db: DatabaseService) {}

  async create(
    userId: string,
    firstName: string,
    lastName: string,
    profilePicture?: string,
  ): Promise<Record<string, unknown>> {
    const query = `
      INSERT INTO subadmin (user_id, first_name, last_name, profile_picture)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, first_name, last_name, profile_picture, created_at, updated_at
    `;
    const params = [userId, firstName, lastName, profilePicture || null];
    const { rows } = await this.db.query(query, params);
    return rows[0] as Record<string, unknown>;
  }

  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const query = `SELECT * FROM subadmin WHERE user_id = $1`;
    const { rows } = await this.db.query(query, [userId]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const query = `SELECT * FROM subadmin WHERE id = $1`;
    const { rows } = await this.db.query(query, [id]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async findAll(params?: { limit?: number; offset?: number }): Promise<{
    subadmins: Record<string, unknown>[];
    total: number;
  }> {
    const limit = params?.limit || 25;
    const offset = params?.offset || 0;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM subadmin s
      JOIN users u ON s.user_id = u.id
      WHERE u.is_deleted = FALSE
    `;
    const countResult = await this.db.query(countQuery);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const query = `
      SELECT 
        s.id,
        s.user_id,
        s.first_name,
        s.last_name,
        s.profile_picture,
        s.permissions,
        COALESCE(s.accountstatus, true)::boolean AS "accountStatus",
        s.created_at,
        s.updated_at,
        u.email, 
        u.is_active, 
        u.is_verified, 
        u.last_login
      FROM subadmin s
      JOIN users u ON s.user_id = u.id
      WHERE u.is_deleted = FALSE
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await this.db.query(query, [limit, offset]);

    const normalizedRows = rows.map((row: Record<string, unknown>) => {
      const normalized = { ...row };

      let accountStatus: unknown = normalized.accountStatus;
      if (accountStatus === undefined) {
        accountStatus = normalized.accountstatus;
      }

      if (
        accountStatus === false ||
        accountStatus === 'f' ||
        accountStatus === 0 ||
        accountStatus === 'false' ||
        accountStatus === false
      ) {
        normalized.accountStatus = false;
      } else if (
        accountStatus === true ||
        accountStatus === 't' ||
        accountStatus === 1 ||
        accountStatus === 'true'
      ) {
        normalized.accountStatus = true;
      } else if (accountStatus === null || accountStatus === undefined) {
        normalized.accountStatus = true;
      } else {
        normalized.accountStatus = true;
      }

      if (
        normalized.accountstatus !== undefined &&
        normalized.accountstatus !== normalized.accountStatus
      ) {
        delete normalized.accountstatus;
      }

      return normalized;
    });

    return {
      subadmins: normalizedRows as Record<string, unknown>[],
      total,
    };
  }

  async update(
    id: string,
    fields: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const allowedFields = [
      'first_name',
      'last_name',
      'profile_picture',
      'accountStatus',
      'permissions',
    ];
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const [k, v] of Object.entries(fields)) {
      if (!allowedFields.includes(k)) {
        throw new Error(`Invalid field: ${k}`);
      }
      if (k === 'permissions') {
        parts.push(`permissions = $${i++}::jsonb`);
        params.push(JSON.stringify(v));
      } else if (k === 'accountStatus') {
        parts.push(`accountstatus = $${i++}`);
        params.push(v);
      } else {
        parts.push(`${k} = $${i++}`);
        params.push(v);
      }
    }

    if (!parts.length) return this.findById(id);
    params.push(id);
    const sql = `UPDATE subadmin SET ${parts.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
    const { rows } = await this.db.query(sql, params);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async updatePermissionsAdd(
    id: string,
    permissions: unknown[],
  ): Promise<unknown[] | null> {
    const safePermissions = this.normalizePermissionsForJson(permissions);
    const permissionsJson = JSON.stringify(safePermissions);

    const query = `
      WITH existing AS (
        SELECT permissions
        FROM subadmin
        WHERE id = $1
      ),
      existing_perms AS (
        SELECT 
          perm->>'resource' AS resource,
          CASE 
            WHEN jsonb_typeof(perm->'action') = 'array' THEN perm->'action'
            WHEN jsonb_typeof(perm->'action') = 'string' THEN jsonb_build_array(perm->>'action')
            ELSE '[]'::jsonb
          END AS actions
        FROM existing,
        LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(permissions) = 'array' THEN permissions ELSE '[]'::jsonb END
        ) AS perm
      ),
      new_perms AS (
        SELECT 
          perm->>'resource' AS resource,
          CASE 
            WHEN jsonb_typeof(perm->'action') = 'array' THEN perm->'action'
            WHEN jsonb_typeof(perm->'action') = 'string' THEN jsonb_build_array(perm->>'action')
            ELSE '[]'::jsonb
          END AS actions
        FROM jsonb_array_elements($2::jsonb) AS perm
      ),
      merged AS (
        SELECT 
          COALESCE(ep.resource, np.resource) AS resource,
          COALESCE(
            (
              SELECT jsonb_agg(DISTINCT action_val)
              FROM (
                SELECT jsonb_array_elements_text(COALESCE(ep.actions, '[]'::jsonb)) AS action_val
                UNION
                SELECT jsonb_array_elements_text(COALESCE(np.actions, '[]'::jsonb)) AS action_val
              ) combined_actions
            ),
            '[]'::jsonb
          ) AS actions
        FROM existing_perms ep
        FULL OUTER JOIN new_perms np ON ep.resource = np.resource
        WHERE COALESCE(ep.resource, np.resource) IS NOT NULL
      )
      UPDATE subadmin
      SET permissions = (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('resource', resource, 'action', actions)), '[]'::jsonb)
        FROM merged
      )
      WHERE id = $1
      RETURNING permissions;
    `;
    const res = await this.db.query(query, [id, permissionsJson]);
    return (res.rows[0]?.permissions as unknown[]) || null;
  }

  async updatePermissionsRemove(
    id: string,
    permissions: unknown[],
  ): Promise<unknown[] | null> {
    const toRemove = this.normalizePermissionsForJson(permissions);
    if (toRemove.length === 0) {
      const current = await this.getPermissions(id);
      return current;
    }

    const existing = await this.getPermissions(id);
    if (!existing || existing.length === 0) {
      return existing ?? [];
    }

    const existingNorm = this.normalizePermissionsForJson(existing);
    const toRemoveSet = new Map<string, Set<string>>();
    for (const p of toRemove) {
      if (!toRemoveSet.has(p.resource)) toRemoveSet.set(p.resource, new Set());
      p.action.forEach((a) => toRemoveSet.get(p.resource)!.add(a));
    }

    const result: { resource: string; action: string[] }[] = [];
    for (const p of existingNorm) {
      const removeActions = toRemoveSet.get(p.resource);
      if (!removeActions) {
        result.push(p);
        continue;
      }
      const remaining = p.action.filter((a) => !removeActions.has(a));
      if (remaining.length > 0) {
        result.push({ resource: p.resource, action: remaining });
      }
    }

    const permissionsJson = JSON.stringify(result);
    const res = await this.db.query(
      `UPDATE subadmin SET permissions = $2::jsonb WHERE id = $1 RETURNING permissions`,
      [id, permissionsJson],
    );
    return (res.rows[0]?.permissions as unknown[]) || null;
  }

  private async getPermissions(id: string): Promise<unknown[] | null> {
    const res = await this.db.query(
      `SELECT permissions FROM subadmin WHERE id = $1`,
      [id],
    );
    const raw = res.rows[0]?.permissions;
    if (raw == null) return null;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return Array.isArray(raw) ? raw : [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private normalizePermissionsForJson(
    permissions: unknown[],
  ): { resource: string; action: string[] }[] {
    if (!Array.isArray(permissions)) return [];
    return permissions
      .map((p) => {
        if (!p || typeof p !== 'object')
          return { resource: '', action: [] as string[] };
        const r = p as Record<string, unknown>;
        const resource = typeof r.resource === 'string' ? r.resource : '';
        const action = Array.isArray(r.action)
          ? (r.action as unknown[]).filter(
              (a): a is string => typeof a === 'string',
            )
          : typeof r.action === 'string'
            ? [r.action]
            : [];
        return { resource, action };
      })
      .filter((x) => x.resource.length > 0 && x.action.length > 0);
  }

  async delete(id: string): Promise<boolean> {
    await this.db.query('DELETE FROM subadmin WHERE id = $1', [id]);
    return true;
  }
}
