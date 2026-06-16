import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { EmployeeRecord, CreateEmployeeData } from './types/employee.types';

interface QueryResult<T> {
  rows: T[];
}

@Injectable()
export class EmployeeRepository {
  constructor(private db: DatabaseService) {}

  async create(data: CreateEmployeeData): Promise<EmployeeRecord> {
    const query = `
      INSERT INTO employee (
        user_id,
        first_name,
        last_name,
        organization_id,
        branch_id,
        position,
        department,
        profile_picture,
        phone_number,
        permissions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const values = [
      data.user_id,
      data.first_name,
      data.last_name,
      data.organization_id,
      data.branch_id || null,
      data.position || null,
      data.department || null,
      data.profile_picture || null,
      data.phone_number || null,
      data.permissions ? JSON.stringify(data.permissions) : '[]',
    ];

    const result = (await this.db.query(
      query,
      values,
    )) as QueryResult<EmployeeRecord>;
    return result.rows[0];
  }

  async findById(id: string): Promise<EmployeeRecord | null> {
    const query = `
      SELECT 
        e.*,
        u.email
      FROM employee e
      JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
      LIMIT 1;
    `;
    const result = (await this.db.query(query, [
      id,
    ])) as QueryResult<EmployeeRecord>;
    return result.rows[0] || null;
  }

  async findByUserId(userId: string): Promise<EmployeeRecord | null> {
    const query = `
      SELECT 
        e.*,
        u.email
      FROM employee e
      JOIN users u ON e.user_id = u.id
      WHERE e.user_id = $1
      LIMIT 1;
    `;
    const result = (await this.db.query(query, [
      userId,
    ])) as QueryResult<EmployeeRecord>;
    return result.rows[0] || null;
  }

  async findByOrganizationId(
    organizationId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ data: EmployeeRecord[]; total: number }> {
    const query = `
      SELECT 
        e.*,
        u.email
      FROM employee e
      JOIN users u ON e.user_id = u.id
      WHERE e.organization_id = $1
      ORDER BY e.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const countQuery = `
      SELECT COUNT(*) as total FROM employee WHERE organization_id = $1;
    `;

    const result = (await this.db.query(query, [
      organizationId,
      limit,
      offset,
    ])) as QueryResult<EmployeeRecord>;

    const countResult = (await this.db.query(countQuery, [
      organizationId,
    ])) as QueryResult<{ total: string }>;
    const countRow = countResult.rows[0];
    const total = parseInt(countRow.total, 10);

    return {
      data: result.rows,
      total,
    };
  }

  async findAllByOrganizationId(
    organizationId: string,
  ): Promise<{ data: EmployeeRecord[]; total: number }> {
    const query = `
      SELECT 
        e.*,
        u.email
      FROM employee e
      JOIN users u ON e.user_id = u.id
      WHERE e.organization_id = $1
      ORDER BY e.created_at DESC;
    `;

    const result = (await this.db.query(query, [
      organizationId,
    ])) as QueryResult<EmployeeRecord>;

    return {
      data: result.rows,
      total: result.rows.length,
    };
  }

