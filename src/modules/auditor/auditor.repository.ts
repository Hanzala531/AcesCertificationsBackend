import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AuditorRepository {
  constructor(private db: DatabaseService) {}

  async create(
    userId: string,
    firstName: string,
    lastName: string,
    country?: string,
    state?: string,
    city?: string,
    profilePicture?: string,
    assignedCertificates?: string[],
    status?: string,
    accountStatus?: boolean,
  ): Promise<Record<string, unknown>> {
    const query = `
      INSERT INTO auditor (user_id, first_name, last_name, country, state, city, profile_picture, assigned_certificates, status, accountStatus)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, user_id, first_name, last_name, country, state, city, profile_picture, assigned_certificates, status, accountStatus, created_at, updated_at
    `;
    const params = [
      userId,
      firstName,
      lastName,
      country || null,
      state || null,
      city || null,
      profilePicture || null,
      assignedCertificates || [],
      status || 'available',
      accountStatus !== undefined ? accountStatus : true,
    ];
    const { rows } = await this.db.query(query, params);
    return rows[0] as Record<string, unknown>;
  }

  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const query = `SELECT * FROM auditor WHERE user_id = $1`;
    const { rows } = await this.db.query(query, [userId]);
    if (!rows[0]) return null;
    const result = rows[0] as Record<string, unknown>;
    if (
      result.accountstatus !== undefined &&
      result.accountStatus === undefined
    ) {
      result.accountStatus = result.accountstatus;
    }
    return result;
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const query = `SELECT * FROM auditor WHERE id = $1`;
    const { rows } = await this.db.query(query, [id]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async findAll(params?: { limit?: number; offset?: number }): Promise<{
    auditors: Record<string, unknown>[];
    total: number;
  }> {
    const limit = params?.limit || 25;
    const offset = params?.offset || 0;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN auditor a ON a.user_id = u.id
      WHERE u.is_deleted = FALSE
        AND u.role = 'auditor'
    `;
    const countResult = await this.db.query(countQuery);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const query = `
      SELECT
        a.id,
        u.id AS user_id,
        a.first_name,
        a.last_name,
        a.country,
        a.state,
        a.city,
        a.profile_picture,
        COALESCE(a.assigned_certificates, ARRAY[]::TEXT[]) AS assigned_certificates,
        a.status,
        COALESCE(a.accountstatus, true)::boolean AS "accountStatus",
        a.created_at,
        a.updated_at,
        u.email,
        u.role,
        u.is_active,
        u.is_verified,
        u.last_login
      FROM users u
      LEFT JOIN auditor a ON a.user_id = u.id
      WHERE u.is_deleted = FALSE
        AND u.role = 'auditor'
      ORDER BY a.created_at DESC NULLS LAST, u.created_at DESC
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
      auditors: normalizedRows as Record<string, unknown>[],
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
      'signature',
      'country',
      'state',
      'city',
      'status',
      'assigned_certificates',
      'accountStatus',
    ];
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const [k, v] of Object.entries(fields)) {
      if (!allowedFields.includes(k)) {
        throw new Error(`Invalid field: ${k}`);
      }
      const dbFieldName = k === 'accountStatus' ? 'accountStatus' : k;
      parts.push(`${dbFieldName} = $${i++}`);
      params.push(v);
    }

    if (!parts.length) return this.findById(id);
    params.push(id);
    const sql = `UPDATE auditor SET ${parts.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
    const { rows } = await this.db.query(sql, params);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async assignCertificates(
    id: string,
    certificateIds: string[],
  ): Promise<Record<string, unknown> | null> {
    if (!certificateIds || certificateIds.length === 0) {
      return null;
    }

    const matchedRes = await this.db.query(
      `SELECT id FROM certificates WHERE id::text = ANY($1::text[]) OR certificate_id = ANY($1::text[])`,
      [certificateIds],
    );
    const matchedIds = (matchedRes.rows || []).map((r: any) => r.id);

    if (matchedIds.length !== certificateIds.length) {
      throw new Error(
        'One or more certificate IDs are invalid or do not exist',
      );
    }

    const currentRes = await this.db.query(
      'SELECT assigned_certificates FROM auditor WHERE id = $1',
      [id],
    );
    const currentAssigned: string[] =
      (currentRes.rows[0]?.assigned_certificates as string[]) || [];
    const alreadyAssigned = matchedIds.filter((m) =>
      currentAssigned.includes(m),
    );
    if (alreadyAssigned.length > 0) {
      throw new Error(
        `Certificates already assigned: ${alreadyAssigned.join(',')}`,
      );
    }

    const updateQuery = `
      UPDATE auditor 
      SET assigned_certificates = (
          SELECT array_agg(DISTINCT elem)
          FROM unnest(
            COALESCE(assigned_certificates, ARRAY[]::TEXT[]) || $2::TEXT[]
          ) AS elem
        ),
          updated_at = NOW()
      WHERE id = $1
      RETURNING assigned_certificates
    `;
    const { rows: updateRows } = await this.db.query(updateQuery, [
      id,
      matchedIds,
    ]);

    if (!updateRows || updateRows.length === 0) {
      return null;
    }

    const assignedCertificates = updateRows[0]
      .assigned_certificates as string[];

    if (!assignedCertificates || assignedCertificates.length === 0) {
      return { assigned_certificates: [] };
    }

    const certificatesQuery = `
      SELECT id, certificate_id, name
      FROM certificates
      WHERE id::text = ANY($1::text[]) OR certificate_id = ANY($1::text[])
      ORDER BY name
    `;
    const { rows: certRows } = await this.db.query(certificatesQuery, [
      assignedCertificates,
    ]);

    return {
      assigned_certificates: certRows.map((cert) => ({
        id: cert.id,
        certificate_id: cert.certificate_id,
        name: cert.name,
      })),
    };
  }

  async unassignCertificates(
    id: string,
    certificateIds: string[],
  ): Promise<Record<string, unknown> | null> {
    if (!certificateIds || certificateIds.length === 0) {
      return null;
    }

    const matchedRes = await this.db.query(
      `SELECT id FROM certificates WHERE id::text = ANY($1::text[]) OR certificate_id = ANY($1::text[])`,
      [certificateIds],
    );
    const matchedIds = (matchedRes.rows || []).map((r: any) => r.id);

    if (matchedIds.length !== certificateIds.length) {
      throw new Error(
        'One or more certificate IDs are invalid or do not exist',
      );
    }
    const currentRes = await this.db.query(
      'SELECT assigned_certificates FROM auditor WHERE id = $1',
      [id],
    );
    const currentAssigned: string[] =
      (currentRes.rows[0]?.assigned_certificates as string[]) || [];
    const notAssigned = matchedIds.filter((m) => !currentAssigned.includes(m));
    if (notAssigned.length > 0) {
      throw new Error(`Certificates not assigned: ${notAssigned.join(',')}`);
    }

    const query = `
      UPDATE auditor
      SET assigned_certificates = (
          SELECT array_agg(elem)
          FROM unnest(COALESCE(assigned_certificates, ARRAY[]::TEXT[])) AS elem
          WHERE elem <> ALL($2::TEXT[])
        ),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [id, matchedIds]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async addAssignedAssessment(
    auditorId: string,
    assessmentId: string,
    certificateId: string,
    assignedByUserId?: string,
  ): Promise<void> {
    // Get comprehensive assessment data
    const { rows } = await this.db.query(
      `SELECT ca.id as assessment_id, ca.organization_id, ca.certificate_id, ca.status, ca.audit_date, ca.created_at
       FROM certificate_assessments ca
       WHERE ca.id = $1`,
      [assessmentId],
    );

    if (rows.length === 0) {
      throw new Error(`Assessment with ID ${assessmentId} not found`);
    }

    const assessmentData = rows[0];
    const assignmentData = {
      assessment_id: assessmentData.assessment_id,
      organization_id: assessmentData.organization_id,
      certificate_id: assessmentData.certificate_id,
      status: assessmentData.status,
      audit_date: assessmentData.audit_date,
      created_at: assessmentData.created_at,
      assigned_by: assignedByUserId || null,
    };

    await this.db.query(
      `UPDATE auditor
       SET assigned_assessments_json = COALESCE(assigned_assessments_json, '[]'::jsonb) || jsonb_build_array($2::jsonb),
       updated_at = NOW()
       WHERE id = $1`,
      [auditorId, JSON.stringify(assignmentData)],
    );
  }

  async removeAssignedAssessment(
    auditorId: string,
    assessmentId: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE auditor
       SET assigned_assessments_json = (
         SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(assigned_assessments_json, '[]'::jsonb)) AS item
         WHERE item->>'assessment_id' != $2
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [auditorId, assessmentId],
    );
  }

  async getAssignedAssessments(
    auditorId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{
    assessments: Record<string, unknown>[];
    total: number;
  }> {
    const { rows } = await this.db.query(
      `SELECT assigned_assessments_json FROM auditor WHERE id = $1`,
      [auditorId],
    );

    if (!rows[0]) {
      return { assessments: [], total: 0 };
    }

    let assignments = (rows[0].assigned_assessments_json || []) as Array<{
      assessment_id: string;
      organization_id: string;
      certificate_id: string;
      status: string;
      audit_date?: string;
      created_at: string;
      assigned_by: string | null;
    }>;

    // Filter by status before pagination
    if (status) {
      assignments = assignments.filter((a) => a.status === status);
    }

    const total = assignments.length;
    const offset = (page - 1) * limit;
    const paginated = assignments.slice(offset, offset + limit);

    if (paginated.length === 0) {
      return { assessments: [], total };
    }

    // Extract assessment IDs to enrich with full data from related tables
    const assessmentIds = paginated.map((a) => a.assessment_id);

    const { rows: enrichedRows } = await this.db.query(
      `SELECT
        ca.id,
        ca.organization_id,
        o.name AS organization_name,
        ca.certificate_id AS certificate_uuid,
        c.certificate_id AS certificate_identifier,
        c.name AS certificate_name,
        ca.status,
        ca.audit_date AS start_date,
        ca.completed_at AS end_date,
        ca.submitted_at,
        ca.created_at,
        ca.assigned_by
      FROM certificate_assessments ca
      LEFT JOIN organization o ON o.id = ca.organization_id
      LEFT JOIN certificates c ON c.id = ca.certificate_id
      WHERE ca.id = ANY($1::uuid[])`,
      [assessmentIds],
    );

    // Build a map for quick lookup and preserve pagination order
    const enrichedMap = new Map<string, Record<string, unknown>>();
    for (const row of enrichedRows) {
      enrichedMap.set(row.id, row);
    }

    const assessments = paginated.map((assignment) => {
      const enriched = enrichedMap.get(assignment.assessment_id);
      if (enriched) {
        return {
          id: enriched.id,
          organization_id: enriched.organization_id,
          organization_name: enriched.organization_name,
          certificate_id: enriched.certificate_identifier,
          certificate_uuid: enriched.certificate_uuid,
          certificate_name: enriched.certificate_name,
          status: enriched.status,
          start_date: enriched.start_date,
          end_date: enriched.end_date,
          submitted_at: enriched.submitted_at,
          created_at: enriched.created_at,
          assigned_by: enriched.assigned_by,
        };
      }
      // Fallback to denormalized data if enrichment fails
      return {
        id: assignment.assessment_id,
        organization_id: assignment.organization_id,
        certificate_id: assignment.certificate_id,
        status: assignment.status,
        start_date: assignment.audit_date,
        end_date: null,
        submitted_at: null,
        created_at: assignment.created_at,
        assigned_by: assignment.assigned_by,
      };
    });

    return { assessments, total };
  }

  async getDashboardStats(auditorUserId: string): Promise<{
    total_assigned: number;
    completed: number;
    in_progress: number;
    submitted: number;
    pending_invitations: number;
  }> {
    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)::int AS total_assigned,
         COUNT(*) FILTER (WHERE ca.status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE ca.status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE ca.status = 'submitted' OR ca.status = 'ai_reviewing')::int AS submitted
       FROM certificate_assessments ca
       WHERE ca.assigned_auditor_id = $1`,
      [auditorUserId],
    );

    const { rows: invRows } = await this.db.query(
      `SELECT COUNT(*)::int AS pending_invitations
       FROM assessment_invitations
       WHERE invited_user_id = $1 AND status = 'pending'`,
      [auditorUserId],
    );

    const stats = rows[0] as Record<string, number>;
    const invStats = invRows[0] as Record<string, number>;

    return {
      total_assigned: stats.total_assigned || 0,
      completed: stats.completed || 0,
      in_progress: stats.in_progress || 0,
      submitted: stats.submitted || 0,
      pending_invitations: invStats.pending_invitations || 0,
    };
  }

  async getUpcomingAudits(
    auditorUserId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS total
       FROM certificate_assessments ca
       WHERE ca.assigned_auditor_id = $1
         AND ca.status IN ('in_progress', 'submitted', 'ai_reviewing')
         AND ca.audit_date IS NOT NULL
         AND ca.audit_date >= date_trunc('day', NOW())`,
      [auditorUserId],
    );
    const total = (countResult.rows[0] as Record<string, number>).total || 0;

    const { rows } = await this.db.query(
      `SELECT
         ca.id AS assessment_id,
         ca.audit_date,
         ca.status,
         ca.organization_id,
         o.name AS organization_name,
         ca.certificate_id,
         c.certificate_id AS certificate_product_id,
         c.name AS certificate_name
       FROM certificate_assessments ca
       LEFT JOIN organization o ON o.id = ca.organization_id
       LEFT JOIN certificates c ON c.id = ca.certificate_id
       WHERE ca.assigned_auditor_id = $1
         AND ca.status IN ('in_progress', 'submitted', 'ai_reviewing')
         AND ca.audit_date IS NOT NULL
         AND ca.audit_date >= date_trunc('day', NOW())
       ORDER BY ca.audit_date ASC
       LIMIT $2 OFFSET $3`,
      [auditorUserId, limit, offset],
    );

    return {
      data: rows as Record<string, unknown>[],
      total,
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.db.query('DELETE FROM auditor WHERE id = $1', [id]);
    return true;
  }

  async getOrganizationUserIds(organizationId: string): Promise<string[]> {
    const result = (await this.db.query(
      `SELECT o.user_id AS id FROM organization o WHERE o.id = $1
       UNION
       SELECT e.user_id AS id FROM employee e WHERE e.organization_id = $1 AND e.status = 'active'`,
      [organizationId],
    )) as { rows: { id: string }[] };
    return result.rows.map((r) => r.id);
  }

  async getCertificateName(certificateId: string): Promise<string | null> {
    const result = (await this.db.query(
      `SELECT name FROM certificates WHERE id = $1`,
      [certificateId],
    )) as { rows: { name: string }[] };
    return result.rows[0]?.name || null;
  }
}
