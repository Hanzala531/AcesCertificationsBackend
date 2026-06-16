import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  BranchRecord,
  CreateBranchData,
  UpdateBranchData,
} from './types/branch.types';

interface QueryResult<T> {
  rows: T[];
}

type Queryable = DatabaseService | PoolClient;

@Injectable()
export class BranchRepository {
  constructor(private db: DatabaseService) {}

  private queryWith(client?: PoolClient): Queryable {
    return client ?? this.db;
  }

  async create(data: CreateBranchData, client?: PoolClient): Promise<BranchRecord> {
    const query = `
      INSERT INTO branches (
        organization_id,
        name,
        address,
        city,
        state,
        country,
        postal_code,
        contact_no,
        email,
        branch_size,
        is_main
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;

    const values = [
      data.organization_id,
      data.name,
      data.address || null,
      data.city || null,
      data.state || null,
      data.country || null,
      data.postal_code || null,
      data.contact_no || null,
      data.email || null,
      data.branch_size || null,
      data.is_main || false,
    ];

    const result = (await this.queryWith(client).query(
      query,
      values,
    )) as QueryResult<BranchRecord>;
    return result.rows[0];
  }

  async findById(id: string): Promise<BranchRecord | null> {
    const result = (await this.db.query(
      'SELECT * FROM branches WHERE id = $1 LIMIT 1',
      [id],
    )) as QueryResult<BranchRecord>;
    return result.rows[0] || null;
  }

  async findByOrganizationId(
    organizationId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ data: BranchRecord[]; total: number }> {
    const totalResult = (await this.db.query(
      'SELECT COUNT(*) as count FROM branches WHERE organization_id = $1',
      [organizationId],
    )) as QueryResult<{ count: string }>;

    const total = parseInt(totalResult.rows[0]?.count || '0', 10);

    const dataResult = (await this.db.query(
      'SELECT * FROM branches WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [organizationId, limit, offset],
    )) as QueryResult<BranchRecord>;

    return {
      data: dataResult.rows,
      total,
    };
  }

  async findAllByOrganizationId(
    organizationId: string,
  ): Promise<{ data: BranchRecord[]; total: number }> {
    const dataResult = (await this.db.query(
      'SELECT * FROM branches WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId],
    )) as QueryResult<BranchRecord>;

    return {
      data: dataResult.rows,
      total: dataResult.rows.length,
    };
  }

  async update(
    id: string,
    data: UpdateBranchData,
  ): Promise<BranchRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `UPDATE branches SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = (await this.db.query(
      query,
      values,
    )) as QueryResult<BranchRecord>;
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM branches WHERE id = $1 RETURNING id',
      [id],
    );
    return (result as QueryResult<{ id: string }>).rows.length > 0;
  }

  async findByIdAndOrganization(
    branchId: string,
    organizationId: string,
  ): Promise<BranchRecord | null> {
    const result = (await this.db.query(
      'SELECT * FROM branches WHERE id = $1 AND organization_id = $2 LIMIT 1',
      [branchId, organizationId],
    )) as QueryResult<BranchRecord>;
    return result.rows[0] || null;
  }

  async findMainBranchByOrganization(
    organizationId: string,
    client?: PoolClient,
  ): Promise<BranchRecord | null> {
    const result = (await this.queryWith(client).query(
      'SELECT * FROM branches WHERE organization_id = $1 AND is_main = TRUE LIMIT 1',
      [organizationId],
    )) as QueryResult<BranchRecord>;
    return result.rows[0] || null;
  }

  async updateMainBranch(
    branchId: string,
    organizationId: string,
  ): Promise<BranchRecord | null> {
    return this.db.transaction(async (client) => {
      await client.query(
        'UPDATE branches SET is_main = FALSE WHERE organization_id = $1',
        [organizationId],
      );

      const result = (await client.query(
        'UPDATE branches SET is_main = TRUE WHERE id = $1 AND organization_id = $2 RETURNING *',
        [branchId, organizationId],
      )) as QueryResult<BranchRecord>;

      return result.rows[0] || null;
    });
  }

  async isEmailTaken(
    email: string,
    organizationId: string,
    excludeBranchId?: string,
    client?: PoolClient,
  ): Promise<{ taken: boolean; usedBy: 'organization' | 'branch' | null }> {
    // Check organization email and the organization owner's account email
    const orgResult = (await this.queryWith(client).query(
      `SELECT o.email AS org_email, u.email AS user_email
       FROM organization o
       JOIN users u ON u.id = o.user_id
       WHERE o.id = $1
         AND (LOWER(o.email) = LOWER($2) OR LOWER(u.email) = LOWER($2))
       LIMIT 1`,
      [organizationId, email],
    )) as QueryResult<{ org_email: string; user_email: string }>;
    if (orgResult.rows.length > 0) {
      return { taken: true, usedBy: 'organization' };
    }

    // Check other branch emails in the same organization
    const branchQuery = excludeBranchId
      ? `SELECT id FROM branches WHERE organization_id = $1 AND LOWER(email) = LOWER($2) AND id != $3 LIMIT 1`
      : `SELECT id FROM branches WHERE organization_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`;
    const branchParams = excludeBranchId
      ? [organizationId, email, excludeBranchId]
      : [organizationId, email];
    const branchResult = (await this.queryWith(client).query(
      branchQuery,
      branchParams,
    )) as QueryResult<{ id: string }>;
    if (branchResult.rows.length > 0) {
      return { taken: true, usedBy: 'branch' };
    }

    return { taken: false, usedBy: null };
  }

  async findByNameAndOrganization(
    name: string,
    organizationId: string,
    client?: PoolClient,
  ): Promise<BranchRecord | null> {
    const result = (await this.queryWith(client).query(
      'SELECT * FROM branches WHERE LOWER(name) = LOWER($1) AND organization_id = $2 LIMIT 1',
      [name, organizationId],
    )) as QueryResult<BranchRecord>;
    return result.rows[0] || null;
  }

  async getOrganizationAsBranch(
    organizationId: string,
  ): Promise<BranchRecord | null> {
    const result = (await this.db.query(
      `SELECT
         o.id,
         o.id AS organization_id,
         o.name,
         NULL AS address,
         o.legal_city AS city,
         o.legal_state AS state,
         o.legal_country AS country,
         NULL AS postal_code,
         o.contact_no,
         COALESCE(o.email, u.email) AS email,
         TRUE AS is_main,
         o.company_size AS branch_size,
         o.created_at,
         o.updated_at
       FROM organization o
       JOIN users u ON u.id = o.user_id
       WHERE o.id = $1
       LIMIT 1`,
      [organizationId],
    )) as QueryResult<BranchRecord>;
    return result.rows[0] || null;
  }
}