  async update(
    id: string,
    fields: Partial<{
      first_name: string;
      last_name: string;
      position: string | null;
      department: string | null;
      profile_picture: string | null;
      phone_number: string | null;
      branch_id: string | null;
      permissions: unknown[] | null;
      status: 'pending' | 'active';
    }>,
  ): Promise<EmployeeRecord | null> {
    const allowedFields = [
      'first_name',
      'last_name',
      'position',
      'department',
      'profile_picture',
      'phone_number',
      'branch_id',
      'permissions',
      'status',
    ];
    const setParts: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (!allowedFields.includes(key)) {
        throw new Error(`Invalid field: ${key}`);
      }
      if (key === 'permissions') {
        setParts.push(`${key} = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(value ?? []));
      } else {
        setParts.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (setParts.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE employee
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *;
    `;
    const result = (await this.db.query(
      query,
      values,
    )) as QueryResult<EmployeeRecord>;
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM employee WHERE id = $1;', [id]);
  }

  async updatePermissionsAdd(
    id: string,
    permissions: unknown[],
  ): Promise<unknown[] | null> {
    const query = `
      WITH existing AS (
        SELECT permissions
        FROM employee
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
      UPDATE employee
      SET permissions = (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('resource', resource, 'action', actions)), '[]'::jsonb)
        FROM merged
      )
      WHERE id = $1
      RETURNING permissions;
    `;
    const res = await this.db.query(query, [id, JSON.stringify(permissions)]);
    return (res.rows[0]?.permissions as unknown[]) || null;
  }

  async updatePermissionsRemove(
    id: string,
    permissions: unknown[],
  ): Promise<unknown[] | null> {
    const query = `
      WITH existing AS (
        SELECT permissions
        FROM employee
        WHERE id = $1
      ),
      removal_map AS (
        SELECT 
          perm->>'resource' AS resource,
          CASE 
            WHEN jsonb_typeof(perm->'action') = 'array' THEN perm->'action'
            WHEN jsonb_typeof(perm->'action') = 'string' THEN jsonb_build_array(perm->>'action')
            ELSE '[]'::jsonb
          END AS actions_to_remove
        FROM jsonb_array_elements($2::jsonb) AS perm
      ),
      updated_perms AS (
        SELECT 
          ep.perm->>'resource' AS resource,
          (
            SELECT jsonb_agg(action_val::jsonb)
            FROM (
              SELECT jsonb_array_elements_text(
                CASE 
                  WHEN jsonb_typeof(ep.perm->'action') = 'array' THEN ep.perm->'action'
                  WHEN jsonb_typeof(ep.perm->'action') = 'string' THEN jsonb_build_array(ep.perm->>'action')
                  ELSE '[]'::jsonb
                END
              ) AS action_val
            ) all_actions
            WHERE action_val NOT IN (
              SELECT jsonb_array_elements_text(COALESCE(rm.actions_to_remove, '[]'::jsonb))
              FROM removal_map rm
              WHERE rm.resource = ep.perm->>'resource'
            )
          ) AS remaining_actions
        FROM existing,
        LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(permissions) = 'array' THEN permissions ELSE '[]'::jsonb END
        ) AS ep(perm)
        LEFT JOIN removal_map rm ON rm.resource = ep.perm->>'resource'
      )
      UPDATE employee
      SET permissions = (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('resource', resource, 'action', remaining_actions)), '[]'::jsonb)
        FROM updated_perms
        WHERE remaining_actions IS NOT NULL 
          AND jsonb_array_length(remaining_actions) > 0
      )
      WHERE id = $1
      RETURNING permissions;
    `;
    const res = await this.db.query(query, [id, JSON.stringify(permissions)]);
    return (res.rows[0]?.permissions as unknown[]) || null;
  }

  async findByEmailAndOrganization(
    email: string,
    organizationId: string,
  ): Promise<EmployeeRecord | null> {
    const query = `
      SELECT
        e.*,
        u.email
      FROM employee e
      JOIN users u ON e.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1) AND e.organization_id = $2
      LIMIT 1;
    `;
    const result = (await this.db.query(query, [
      email,
      organizationId,
    ])) as QueryResult<EmployeeRecord>;
    return result.rows[0] || null;
  }

  async exists(id: string): Promise<boolean> {
    const result = (await this.db.query(
      'SELECT 1 FROM employee WHERE id = $1 LIMIT 1;',
      [id],
    )) as QueryResult<{ '?column?': number }>;
    return result.rows.length > 0;
  }

  async existsByUserIdAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const result = (await this.db.query(
      'SELECT 1 FROM employee WHERE user_id = $1 AND organization_id = $2 LIMIT 1;',
      [userId, organizationId],
    )) as QueryResult<{ '?column?': number }>;
    return result.rows.length > 0;
  }
}
