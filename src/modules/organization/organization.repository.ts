import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface IssuedCertificateRow {
  id: string;
  assessment_id: string;
  certificate_id: string;
  certificate_name: string;
  organization_id: string;
  branch_id: string | null;
  badge_id: string | null;
  badge_name: string | null;
  badge_color: string | null;
  org_badge_id: string | null;
  org_badge_tier: string | null;
  org_badge_color: string | null;
  org_badge_score: number | null;
  certificate_number: string;
  review_score: number | null;
  issued_by: string;
  issued_at: Date;
  expiry_date: Date | null;
  is_blocked: boolean;
  block_reason: string | null;
  assessment_type: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  user_id: string;
  email?: string;
  contact_no?: string;
  company_size?: string;
  website?: string;
  logo?: string;
  industry_ids?: string[];
  total_branches: number;
  organization_type?: string;
  business_id?: string;
  legal_city?: string;
  legal_state?: string;
  legal_country?: string;
  description?: string;
  legal_document_url?: string;
  created_at: Date;
  updated_at: Date;
}

interface QueryResult<T = OrganizationRecord> {
  rows: T[];
}

@Injectable()
export class OrganizationRepository {
  constructor(private db: DatabaseService) {}

  async create(
    userId: string,
    data: {
      name: string;
      industry_ids: string[];
      business_id: string;
      legal_country: string;
      legal_state: string;
      legal_city?: string;
      description: string;
      contact_no?: string;
      email?: string;
      website?: string;
    },
  ): Promise<OrganizationRecord> {
    const orgQuery = `
      INSERT INTO organization (
        user_id,
        name,
        business_id,
        legal_country,
        legal_state,
        legal_city,
        description,
        contact_no,
        email,
        website
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const orgValues = [
      userId,
      data.name,
      data.business_id,
      data.legal_country,
      data.legal_state,
      data.legal_city || null,
      data.description,
      data.contact_no || null,
      data.email || null,
      data.website || null,
    ];

    const organizationId = await this.db.transaction(async (client) => {
      const result = (await client.query(orgQuery, orgValues)) as QueryResult;
      const organization = result.rows[0];

      if (data.industry_ids.length > 0) {
        await client.query(
          `INSERT INTO organization_industries (organization_id, industry_id)
           SELECT $1, unnest($2::uuid[])
           ON CONFLICT (organization_id, industry_id) DO NOTHING`,
          [organization.id, data.industry_ids],
        );
      }

      // Auto-create the organization as the main branch
      await client.query(
        `INSERT INTO branches (
           organization_id, name, city, state, country,
           contact_no, email, is_main
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
        [
          organization.id,
          data.name,
          data.legal_city || null,
          data.legal_state || null,
          data.legal_country || null,
          data.contact_no || null,
          data.email || null,
        ],
      );

      return organization.id as string;
    });

    return this.findByIdWithIndustries(organizationId);
  }

  private async findByIdWithIndustries(
    id: string,
  ): Promise<OrganizationRecord> {
    const query = `
      SELECT 
        o.*,
        COALESCE(array_agg(oi.industry_id) FILTER (WHERE oi.industry_id IS NOT NULL), '{}') as industry_ids
      FROM organization o
      LEFT JOIN organization_industries oi ON o.id = oi.organization_id
      WHERE o.id = $1
      GROUP BY o.id;
    `;
    const result = (await this.db.query(query, [id])) as QueryResult;
    return result.rows[0];
  }

  async findByUserId(userId: string): Promise<OrganizationRecord | null> {
    const query = `
      SELECT 
        o.*,
        u.email,
        COALESCE(array_agg(oi.industry_id) FILTER (WHERE oi.industry_id IS NOT NULL), '{}') as industry_ids
      FROM organization o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN organization_industries oi ON o.id = oi.organization_id
      WHERE o.user_id = $1
      GROUP BY o.id, u.email
      LIMIT 1;
    `;
    const result = (await this.db.query(query, [userId])) as QueryResult;
    return (result.rows[0] as OrganizationRecord | undefined) || null;
  }

  async findByBusinessId(
    businessId: string,
  ): Promise<OrganizationRecord | null> {
    const query = 'SELECT * FROM organization WHERE business_id = $1 LIMIT 1;';
    const result = (await this.db.query(query, [businessId])) as QueryResult;
    return (result.rows[0] as OrganizationRecord | undefined) || null;
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    const query = `
      SELECT 
        o.*,
        COALESCE(array_agg(oi.industry_id) FILTER (WHERE oi.industry_id IS NOT NULL), '{}') as industry_ids
      FROM organization o
      LEFT JOIN organization_industries oi ON o.id = oi.organization_id
      WHERE o.id = $1
      GROUP BY o.id;
    `;
    const result = (await this.db.query(query, [id])) as QueryResult;
    return (result.rows[0] as OrganizationRecord | undefined) || null;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      contact_no: string;
      email: string;
      website: string;
      logo: string;
      industry_id: string;
      description: string;
      legal_country: string;
      legal_state: string;
      legal_city: string;
      organization_type: string;
      total_branches: number;
      legal_document_url: string;
      company_size: string;
      industry_ids: string[];
    }>,
  ): Promise<OrganizationRecord> {
    const allowedFields = [
      'name',
      'contact_no',
      'email',
      'website',
      'logo',
      'industry_id',
      'description',
      'legal_country',
      'legal_state',
      'legal_city',
      'organization_type',
      'total_branches',
      'legal_document_url',
      'company_size',
    ];
    const fields = Object.keys(data).filter((key) =>
      allowedFields.includes(key),
    );

    if (fields.length === 0) {
      const result = (await this.db.query(
        'SELECT * FROM organization WHERE id = $1;',
        [id],
      )) as QueryResult;
      return result.rows[0];
    }

    const setClause = fields
      .map((field, i) => `${field} = $${i + 1}`)
      .join(', ');
    const values: unknown[] = fields.map(
      (field) => data[field as keyof typeof data],
    );
    values.push(id);

    const queryStr = `
      UPDATE organization
      SET ${setClause}
      WHERE id = $${fields.length + 1}
      RETURNING *;
    `;

    const result = (await this.db.query(queryStr, values)) as QueryResult;
    const organization = result.rows[0];

    if (
      data &&
      (data as any).industry_ids &&
      Array.isArray((data as any).industry_ids)
    ) {
      const industryIds: string[] = (data as any).industry_ids;
      await this.db.transaction(async (client) => {
        await client.query(
          'DELETE FROM organization_industries WHERE organization_id = $1',
          [id],
        );
        if (industryIds.length > 0) {
          await client.query(
            `INSERT INTO organization_industries (organization_id, industry_id)
             SELECT $1, unnest($2::uuid[])
             ON CONFLICT DO NOTHING`,
            [id, industryIds],
          );
        }
      });
      const refreshed = await this.findByIdWithIndustries(id);
      return refreshed;
    }

    return organization;
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM organization WHERE id = $1;';
    const result = (await this.db.query(query, [id])) as {
      rowCount?: number;
    };
    return (result.rowCount ?? 0) > 0;
  }

  async findByEmail(email: string): Promise<OrganizationRecord | null> {
    const query = 'SELECT * FROM organization WHERE email = $1 LIMIT 1;';
    const result = (await this.db.query(query, [email])) as QueryResult;
    return (result.rows[0] as OrganizationRecord | undefined) || null;
  }

  async findByContactNo(contactNo: string): Promise<OrganizationRecord | null> {
    const query = 'SELECT * FROM organization WHERE contact_no = $1 LIMIT 1;';
    const result = (await this.db.query(query, [contactNo])) as QueryResult;
    return (result.rows[0] as OrganizationRecord | undefined) || null;
  }

  async getIssuedCertificates(
    organizationId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: IssuedCertificateRow[]; total: number }> {
    const [dataResult, countResult] = (await Promise.all([
      this.db.query(
        `SELECT
           ic.id,
           ic.assessment_id,
           ic.certificate_id,
           ic.certificate_name,
           ic.organization_id,
           ic.branch_id,
           ic.badge_id,
           ic.badge_name,
           ic.badge_color,
           ic.org_badge_id,
           ob.badge_name  AS org_badge_tier,
           ob.color       AS org_badge_color,
           ob.score       AS org_badge_score,
           ic.certificate_number,
           ic.review_score,
           ic.issued_by,
           ic.issued_at,
           ic.expiry_date,
           ic.is_blocked,
           ic.block_reason,
           ic.created_at,
           ic.updated_at,
           ca.assessment_type
         FROM issued_certificates ic
         JOIN certificate_assessments ca ON ca.id = ic.assessment_id
         LEFT JOIN organization_badges ob ON ob.id = ic.org_badge_id
         WHERE ic.organization_id = $1
         ORDER BY ic.issued_at DESC
         LIMIT $2 OFFSET $3`,
        [organizationId, limit, offset],
      ),
      this.db.query(
        `SELECT COUNT(*) AS total FROM issued_certificates WHERE organization_id = $1`,
        [organizationId],
      ),
    ])) as [QueryResult<IssuedCertificateRow>, QueryResult<{ total: string }>];

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    };
  }
}
