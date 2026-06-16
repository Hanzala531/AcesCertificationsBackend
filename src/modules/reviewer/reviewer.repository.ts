import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ReviewerRepository {
  constructor(private db: DatabaseService) {}

  async create(
    userId: string,
    firstName: string,
    lastName: string,
    profilePicture?: string,
    tags?: string[],
    accountStatus?: boolean,
  ): Promise<Record<string, unknown>> {
    const query = `
      INSERT INTO reviewer (user_id, first_name, last_name, profile_picture, tags, accountStatus)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, first_name, last_name, profile_picture, tags, accountStatus, created_at, updated_at
    `;
    const params = [
      userId,
      firstName,
      lastName,
      profilePicture || null,
      tags || [],
      accountStatus !== undefined ? accountStatus : true,
    ];
    const { rows } = await this.db.query(query, params);
    return rows[0] as Record<string, unknown>;
  }

  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const query = `SELECT * FROM reviewer WHERE user_id = $1`;
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
    const query = `SELECT * FROM reviewer WHERE id = $1`;
    const { rows } = await this.db.query(query, [id]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async findAll(params?: { limit?: number; offset?: number }): Promise<{
    reviewers: Record<string, unknown>[];
    total: number;
  }> {
    const limit = params?.limit || 25;
    const offset = params?.offset || 0;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM reviewer r
      JOIN users u ON r.user_id = u.id
      WHERE u.is_deleted = FALSE
    `;
    const countResult = await this.db.query(countQuery);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const query = `
      SELECT 
        r.id,
        r.user_id,
        r.first_name,
        r.last_name,
        r.profile_picture,
        r.tags,
        COALESCE(r.accountstatus, true)::boolean AS "accountStatus",
        r.created_at,
        r.updated_at,
        u.email, 
        u.is_active, 
        u.is_verified, 
        u.last_login
      FROM reviewer r
      JOIN users u ON r.user_id = u.id
      WHERE u.is_deleted = FALSE
      ORDER BY r.created_at DESC
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
      reviewers: normalizedRows as Record<string, unknown>[],
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
      'tags',
      'accountStatus',
    ];
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const [k, v] of Object.entries(fields)) {
      if (!allowedFields.includes(k)) {
        throw new Error(`Invalid field: ${k}`);
      }
      parts.push(`${k} = $${i++}`);
      params.push(v);
    }

    if (!parts.length) return this.findById(id);
    params.push(id);
    const sql = `UPDATE reviewer SET ${parts.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
    const { rows } = await this.db.query(sql, params);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async addTags(
    id: string,
    tags: string[],
  ): Promise<Record<string, unknown> | null> {
    const query = `
      UPDATE reviewer 
      SET tags = (
          SELECT array_agg(DISTINCT elem)
          FROM unnest(
            COALESCE(tags, ARRAY[]::TEXT[]) || $2::TEXT[]
          ) AS elem
        ),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [id, tags]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async removeTags(
    id: string,
    tags: string[],
  ): Promise<Record<string, unknown> | null> {
    const query = `
      UPDATE reviewer 
      SET tags = (
          SELECT array_agg(elem)
          FROM unnest(COALESCE(tags, ARRAY[]::TEXT[])) AS elem
          WHERE elem <> ALL($2::TEXT[])
        ),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [id, tags]);
    return (rows[0] as Record<string, unknown>) ?? null;
  }

  async addAssignedAssessment(
    reviewerId: string,
    assessmentId: string,
    certificateId: string,
    assignedByUserId?: string,
  ): Promise<void> {
    // Get comprehensive assessment data
    const { rows } = await this.db.query(
      `SELECT ca.id as assessment_id, ca.organization_id, ca.certificate_id, ca.status, ca.created_at
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
      created_at: assessmentData.created_at,
      assigned_by: assignedByUserId || null,
    };

    await this.db.query(
      `UPDATE reviewer
       SET assigned_assessments_json = COALESCE(assigned_assessments_json, '[]'::jsonb) || jsonb_build_array($2::jsonb),
       updated_at = NOW()
       WHERE id = $1`,
      [reviewerId, JSON.stringify(assignmentData)],
    );
  }

  async removeAssignedAssessment(
    reviewerId: string,
    assessmentId: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE reviewer
       SET assigned_assessments_json = (
         SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(assigned_assessments_json, '[]'::jsonb)) AS item
         WHERE item->>'assessment_id' != $2
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [reviewerId, assessmentId],
    );
  }

  async getAssignedAssessments(
    reviewerId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    assessments: Record<string, unknown>[];
    total: number;
  }> {
    const { rows } = await this.db.query(
      `SELECT assigned_assessments_json FROM reviewer WHERE id = $1`,
      [reviewerId],
    );

    if (!rows[0]) {
      return { assessments: [], total: 0 };
    }

    const assignments = (rows[0].assigned_assessments_json || []) as Array<{
      assessment_id: string;
      organization_id: string;
      certificate_id: string;
      status: string;
      created_at: string;
      assigned_by: string | null;
    }>;

    const total = assignments.length;
    const offset = (page - 1) * limit;
    const paginated = assignments.slice(offset, offset + limit);

    // Return the comprehensive data directly from the JSON field
    const assessments = paginated.map((assignment) => ({
      id: assignment.assessment_id,
      organization_id: assignment.organization_id,
      certificate_id: assignment.certificate_id,
      status: assignment.status,
      created_at: assignment.created_at,
      assigned_by: assignment.assigned_by,
    }));

    return { assessments, total };
  }

  async findCertificateAssessments(
    reviewerUserId: string,
    page: number,
    limit: number,
    assessmentType?: string,
  ): Promise<{
    rows: Array<{
      id: string;
      organization_id: string;
      organization_name: string;
      branch_id: string | null;
      branch_name: string | null;
      certificate_id: string;
      certificate_name: string;
      product_id: string | null;
      total_ai_flags: number;
      is_certificate_blocked: boolean;
      has_issued_certificate: boolean;
      issued_cert_blocked: boolean;
      audit_lifecycle_status: string | null;
      assigned_auditor_id: string | null;
      assigned_date: string;
    }>;
    total: number;
  }> {
    const offset = (page - 1) * limit;

    const countParams: (string | number)[] = [reviewerUserId];
    let whereClause = 'WHERE ca.assigned_reviewer_id = $1';

    if (assessmentType) {
      countParams.push(assessmentType);
      whereClause += ` AND ca.assessment_type = $${countParams.length}`;
    }

    const countResult = await this.db.query(
      `SELECT COUNT(*) AS total
       FROM certificate_assessments ca
       ${whereClause}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const queryParams: (string | number)[] = [...countParams, limit, offset];
    const limitIdx = countParams.length + 1;
    const offsetIdx = countParams.length + 2;

    const { rows } = await this.db.query(
      `SELECT
         ca.id,
         ca.organization_id,
         o.name                          AS organization_name,
         ca.branch_id,
         b.name                          AS branch_name,
         ca.certificate_id,
         c.name                          AS certificate_name,
         c.certificate_id               AS product_id,
         COALESCE(ar.total_flags, 0)::int AS total_ai_flags,
         COALESCE(ca.is_certificate_blocked, false) AS is_certificate_blocked,
         CASE WHEN ic.id IS NOT NULL THEN true ELSE false END AS has_issued_certificate,
         COALESCE(ic.is_blocked, false)  AS issued_cert_blocked,
         aud.audit_lifecycle_status,
         ca.assigned_auditor_id,
         ca.updated_at                   AS assigned_date
       FROM certificate_assessments ca
       LEFT JOIN organization o  ON o.id  = ca.organization_id
       LEFT JOIN branches b      ON b.id  = ca.branch_id
       LEFT JOIN certificates c  ON c.id  = ca.certificate_id
       LEFT JOIN ai_reviews ar   ON ar.certificate_assessment_id = ca.id
       LEFT JOIN issued_certificates ic ON ic.assessment_id = ca.id
       LEFT JOIN audits aud      ON aud.assessment_id = ca.id AND aud.is_archived = false
       ${whereClause}
       ORDER BY ca.updated_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams,
    );

    return { rows, total };
  }

  async findReviewerAudits(
    reviewerUserId: string,
    computedStatusFilter?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    items: Array<{
      assessment_id: string;
      assessment_type: string;
      assessment_status: string;
      organization_name: string;
      certificate_name: string;
      audit_date: Date | null;
      audit_id: string | null;
      audit_lifecycle_status: string | null;
      audit_status: string | null;
      review_status: string | null;
      score: number | null;
      review_score: number | null;
      audit_created_at: Date | null;
      audit_updated_at: Date | null;
      computed_status: string;
      requested_reviewer_is_true: boolean;
      requested_reviewer_name: string | null;
      requested_reviewer_date: Date | null;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    const params: (string | number)[] = [reviewerUserId];
    let statusFilter = '';

    if (computedStatusFilter) {
      params.push(computedStatusFilter);
      statusFilter = 'WHERE computed_status = $2';
    }

    const baseCte = `WITH audit_data AS (
         SELECT
           ca.id                    AS assessment_id,
           ca.assessment_type,
           ca.status                AS assessment_status,
           o.name                   AS organization_name,
           c.name                   AS certificate_name,
           ca.audit_date,
           a.id                     AS audit_id,
           a.audit_lifecycle_status,
           a.status                 AS audit_status,
           a.review_status,
           a.score,
           a.review_score,
           a.created_at             AS audit_created_at,
           a.updated_at             AS audit_updated_at,
           CASE
             WHEN a.review_status = 'rejected' THEN 'rejected'
             WHEN a.status IS NOT NULL AND a.review_status IS NOT NULL THEN 'completed'
             WHEN a.status IS NOT NULL THEN 'submitted'
             WHEN a.audit_summary IS NOT NULL
               OR a.audit_description IS NOT NULL
               OR a.audit_summary_doc IS NOT NULL THEN 'in_progress'
             ELSE 'pending'
           END AS computed_status,
           CASE
             WHEN ca.assigned_auditor_id IS NOT NULL
              AND COALESCE(latest_inv.status, 'accepted') != 'declined'
             THEN true
             ELSE false
           END AS requested_reviewer_is_true,
           CASE
             WHEN latest_inv.invited_by IS NOT NULL
             THEN CONCAT_WS(' ', inv_u_profile.first_name, inv_u_profile.last_name)
             ELSE NULL
           END AS requested_reviewer_name,
           latest_inv.created_at AS requested_reviewer_date
         FROM audits a
         JOIN certificate_assessments ca ON ca.id = a.assessment_id
         JOIN certificates c ON c.id = ca.certificate_id
         JOIN organization o ON o.id = ca.organization_id
         LEFT JOIN LATERAL (
           SELECT ai.status, ai.invited_by, ai.created_at FROM assessment_invitations ai
           WHERE ai.assessment_id = ca.id
           ORDER BY ai.created_at DESC LIMIT 1
         ) latest_inv ON true
         LEFT JOIN reviewer inv_u_profile ON inv_u_profile.user_id = latest_inv.invited_by
         WHERE a.assigned_reviewer_id = $1
           AND a.is_archived = FALSE
       )`;

    const countResult = await this.db.query(
      `${baseCte}
       SELECT COUNT(*)::int AS total
       FROM audit_data
       ${statusFilter}`,
      params,
    );

    const total = countResult.rows[0]?.total ?? 0;
    const limitParamIndex = computedStatusFilter ? 3 : 2;
    const offsetParamIndex = computedStatusFilter ? 4 : 3;
    const dataParams = [...params, limit, offset];

    const result = await this.db.query(
      `${baseCte}
       SELECT * FROM audit_data
       ${statusFilter}
       ORDER BY audit_updated_at DESC
       LIMIT $${limitParamIndex}
       OFFSET $${offsetParamIndex}`,
      dataParams,
    );

    return {
      items: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDashboardAnalytics(reviewerUserId: string): Promise<{
    self_disclosure: {
      total_certificates: number;
      pending_review_ai_flags: number;
      completed: number;
    };
    assured: {
      total_certificates: number;
      sent_to_auditor: number;
      accepted_by_auditor: number;
      pending_reviews: number;
      clarifications_pending: number;
    };
  }> {
    const result = await this.db.query(
      `SELECT
         -- Self-Disclosure
         COUNT(*) FILTER (WHERE ca.assessment_type = 'self_disclosure')::int
           AS sd_total,
         COUNT(*) FILTER (WHERE ca.assessment_type = 'self_disclosure' AND COALESCE(ar.total_flags, 0) > 0 AND ca.status != 'completed')::int
           AS sd_pending_review,
         COUNT(*) FILTER (WHERE ca.assessment_type = 'self_disclosure' AND ca.status = 'completed')::int
           AS sd_completed,

         -- Assured
         COUNT(*) FILTER (WHERE ca.assessment_type = 'assured')::int
           AS as_total,
         COUNT(*) FILTER (WHERE ca.assessment_type = 'assured' AND ai_inv.status = 'pending')::int
           AS as_sent_to_auditor,
         COUNT(*) FILTER (WHERE ca.assessment_type = 'assured' AND ai_inv.status = 'accepted')::int
           AS as_accepted_by_auditor,
         COUNT(*) FILTER (WHERE ca.assessment_type = 'assured' AND aud.audit_lifecycle_status IN ('auditor_submitted'))::int
           AS as_pending_reviews,
         COUNT(DISTINCT clar.assessment_id) FILTER (WHERE ca.assessment_type = 'assured')::int
           AS as_clarifications_pending

       FROM certificate_assessments ca
       LEFT JOIN ai_reviews ar ON ar.certificate_assessment_id = ca.id
       LEFT JOIN assessment_invitations ai_inv ON ai_inv.assessment_id = ca.id
         AND ai_inv.status IN ('pending', 'accepted')
       LEFT JOIN audits aud ON aud.assessment_id = ca.id AND aud.is_archived = false
       LEFT JOIN compliance_actions clar ON clar.assessment_id = ca.id
         AND clar.action_type = 'request_clarification'
         AND clar.clarification_target = 'reviewer'
       WHERE ca.assigned_reviewer_id = $1`,
      [reviewerUserId],
    );

    const row = result.rows[0] || {};

    return {
      self_disclosure: {
        total_certificates: row.sd_total || 0,
        pending_review_ai_flags: row.sd_pending_review || 0,
        completed: row.sd_completed || 0,
      },
      assured: {
        total_certificates: row.as_total || 0,
        sent_to_auditor: row.as_sent_to_auditor || 0,
        accepted_by_auditor: row.as_accepted_by_auditor || 0,
        pending_reviews: row.as_pending_reviews || 0,
        clarifications_pending: row.as_clarifications_pending || 0,
      },
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.db.query('DELETE FROM reviewer WHERE id = $1', [id]);
    return true;
  }
}
