import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PoolClient } from 'pg';
import { QueryResult } from '../../common/types/database.types';
import { AssignedByRole } from '../../common/enums/assigned-by-role.enum';

export interface CertificateAssessment {
  id: string;
  organization_id: string;
  branch_id: string | null;
  certificate_id: string;
  payment_id: string;
  assessment_type: 'self_disclosure' | 'assured';
  badge_id: string | null;
  score: number | null;
  is_submitted: boolean;
  status:
    | 'in_progress'
    | 'submitted'
    | 'ai_reviewing'
    | 'completed'
    | 'expired'
    | 'improvement_requested';
  submitted_at: Date | null;
  completed_at: Date | null;
  assigned_auditor_id: string | null;
  assigned_reviewer_id: string | null;
  assigned_by: string | null;
  is_certificate_blocked?: boolean;
  certificate_block_reason?: string | null;
  audit_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AssessmentQuery {
  id: string;
  certificate_assessment_id: string;
  question_id: string;
  response_type: 'pdf' | 'boolean' | 'text' | 'number' | 'checkbox' | 'multiple_choice' | 'rating';
  response_value: string | null;
  response_files: string[] | null;
  reviewer_notes: string | null;
  auditor_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AssessmentWithDetails extends CertificateAssessment {
  certificate_name?: string;
  certificate_product_id?: string;
  organization_name?: string;
  branch_name?: string;
  badge_name?: string;
  badge_color?: string | null;
  total_questions?: number;
  answered_questions?: number;
}

export interface QuestionWithAnswer {
  id: string;
  question_text: string;
  hint: string | null;
  question_type: string;
  options: string[] | null;
  is_compulsory: boolean;
  rank: number;
  score: number;
  ai_review_enabled: boolean;
  ai_review_criteria: string | null;
  ai_review_score: number | null;
  yes_score: number | null;
  no_score: number | null;
  conditional_logic_enabled: boolean;
  conditional_logic: Record<string, unknown> | null;
  short_code: string | null;
  main_section_name: string;
  main_section_short_code: string | null;
  section_name: string | null;
  section_short_code: string | null;
  sub_section_name: string | null;
  sub_section_short_code: string | null;
  answer_id: string | null;
  response_type: string | null;
  response_value: string | null;
  response_files: string[] | null;
}

export interface ClarificationAction {
  id: string;
  question_id: string;
  question_text: string;
  question_short_code: string | null;
  message: string;
  created_by_role: string;
  created_at: Date;
}

export interface ReviewOverview {
  assessment_name: string;
  submitted_at: Date | null;
  audit_period_start: Date | null;
  audit_period_end: Date | null;
  issued_at: Date | null;
  valid_until: Date | null;
  actions_required: ClarificationAction[];
  auditor: {
    name: string;
    signature: string | null;
    purpose: 'requires_clarification' | null;
    notes: {
      audit_summary: string | null;
      audit_description: string | null;
      status: string | null;
      score: number | null;
    };
  } | null;
  reviewer: {
    name: string;
    signature: string | null;
    purpose: 'requires_clarification' | null;
    notes: {
      review_summary: string | null;
      review_description: string | null;
      review_status: string | null;
      review_score: number | null;
    };
  } | null;
}

export interface SubmittedQuestionSection {
  main_section_id: string;
  main_section_name: string;
  main_section_short_code: string | null;
  sections: Array<{
    section_id: string;
    section_name: string;
    section_short_code: string | null;
    sub_sections: Array<{
      sub_section_id: string | null;
      sub_section_name: string | null;
      sub_section_short_code: string | null;
      questions: Array<{
        question_id: string;
        question_text: string;
        question_short_code: string | null;
        question_type: string;
        hint: string | null;
        options: string[] | null;
        rank: number;
        answer_id: string | null;
        response_type: string | null;
        response_value: string | null;
        response_files: string[] | null;
      }>;
    }>;
  }>;
}

@Injectable()
export class AssessmentRepository {
  constructor(private readonly db: DatabaseService) {}

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

  async createAssessment(data: {
    organization_id: string;
    branch_id?: string;
    certificate_id: string;
    payment_id: string;
    assessment_type: 'self_disclosure' | 'assured';
    status?:
      | 'in_progress'
      | 'submitted'
      | 'ai_reviewing'
      | 'completed'
      | 'expired';
    completed_at?: Date | null;
    is_submitted?: boolean;
  }): Promise<CertificateAssessment> {
    const status = data.status || 'in_progress';
    const completedAt =
      data.completed_at !== undefined
        ? data.completed_at
        : status === 'completed'
          ? new Date()
          : null;
    const isSubmitted = data.is_submitted || false;

    const result = (await this.db.query(
      `INSERT INTO certificate_assessments
       (organization_id, branch_id, certificate_id, payment_id, assessment_type, status, completed_at, is_submitted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.organization_id,
        data.branch_id || null,
        data.certificate_id,
        data.payment_id,
        data.assessment_type,
        status,
        completedAt,
        isSubmitted,
      ],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async findAssessmentById(id: string): Promise<CertificateAssessment | null> {
    const result = (await this.db.query(
      `SELECT * FROM certificate_assessments WHERE id = $1`,
      [id],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0] || null;
  }

  async findAssessmentWithDetails(
    id: string,
  ): Promise<AssessmentWithDetails | null> {
    const result = (await this.db.query(
      `SELECT
         ca.id,
         ca.organization_id,
         ca.branch_id,
         ca.certificate_id,
         ca.payment_id,
         ca.assessment_type,
         COALESCE(ca.badge_id, ic.badge_id) AS badge_id,
         ca.is_certificate_blocked,
         ca.certificate_block_reason,
         ca.is_submitted,
         CASE
           WHEN ca.status IN ('submitted', 'ai_reviewing')
             AND ar.review_status = 'completed'
             AND COALESCE(ca.score, ic.review_score, ar.score, au.review_score, au.score) IS NOT NULL
           THEN 'completed'
           ELSE ca.status
         END as status,
         ca.submitted_at,
         CASE
           WHEN ca.completed_at IS NOT NULL THEN ca.completed_at
           WHEN ca.status IN ('submitted', 'ai_reviewing')
             AND ar.review_status = 'completed'
           THEN ar.completed_at
           ELSE ca.completed_at
         END as completed_at,
         ca.audit_date,
         ca.created_at,
         ca.updated_at,
         COALESCE(ca.score, ic.review_score, ar.score, au.review_score, au.score) AS score,
         c.name as certificate_name,
         c.certificate_id as certificate_product_id,
         o.name as organization_name,
         b.name as branch_name,
         COALESCE(bg.name, ic.badge_name) as badge_name,
         bg.slot as badge_slot,
         COALESCE(
           ic.badge_color,
           (
             SELECT bc.color
             FROM badge_colors bc
             WHERE bc.badge_id = COALESCE(ca.badge_id, ic.badge_id)
               AND COALESCE(ca.score, ic.review_score, ar.score, au.review_score, au.score) >= bc.min_score
               AND COALESCE(ca.score, ic.review_score, ar.score, au.review_score, au.score) <= bc.max_score
             LIMIT 1
           )
         ) as badge_color,
         (SELECT COUNT(*) FROM questions q WHERE q.certificate_id = ca.certificate_id) as total_questions,
         (SELECT COUNT(*) FROM assessment_queries aq WHERE aq.certificate_assessment_id = ca.id) as answered_questions
       FROM certificate_assessments ca
       LEFT JOIN certificates c ON c.id = ca.certificate_id
       LEFT JOIN organization o ON o.id = ca.organization_id
       LEFT JOIN branches b ON b.id = ca.branch_id
       LEFT JOIN issued_certificates ic ON ic.assessment_id = ca.id AND ic.is_blocked = FALSE
       LEFT JOIN audits au ON au.assessment_id = ca.id AND au.is_archived = FALSE
       LEFT JOIN badges bg ON bg.id = COALESCE(ca.badge_id, ic.badge_id)
       LEFT JOIN LATERAL (
         SELECT *
         FROM ai_reviews
         WHERE certificate_assessment_id = ca.id
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 1
       ) ar ON TRUE
       WHERE ca.id = $1`,
      [id],
    )) as QueryResult<AssessmentWithDetails>;
    return result.rows[0] || null;
  }

  async findAssessmentsByOrganization(
    organizationId: string,
    params: { page: number; limit: number; branchId?: string },
  ): Promise<{
    data: AssessmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;
    const countParams: (string | number)[] = [organizationId];
    let whereClause = 'WHERE ca.organization_id = $1';

    if (params.branchId) {
      countParams.push(params.branchId);
      whereClause += ` AND ca.branch_id = $${countParams.length}`;
    }

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM certificate_assessments ca ${whereClause}`,
      countParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    // Build separate queryParams for the SELECT statement
    const queryParams: (string | number)[] = [organizationId];
    let paramIndex = 2;

    if (params.branchId) {
      queryParams.push(params.branchId);
      paramIndex++;
    }

    queryParams.push(params.limit, offset);
    const result = (await this.db.query(
      `SELECT
         ca.id,
         ca.organization_id,
         ca.branch_id,
         ca.certificate_id,
         ca.payment_id,
         ca.assessment_type,
         ca.badge_id,
         ca.is_certificate_blocked,
         ca.certificate_block_reason,
         ca.is_submitted,
         ca.status,
         ca.submitted_at,
         ca.completed_at,
         ca.audit_date,
         ca.created_at,
         ca.updated_at,
         ar.score,
         c.name as certificate_name,
         c.certificate_id as certificate_product_id,
         bg.name as badge_name,
         (SELECT bc.color FROM badge_colors bc WHERE bc.badge_id = bg.id AND ar.score >= bc.min_score AND ar.score <= bc.max_score LIMIT 1) as badge_color,
         (SELECT COUNT(*) FROM questions q WHERE q.certificate_id = ca.certificate_id) as total_questions,
         (SELECT COUNT(*) FROM assessment_queries aq WHERE aq.certificate_assessment_id = ca.id) as answered_questions
       FROM certificate_assessments ca
       LEFT JOIN certificates c ON c.id = ca.certificate_id
       LEFT JOIN badges bg ON bg.id = ca.badge_id
       LEFT JOIN ai_reviews ar ON ar.certificate_assessment_id = ca.id
       ${whereClause}
       ORDER BY ca.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams,
    )) as QueryResult<AssessmentWithDetails>;

    return {
      data: result.rows,
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findAssessmentsByReviewer(
    reviewerUserId: string,
    params: {
      page: number;
      limit: number;
      status?: string;
      assignedByRole?: string;
      assessmentType?: string;
    },
  ): Promise<{
    data: AssessmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;
    const countParams: (string | number)[] = [reviewerUserId];
    let whereClause = 'WHERE ca.assigned_reviewer_id = $1';

    if (params.status) {
      countParams.push(params.status);
      whereClause += ` AND ca.status = $${countParams.length}`;
    }

    if (params.assignedByRole) {
      if (params.assignedByRole === 'admin') {
        // Match both admin and subadmin roles
        whereClause += ` AND u.role IN ('admin', 'subadmin')`;
      } else if (params.assignedByRole === 'reviewer') {
        // Match only reviewer role
        whereClause += ` AND u.role = 'reviewer'`;
      }
    }

    if (params.assessmentType) {
      countParams.push(params.assessmentType);
      whereClause += ` AND ca.assessment_type = $${countParams.length}`;
    }

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM certificate_assessments ca LEFT JOIN users u ON ca.assigned_by = u.id ${whereClause}`,
      countParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    // Build separate queryParams for the SELECT statement
    const queryParams: (string | number)[] = [reviewerUserId];
    let paramIndex = 1;

    if (params.status) {
      queryParams.push(params.status);
      paramIndex++;
    }

    if (params.assessmentType) {
      queryParams.push(params.assessmentType);
      paramIndex++;
    }

    // Add limit and offset to queryParams and get their indices
    const limitIndex = paramIndex + 1;
    const offsetIndex = paramIndex + 2;
    queryParams.push(params.limit, offset);

    const result = (await this.db.query(
      `SELECT
         ca.id,
         ca.organization_id,
         ca.branch_id,
         ca.certificate_id,
         ca.payment_id,
         ca.assessment_type,
         ca.badge_id,
         ca.is_certificate_blocked,
         ca.certificate_block_reason,
         ca.is_submitted,
         ca.status,
         ca.submitted_at,
         ca.completed_at,
         ca.assigned_by,
         ca.audit_date,
         ca.created_at,
         ca.updated_at,
         ar.score,
         c.name as certificate_name,
         o.name as organization_name,
         b.name as branch_name,
         bg.name as badge_name,
         (SELECT bc.color FROM badge_colors bc WHERE bc.badge_id = bg.id AND ar.score >= bc.min_score AND ar.score <= bc.max_score LIMIT 1) as badge_color,
         (SELECT COUNT(*) FROM questions q WHERE q.certificate_id = ca.certificate_id) as total_questions,
         (SELECT COUNT(*) FROM assessment_queries aq WHERE aq.certificate_assessment_id = ca.id) as answered_questions
       FROM certificate_assessments ca
       LEFT JOIN certificates c ON c.id = ca.certificate_id
       LEFT JOIN organization o ON o.id = ca.organization_id
       LEFT JOIN branches b ON b.id = ca.branch_id
       LEFT JOIN badges bg ON bg.id = ca.badge_id
       LEFT JOIN ai_reviews ar ON ar.certificate_assessment_id = ca.id
       LEFT JOIN users u ON ca.assigned_by = u.id
       ${whereClause}
       ORDER BY ca.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      queryParams,
    )) as QueryResult<AssessmentWithDetails>;

    return {
      data: result.rows,
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findAssessmentsByAuditor(
    auditorUserId: string,
    params: {
      page: number;
      limit: number;
      status?: string;
      assignedByRole?: AssignedByRole;
    },
  ): Promise<{
    data: AssessmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;
    const countParams: (string | number)[] = [auditorUserId];
    let whereClause = 'WHERE ca.assigned_auditor_id = $1';

    if (params.status) {
      countParams.push(params.status);
      whereClause += ` AND ca.status = $${countParams.length}`;
    }

    if (params.assignedByRole) {
      if ((params.assignedByRole as string) === 'admin') {
        // Match both admin and subadmin roles
        whereClause += ` AND u.role IN ('admin', 'subadmin')`;
      } else if ((params.assignedByRole as string) === 'reviewer') {
        // Match only reviewer role
        whereClause += ` AND u.role = 'reviewer'`;
      }
    }

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM certificate_assessments ca LEFT JOIN users u ON ca.assigned_by = u.id ${whereClause}`,
      countParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    // Build separate queryParams for the SELECT statement
    const queryParams: (string | number)[] = [auditorUserId];
    let paramIndex = 1;

    if (params.status) {
      queryParams.push(params.status);
      paramIndex++;
    }

    // Add limit and offset to queryParams and get their indices
    const limitIndex = paramIndex + 1;
    const offsetIndex = paramIndex + 2;
    queryParams.push(params.limit, offset);

    const result = (await this.db.query(
      `SELECT
         ca.id,
         ca.organization_id,
         ca.branch_id,
         ca.certificate_id,
         ca.payment_id,
         ca.assessment_type,
         ca.badge_id,
         ca.is_certificate_blocked,
         ca.certificate_block_reason,
         ca.is_submitted,
         ca.status,
         ca.submitted_at,
         ca.completed_at,
         ca.assigned_by,
         ca.audit_date,
         ca.created_at,
         ca.updated_at,
         ar.score,
         c.name as certificate_name,
         o.name as organization_name,
         b.name as branch_name,
         bg.name as badge_name,
         (SELECT bc.color FROM badge_colors bc WHERE bc.badge_id = bg.id AND ar.score >= bc.min_score AND ar.score <= bc.max_score LIMIT 1) as badge_color,
         (SELECT COUNT(*) FROM questions q WHERE q.certificate_id = ca.certificate_id) as total_questions,
         (SELECT COUNT(*) FROM assessment_queries aq WHERE aq.certificate_assessment_id = ca.id) as answered_questions
       FROM certificate_assessments ca
       LEFT JOIN certificates c ON c.id = ca.certificate_id
       LEFT JOIN organization o ON o.id = ca.organization_id
       LEFT JOIN branches b ON b.id = ca.branch_id
       LEFT JOIN badges bg ON bg.id = ca.badge_id
       LEFT JOIN ai_reviews ar ON ar.certificate_assessment_id = ca.id
       LEFT JOIN users u ON ca.assigned_by = u.id
       ${whereClause}
       ORDER BY ca.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      queryParams,
    )) as QueryResult<AssessmentWithDetails>;

    return {
      data: result.rows,
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findPendingAssessmentsByOrganization(
    organizationId: string,
    params: { page: number; limit: number; branchId?: string },
  ): Promise<{
    data: AssessmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;
    const countParams: (string | number)[] = [organizationId];
    let whereClause =
      "WHERE ca.organization_id = $1 AND ca.status IN ('in_progress', 'submitted', 'ai_reviewing')";

    if (params.branchId) {
      countParams.push(params.branchId);
      whereClause += ` AND ca.branch_id = $${countParams.length}`;
    }

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM certificate_assessments ca ${whereClause}`,
      countParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    // Build separate queryParams for the SELECT statement
    const queryParams: (string | number)[] = [organizationId];
    let paramIndex = 2;

    if (params.branchId) {
      queryParams.push(params.branchId);
      paramIndex++;
    }

    queryParams.push(params.limit, offset);
    const result = (await this.db.query(
      `SELECT
         ca.id,
         ca.organization_id,
         ca.branch_id,
         ca.certificate_id,
         ca.payment_id,
         ca.assessment_type,
         ca.badge_id,
         ca.is_certificate_blocked,
         ca.certificate_block_reason,
         ca.is_submitted,
         ca.status,
         ca.submitted_at,
         ca.completed_at,
         ca.audit_date,
         ca.created_at,
         ca.updated_at,
         ar.score,
         c.name as certificate_name,
         c.certificate_id as certificate_product_id,
         bg.name as badge_name,
         (SELECT bc.color FROM badge_colors bc WHERE bc.badge_id = bg.id AND ar.score >= bc.min_score AND ar.score <= bc.max_score LIMIT 1) as badge_color,
         (SELECT COUNT(*) FROM questions q WHERE q.certificate_id = ca.certificate_id) as total_questions,
         (SELECT COUNT(*) FROM assessment_queries aq WHERE aq.certificate_assessment_id = ca.id) as answered_questions
       FROM certificate_assessments ca
       LEFT JOIN certificates c ON c.id = ca.certificate_id
       LEFT JOIN badges bg ON bg.id = ca.badge_id
       LEFT JOIN ai_reviews ar ON ar.certificate_assessment_id = ca.id
       ${whereClause}
       ORDER BY ca.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams,
    )) as QueryResult<AssessmentWithDetails>;

    return {
      data: result.rows,
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async saveAnswer(data: {
    certificate_assessment_id: string;
    question_id: string;
    response_type: 'pdf' | 'boolean' | 'text' | 'number' | 'checkbox' | 'multiple_choice' | 'rating';
    response_value?: string;
  }): Promise<AssessmentQuery> {
    const result = (await this.db.query(
      `INSERT INTO assessment_queries
       (certificate_assessment_id, question_id, response_type, response_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (certificate_assessment_id, question_id)
       DO UPDATE SET
         response_type = EXCLUDED.response_type,
         response_value = EXCLUDED.response_value,
         updated_at = NOW()
       RETURNING *`,
      [
        data.certificate_assessment_id,
        data.question_id,
        data.response_type,
        data.response_value || null,
      ],
    )) as QueryResult<AssessmentQuery>;
    return result.rows[0];
  }

  async findAnswerById(id: string): Promise<AssessmentQuery | null> {
    const result = (await this.db.query(
      `SELECT * FROM assessment_queries WHERE id = $1`,
      [id],
    )) as QueryResult<AssessmentQuery>;
    return result.rows[0] || null;
  }

  async updateAnswer(
    id: string,
    data: {
      response_type: 'pdf' | 'boolean' | 'text' | 'number' | 'checkbox' | 'multiple_choice' | 'rating';
      response_value?: string;
      response_files?: string[] | null;
    },
  ): Promise<AssessmentQuery> {
    const result = (await this.db.query(
      `UPDATE assessment_queries
       SET response_type = $2, response_value = $3, response_files = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.response_type,
        data.response_value || null,
        data.response_files ? JSON.stringify(data.response_files) : null,
      ],
    )) as QueryResult<AssessmentQuery>;
    return result.rows[0];
  }

  async updateAnswerResponseValue(
    id: string,
    responseValue: string,
  ): Promise<AssessmentQuery> {
    const result = (await this.db.query(
      `UPDATE assessment_queries
       SET response_value = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, responseValue],
    )) as QueryResult<AssessmentQuery>;
    return result.rows[0];
  }

  async submitAssessment(id: string): Promise<CertificateAssessment> {
    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET is_submitted = TRUE,
           status = 'submitted',
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async submitAndSetStatus(
    id: string,
    status: 'ai_reviewing' | 'submitted',
  ): Promise<CertificateAssessment> {
    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET is_submitted = TRUE,
           status = $2,
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async revertAssessmentSubmission(id: string): Promise<CertificateAssessment> {
    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET is_submitted = FALSE,
           status = 'in_progress',
           submitted_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async updateAssessmentStatus(
    id: string,
    status:
      | 'in_progress'
      | 'submitted'
      | 'ai_reviewing'
      | 'completed'
      | 'expired'
      | 'improvement_requested',
  ): Promise<CertificateAssessment> {
    let extraFields = '';
    if (status === 'completed') {
      extraFields = ', completed_at = NOW()';
    }

    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET status = $2${extraFields}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async updateAssessmentBadge(
    id: string,
    badgeId?: string,
  ): Promise<CertificateAssessment> {
    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET badge_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, badgeId || null],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async updateAssessmentScore(
    id: string,
    score: number,
    summary?: {
      earned_score?: number | null;
      max_score?: number | null;
      final_percentage?: number | null;
    },
  ): Promise<CertificateAssessment> {
    const setClauses = ['score = $2', 'updated_at = NOW()'];
    const params: Array<string | number | null> = [id, score];

    if (summary) {
      params.push(summary.earned_score ?? null);
      setClauses.push(`earned_score = $${params.length}`);

      params.push(summary.max_score ?? null);
      setClauses.push(`max_score = $${params.length}`);

      params.push(summary.final_percentage ?? null);
      setClauses.push(`final_percentage = $${params.length}`);
    }

    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params,
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async getQuestionsWithAnswers(
    assessmentId: string,
    certificateId: string,
  ): Promise<QuestionWithAnswer[]> {
    const result = (await this.db.query(
      `SELECT
         q.id,
         q.question as question_text,
         q.hint,
         q.type as question_type,
         q.options,
         q.certificate_question_number,
         q.question_number,
         q.is_third_level,
         q.section_id,
         q.sub_section_id,
         q.main_section_id,
         q.is_compulsory,
         q.rank,
         q.score,
         q.ai_review_enabled,
         q.ai_review_criteria,
         q.ai_review_score,
         q.yes_score,
         q.no_score,
         q.conditional_logic_enabled,
         q.conditional_logic,
         q.short_code,
         ms.name as main_section_name,
         ms.short_code as main_section_short_code,
         s.name as section_name,
         s.short_code as section_short_code,
         ss.name as sub_section_name,
         ss.short_code as sub_section_short_code,
         aq.id as answer_id,
         aq.response_type,
         aq.response_value,
         aq.response_files
       FROM questions q
       LEFT JOIN main_section ms ON ms.id = q.main_section_id
       LEFT JOIN sections s ON s.id = q.section_id
       LEFT JOIN sub_section ss ON ss.id = q.sub_section_id
       LEFT JOIN assessment_queries aq ON aq.question_id = q.id AND aq.certificate_assessment_id = $1
       WHERE q.certificate_id = $2
       ORDER BY ms.rank NULLS LAST, s.rank NULLS LAST, ss.rank NULLS LAST,
                q.rank NULLS LAST, q.certificate_question_number NULLS LAST, q.id`,
      [assessmentId, certificateId],
    )) as QueryResult<QuestionWithAnswer>;
    return result.rows;
  }

  async getAssessmentReviewOverview(
    assessmentId: string,
  ): Promise<ReviewOverview> {
    type HeaderRow = {
      submitted_at: Date | null;
      assessment_created_at: Date | null;
      certificate_issued_at: Date | null;
      certificate_expiry: Date | null;
      assessment_name: string;
      auditor_first_name: string | null;
      auditor_last_name: string | null;
      auditor_signature: string | null;
      reviewer_first_name: string | null;
      reviewer_last_name: string | null;
      reviewer_signature: string | null;
      audit_summary: string | null;
      audit_description: string | null;
      audit_status: string | null;
      score: number | null;
      review_summary: string | null;
      review_description: string | null;
      review_status: string | null;
      review_score: number | null;
    };

    const [headerResult, clarificationsResult] = await Promise.all([
      this.db.query(
        `SELECT
           ca.submitted_at,
           ca.created_at           AS assessment_created_at,
           ic.issued_at            AS certificate_issued_at,
           ic.expiry_date          AS certificate_expiry,
           c.name                  AS assessment_name,
           aud.first_name          AS auditor_first_name,
           aud.last_name           AS auditor_last_name,
           aud.signature           AS auditor_signature,
           rev.first_name          AS reviewer_first_name,
           rev.last_name           AS reviewer_last_name,
           rev.signature           AS reviewer_signature,
           au.audit_summary,
           au.audit_description,
           au.status               AS audit_status,
           au.score,
           au.review_summary,
           au.review_description,
           au.review_status,
           au.review_score
         FROM certificate_assessments ca
         JOIN certificates c        ON c.id  = ca.certificate_id
         LEFT JOIN auditor aud      ON aud.user_id = ca.assigned_auditor_id
         LEFT JOIN reviewer rev     ON rev.user_id = ca.assigned_reviewer_id
         LEFT JOIN audits au        ON au.assessment_id = ca.id AND au.is_archived = FALSE
         LEFT JOIN issued_certificates ic ON ic.assessment_id = ca.id
         WHERE ca.id = $1`,
        [assessmentId],
      ) as Promise<QueryResult<HeaderRow>>,
      this.db.query(
        // Applicants only see clarifications directed AT them.
        // Auditor → reviewer clarifications stay between auditor and reviewer
        // (clarification_target = 'reviewer') and must NOT surface here.
        `SELECT
           ca.id,
           ca.question_id,
           q.question AS question_text,
           q.short_code AS question_short_code,
           ca.message,
           ca.created_by_role,
           ca.created_at
         FROM compliance_actions ca
         JOIN questions q ON q.id = ca.question_id
         WHERE ca.assessment_id = $1
           AND ca.action_type = 'request_clarification'
           AND (
             ca.clarification_target = 'applicant'
             -- Tolerate legacy rows written before clarification_target existed:
             -- treat reviewer-authored clarifications as applicant-targeted by default.
             OR (ca.clarification_target IS NULL AND ca.created_by_role = 'reviewer')
           )
         ORDER BY ca.created_at DESC`,
        [assessmentId],
      ) as Promise<QueryResult<ClarificationAction>>,
    ]);

    const header = headerResult.rows[0];
    const clarifications = clarificationsResult.rows;

    const auditorHasClarification = clarifications.some(
      (c) => c.created_by_role === 'auditor',
    );
    const reviewerHasClarification = clarifications.some(
      (c) => c.created_by_role === 'reviewer',
    );

    const auditorName =
      header?.auditor_first_name != null
        ? `${header.auditor_first_name} ${header.auditor_last_name ?? ''}`.trim()
        : null;

    const reviewerName =
      header?.reviewer_first_name != null
        ? `${header.reviewer_first_name} ${header.reviewer_last_name ?? ''}`.trim()
        : null;

    return {
      assessment_name: header?.assessment_name ?? '',
      submitted_at: header?.submitted_at ?? null,
      // Audit & Review Period: from when the assured assessment was created up to
      // the certificate's issuance. Valid Until / issued date come from the
      // issued certificate when one exists.
      audit_period_start: header?.assessment_created_at ?? null,
      audit_period_end: header?.certificate_issued_at ?? null,
      issued_at: header?.certificate_issued_at ?? null,
      valid_until: header?.certificate_expiry ?? null,
      actions_required: clarifications,
      auditor: auditorName
        ? {
            name: auditorName,
            signature: header.auditor_signature ?? null,
            purpose: auditorHasClarification ? 'requires_clarification' : null,
            notes: {
              audit_summary: header.audit_summary,
              audit_description: header.audit_description,
              status: header.audit_status,
              score: header.score,
            },
          }
        : null,
      reviewer: reviewerName
        ? {
            name: reviewerName,
            signature: header.reviewer_signature ?? null,
            purpose: reviewerHasClarification ? 'requires_clarification' : null,
            notes: {
              review_summary: header.review_summary,
              review_description: header.review_description,
              review_status: header.review_status,
              review_score: header.review_score,
            },
          }
        : null,
    };
  }

  async getSubmittedQuestionsView(
    assessmentId: string,
    certificateId: string,
  ): Promise<SubmittedQuestionSection[]> {
    const result = (await this.db.query(
      `SELECT
         ms.id   AS main_section_id,
         ms.name AS main_section_name,
         ms.short_code AS main_section_short_code,
         COALESCE(ms.rank, 0) AS main_section_rank,
         s.id    AS section_id,
         s.name  AS section_name,
         s.short_code AS section_short_code,
         COALESCE(s.rank, 0) AS section_rank,
         ss.id   AS sub_section_id,
         ss.name AS sub_section_name,
         ss.short_code AS sub_section_short_code,
         COALESCE(ss.rank, 0) AS sub_section_rank,
         q.id    AS question_id,
         q.question AS question_text,
         q.short_code AS question_short_code,
         q.type  AS question_type,
         q.hint,
         q.options,
         COALESCE(q.rank, 0) AS question_rank,
         aq.id   AS answer_id,
         aq.response_type,
         aq.response_value,
         aq.response_files
       FROM questions q
       JOIN main_section ms ON ms.id = q.main_section_id
       JOIN sections s ON s.id = q.section_id
       LEFT JOIN sub_section ss ON ss.id = q.sub_section_id
       LEFT JOIN assessment_queries aq
         ON aq.question_id = q.id
        AND aq.certificate_assessment_id = $1
       WHERE q.certificate_id = $2
       ORDER BY
         COALESCE(ms.rank, 0),
         COALESCE(s.rank, 0),
         COALESCE(ss.rank, 0),
         COALESCE(q.rank, 0),
         q.certificate_question_number NULLS LAST,
         q.id`,
      [assessmentId, certificateId],
    )) as QueryResult<{
      main_section_id: string;
      main_section_name: string;
      main_section_short_code: string | null;
      main_section_rank: number;
      section_id: string;
      section_name: string;
      section_short_code: string | null;
      section_rank: number;
      sub_section_id: string | null;
      sub_section_name: string | null;
      sub_section_short_code: string | null;
      sub_section_rank: number;
      question_id: string;
      question_text: string;
      question_short_code: string | null;
      question_type: string;
      hint: string | null;
      options: string[] | null;
      question_rank: number;
      answer_id: string | null;
      response_type: string | null;
      response_value: string | null;
      response_files: string[] | null;
    }>;

    // Group flat rows into nested structure
    const mainSectionsMap = new Map<string, SubmittedQuestionSection>();

    for (const row of result.rows) {
      if (!mainSectionsMap.has(row.main_section_id)) {
        mainSectionsMap.set(row.main_section_id, {
          main_section_id: row.main_section_id,
          main_section_name: row.main_section_name,
          main_section_short_code: row.main_section_short_code,
          sections: [],
        });
      }
      const mainSection = mainSectionsMap.get(row.main_section_id)!;

      let section = mainSection.sections.find(
        (s) => s.section_id === row.section_id,
      );
      if (!section) {
        section = {
          section_id: row.section_id,
          section_name: row.section_name,
          section_short_code: row.section_short_code,
          sub_sections: [],
        };
        mainSection.sections.push(section);
      }

      const subKey = row.sub_section_id ?? '__none__';
      let subSection = section.sub_sections.find(
        (ss) =>
          (ss.sub_section_id ?? '__none__') === subKey,
      );
      if (!subSection) {
        subSection = {
          sub_section_id: row.sub_section_id,
          sub_section_name: row.sub_section_name,
          sub_section_short_code: row.sub_section_short_code,
          questions: [],
        };
        section.sub_sections.push(subSection);
      }

      subSection.questions.push({
        question_id: row.question_id,
        question_text: row.question_text,
        question_short_code: row.question_short_code,
        question_type: row.question_type,
        hint: row.hint,
        options: row.options,
        rank: row.question_rank,
        answer_id: row.answer_id,
        response_type: row.response_type,
        response_value: row.response_value,
        response_files: row.response_files,
      });
    }

    return Array.from(mainSectionsMap.values());
  }

  async getAssessmentAnswers(assessmentId: string): Promise<AssessmentQuery[]> {
    const result = (await this.db.query(
      `SELECT * FROM assessment_queries WHERE certificate_assessment_id = $1`,
      [assessmentId],
    )) as QueryResult<AssessmentQuery>;
    return result.rows;
  }

  async findExistingAssessment(
    organizationId: string,
    certificateId: string,
    paymentId: string,
  ): Promise<CertificateAssessment | null> {
    const result = (await this.db.query(
      `SELECT * FROM certificate_assessments
       WHERE organization_id = $1 AND certificate_id = $2 AND payment_id = $3
       LIMIT 1`,
      [organizationId, certificateId, paymentId],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0] || null;
  }

  async findCompletedSelfDisclosureAssessment(
    organizationId: string,
    certificateId: string,
  ): Promise<CertificateAssessment | null> {
    const result = (await this.db.query(
      `SELECT ca.*
       FROM certificate_assessments ca
       LEFT JOIN LATERAL (
         SELECT review_status, score, completed_at
         FROM ai_reviews
         WHERE certificate_assessment_id = ca.id
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 1
       ) ar ON TRUE
       WHERE ca.organization_id = $1 
         AND ca.certificate_id = $2 
         AND ca.assessment_type = 'self_disclosure'
         AND (
           ca.status = 'completed'
           OR (
             ca.status IN ('submitted', 'ai_reviewing')
             AND ar.review_status = 'completed'
             AND COALESCE(ca.score, ar.score) IS NOT NULL
           )
         )
       ORDER BY COALESCE(ca.completed_at, ar.completed_at) DESC NULLS LAST
       LIMIT 1`,
      [organizationId, certificateId],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0] || null;
  }

  async findCompletedAssessmentByOrganizationCertificateAndType(
    organizationId: string,
    certificateId: string,
    assessmentType: 'self_disclosure' | 'assured',
    branchId?: string | null,
  ): Promise<CertificateAssessment | null> {
    let query = `SELECT * FROM certificate_assessments
       WHERE organization_id = $1
         AND certificate_id = $2
         AND assessment_type = $3
         AND status = 'completed'`;

    const params: (string | null)[] = [
      organizationId,
      certificateId,
      assessmentType,
    ];

    if (branchId !== undefined) {
      if (branchId === null) {
        query += ` AND branch_id IS NULL`;
      } else {
        query += ` AND branch_id = $4`;
        params.push(branchId);
      }
    }

    query += ` ORDER BY completed_at DESC LIMIT 1`;

    const result = (await this.db.query(
      query,
      params,
    )) as QueryResult<CertificateAssessment>;

    return result.rows[0] || null;
  }

  async findBranchByIdAndOrganization(
    branchId: string,
    organizationId: string,
  ): Promise<{ id: string } | null> {
    const result = (await this.db.query(
      `SELECT id
       FROM branches
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [branchId, organizationId],
    )) as QueryResult<{ id: string }>;

    return result.rows[0] || null;
  }

  async getBadgeForScore(
    certificateId: string,
    score: number,
    assessmentType?: string,
    organizationId?: string,
  ): Promise<{ id: string; name: string } | null> {
    if (assessmentType === 'assured' && organizationId) {
      // Determine which assured slot based on self-disclosure badge tier
      const assuredSlot = await this.getAssuredSlotForOrg(
        certificateId,
        organizationId,
      );

      // No self-disclosure badge → not qualified for assured badge
      if (assuredSlot === null) {
        return null;
      }

      // Eligibility ladder by self-disclosure tier:
      //   - Bronze disclosure → slot 2 only
      //   - Silver/Gold/Emerald disclosure → slot 3 (preferred) with slot 2 fallback
      // The score determines the actual award within those eligible slots.
      const eligibleSlots = assuredSlot === 3 ? [3, 2] : [assuredSlot];

      for (const slot of eligibleSlots) {
        const result = (await this.db.query(
          `SELECT b.id, b.name
           FROM badges b
           JOIN badge_colors bc ON bc.badge_id = b.id
           WHERE b.certificate_id = $1
             AND $2::numeric >= bc.min_score
             AND $2::numeric <= bc.max_score
             AND b.slot = $3
           LIMIT 1`,
          [certificateId, score, slot],
        )) as QueryResult<{ id: string; name: string }>;
        if (result.rows[0]) return result.rows[0];
      }
      return null;
    }

    // Self-disclosure can only earn the slot 1 badge (ACES Rated) with
    // different colors/ranges. Assured fallback remains limited to slots 2-3.
    const result = (await this.db.query(
      `SELECT b.id, b.name
       FROM badges b
       JOIN badge_colors bc ON bc.badge_id = b.id
       WHERE b.certificate_id = $1
         AND $2::numeric >= bc.min_score
         AND $2::numeric <= bc.max_score
         AND (
           $3::text IS NULL
           OR ($3 = 'self_disclosure' AND b.slot = 1)
           OR ($3 = 'assured' AND b.slot IN (2, 3))
         )
       ORDER BY b.slot ASC
        LIMIT 1`,
      [certificateId, score, assessmentType ?? null],
    )) as QueryResult<{ id: string; name: string }>;
    return result.rows[0] || null;
  }

  /**
   * Determines which assured badge slot an org qualifies for based on their
   * self-disclosure badge tier:
   *   - No badge → null (not qualified for assured)
   *   - Bronze (lowest) self-disclosure → slot 2 (ACES Verified)
   *   - Silver/Gold/Emerald self-disclosure → slot 3 (ACES Certified)
   */
  async getAssuredSlotForOrg(
    certificateId: string,
    organizationId: string,
  ): Promise<number | null> {
    // Find the org's completed self-disclosure assessment badge color for this certificate
    const result = (await this.db.query(
      `SELECT bc.color
       FROM certificate_assessments ca
       JOIN badges b ON b.id = ca.badge_id
       JOIN badge_colors bc ON bc.badge_id = b.id
         AND ca.score >= bc.min_score
         AND ca.score <= bc.max_score
       WHERE ca.certificate_id = $1
         AND ca.organization_id = $2
         AND ca.assessment_type = 'self_disclosure'
         AND ca.status = 'completed'
         AND ca.badge_id IS NOT NULL
         AND b.slot = 1
       ORDER BY ca.completed_at DESC
       LIMIT 1`,
      [certificateId, organizationId],
    )) as QueryResult<{ color: string }>;

    const selfDisclosureColor = result.rows[0]?.color;

    // No self-disclosure badge → not qualified
    if (!selfDisclosureColor) {
      return null;
    }

    // Bronze color = #CD7F32 → slot 2 (ACES Verified)
    // Anything else (Silver/Gold/Emerald) → slot 3 (ACES Certified)
    if (selfDisclosureColor === '#CD7F32') {
      return 2;
    }
    return 3;
  }

  async getAdminAssessmentMetrics(): Promise<{
    totalAssessments: number;
    aiFlagged: number;
    pendingAudits: number;
    completed: number;
  }> {
    const result = (await this.db.query(
      `SELECT
        COUNT(*) AS total_assessments,
        COUNT(DISTINCT CASE
          WHEN ar.total_flags > 0 OR ar.flag_status IN ('open', 'pending', 'escalated')
          THEN ca.id
        END) AS ai_flagged,
        COUNT(CASE
          WHEN ca.status IN ('submitted', 'ai_reviewing') AND ca.is_submitted = TRUE
          THEN 1
        END) AS pending_audits,
        COUNT(CASE WHEN ca.status = 'completed' THEN 1 END) AS completed
      FROM certificate_assessments ca
      LEFT JOIN ai_reviews ar ON ar.certificate_assessment_id = ca.id`,
      [],
    )) as QueryResult<{
      total_assessments: string;
      ai_flagged: string;
      pending_audits: string;
      completed: string;
    }>;

    const row = result.rows[0];
    return {
      totalAssessments: parseInt(row.total_assessments, 10),
      aiFlagged: parseInt(row.ai_flagged, 10),
      pendingAudits: parseInt(row.pending_audits, 10),
      completed: parseInt(row.completed, 10),
    };
  }

  async findAdminAssessments(params: {
    page: number;
    limit: number;
    organizationId?: string;
    status?: string;
    assessmentType?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: 'date' | 'score';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: Array<{
      assessmentId: string;
      organizationId: string;
      organizationName: string;
      certificationType: string;
      isCertificateBlocked: boolean;
      certificateBlockReason: string | null;
      badgeStatus: string | null;
      badgeColor: string | null;
      assignedReviewer: string | null;
      aiFlagReason: string | null;
      assignedAuditor: string | null;
      flaggedDate: Date | null;
      auditDate: Date | null;
      score: number | null;
      status: string;
      assessmentType: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = [];
    const queryParams: (string | number | Date)[] = [];
    let paramIndex = 1;

    if (params.organizationId) {
      conditions.push(`ca.organization_id = $${paramIndex}`);
      queryParams.push(params.organizationId);
      paramIndex++;
    }

    if (params.status) {
      conditions.push(`ca.status = $${paramIndex}`);
      queryParams.push(params.status);
      paramIndex++;
    }

    if (params.assessmentType) {
      conditions.push(`ca.assessment_type = $${paramIndex}`);
      queryParams.push(params.assessmentType);
      paramIndex++;
    }

    if (params.startDate) {
      conditions.push(`ca.created_at >= $${paramIndex}`);
      queryParams.push(params.startDate);
      paramIndex++;
    }

    if (params.endDate) {
      conditions.push(`ca.created_at <= $${paramIndex}`);
      queryParams.push(params.endDate);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(DISTINCT ca.id) as total
      FROM certificate_assessments ca
      ${whereClause}
    `;

    const countResult = (await this.db.query(
      countQuery,
      queryParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    const sortBy = params.sortBy || 'date';
    const sortOrder = params.sortOrder || 'desc';
    const sortColumn = sortBy === 'date' ? 'ca.created_at' : 'ca.score';
    const orderClause = `ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

    const dataQuery = `
      SELECT 
        ca.id as assessment_id,
        ca.organization_id,
        o.name as organization_name,
        c.name as certificate_name,
        COALESCE(ca.is_certificate_blocked, FALSE) as is_certificate_blocked,
        ca.certificate_block_reason,
        ob.badge_name,
        ob.color as badge_color,
        ca.score,
        ca.status,
        ca.assessment_type,
        ca.submitted_at as flagged_date,
        ca.audit_date,
        ar.total_flags,
        ar.flag_status,
        a.first_name || ' ' || a.last_name as assigned_auditor_name,
        r.first_name || ' ' || r.last_name as assigned_reviewer_name,
        (
          SELECT air.flag_reason
          FROM ai_responses air
          INNER JOIN ai_reviews ar2 ON ar2.id = air.ai_review_id
          WHERE ar2.certificate_assessment_id = ca.id
            AND air.is_flagged = TRUE
          LIMIT 1
        ) as ai_flag_reason,
        EXISTS(
          SELECT 1 FROM assessment_invitations ai
          WHERE ai.assessment_id = ca.id AND ai.status IN ('pending', 'accepted')
        ) as auditor_invited,
        (
          SELECT inv_aud.first_name || ' ' || inv_aud.last_name
          FROM assessment_invitations ai
          JOIN auditor inv_aud ON inv_aud.user_id = ai.invited_user_id
          WHERE ai.assessment_id = ca.id AND ai.status IN ('pending', 'accepted')
          LIMIT 1
        ) as invited_auditor_name
      FROM certificate_assessments ca
      LEFT JOIN organization o ON o.id = ca.organization_id
      LEFT JOIN certificates c ON c.id = ca.certificate_id
      LEFT JOIN organization_badges ob ON ob.assessment_id = ca.id
      LEFT JOIN ai_reviews ar ON ar.certificate_assessment_id = ca.id
      LEFT JOIN auditor a ON a.user_id = ca.assigned_auditor_id
      LEFT JOIN reviewer r ON r.user_id = ca.assigned_reviewer_id
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(params.limit, offset);

    const dataResult = (await this.db.query(
      dataQuery,
      queryParams,
    )) as QueryResult<{
      assessment_id: string;
      organization_id: string;
      organization_name: string;
      certificate_name: string;
      is_certificate_blocked: boolean;
      certificate_block_reason: string | null;
      badge_name: string | null;
      badge_color: string | null;
      score: number | null;
      status: string;
      assessment_type: string;
      flagged_date: Date | null;
      audit_date: Date | null;
      total_flags: number | null;
      flag_status: string | null;
      assigned_auditor_name: string | null;
      assigned_reviewer_name: string | null;
      ai_flag_reason: string | null;
      auditor_invited: boolean;
      invited_auditor_name: string | null;
    }>;

    const formatBadgeStatus = (badgeName: string | null): string | null => {
      if (!badgeName) return null;
      const badgeDisplay =
        badgeName.charAt(0).toUpperCase() + badgeName.slice(1);
      return `ACES Rated / ${badgeDisplay}`;
    };

    const formatAiFlagReason = (
      totalFlags: number | null,
      flagStatus: string | null,
      flagReason: string | null,
    ): string | null => {
      if (flagReason) {
        if (totalFlags && totalFlags > 0) {
          return `${totalFlags} discrepancy${totalFlags > 1 ? 'ies' : ''} flagged by AI: ${flagReason}`;
        }
        return flagReason;
      }

      if (totalFlags && totalFlags > 0) {
        return `${totalFlags} discrepancy${totalFlags > 1 ? 'ies' : ''} flagged by AI`;
      }

      if (flagStatus) {
        if (flagStatus === 'pending' || flagStatus === 'open') {
          return 'Awaiting auditor assignment';
        }
        if (flagStatus === 'escalated') {
          return 'Auditor reviewing documentation';
        }
        if (flagStatus === 'resolved') {
          return 'All responses validated';
        }
      }

      return null;
    };

    return {
      data: dataResult.rows.map((row) => ({
        assessmentId: row.assessment_id,
        organizationId: row.organization_id,
        organizationName: row.organization_name || 'Unknown Organization',
        certificationType: row.certificate_name || 'Unknown Certificate',
        isCertificateBlocked: Boolean(row.is_certificate_blocked),
        certificateBlockReason: row.certificate_block_reason || null,
        badgeStatus: formatBadgeStatus(row.badge_name),
        badgeColor: row.badge_color,
        assignedReviewer: row.assigned_reviewer_name || null,
        aiFlagReason: formatAiFlagReason(
          row.total_flags,
          row.flag_status,
          row.ai_flag_reason,
        ),
        assignedAuditor: row.assigned_auditor_name || null,
        auditorInvited: Boolean(row.auditor_invited),
        invitedAuditorName: row.invited_auditor_name || null,
        flaggedDate: row.flagged_date || row.flagged_date,
        auditDate: row.audit_date || null,
        score: row.score ? parseFloat(row.score.toString()) : null,
        status: row.status,
        assessmentType: row.assessment_type,
      })),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findAdminAssessmentDetails(assessmentId: string): Promise<{
    assessmentId: string;
    organizationId: string;
    organizationName: string;
    branchId: string | null;
    branchName: string | null;
    certificateId: string;
    certificateName: string;
    certificateProductId: string | null;
    paymentId: string;
    assessmentType: string;
    isCertificateBlocked: boolean;
    certificateBlockReason: string | null;
    badgeId: string | null;
    badgeName: string | null;
    badgeColor: string | null;
    score: number | null;
    isSubmitted: boolean;
    status: string;
    submittedAt: Date | null;
    completedAt: Date | null;
    auditDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    aiReview: {
      id: string;
      reviewDescription: string | null;
      reviewStatus: string;
      totalFlags: number;
      flagStatus: string | null;
      score: number | null;
      startedAt: Date | null;
      completedAt: Date | null;
    } | null;
    assignedReviewer: string | null;
    assignedAuditor: string | null;
    auditorInvited: boolean;
    invitedAuditorName: string | null;
  } | null> {
    const result = (await this.db.query(
      `SELECT 
        ca.id as assessment_id,
        ca.organization_id,
        o.name as organization_name,
        ca.branch_id,
        b.name as branch_name,
        ca.certificate_id,
        c.name as certificate_name,
        c.certificate_id as certificate_product_id,
        COALESCE(ca.is_certificate_blocked, FALSE) as is_certificate_blocked,
        ca.certificate_block_reason,
        ca.payment_id,
        ca.assessment_type,
        ca.badge_id,
        ob.badge_name,
        ob.color as badge_color,
        ca.score,
        ca.is_submitted,
        CASE
          WHEN ca.status IN ('submitted', 'ai_reviewing')
            AND ar.review_status = 'completed'
            AND COALESCE(ca.score, ar.score) IS NOT NULL
          THEN 'completed'
          ELSE ca.status
        END as status,
        ca.submitted_at,
        CASE
          WHEN ca.completed_at IS NOT NULL THEN ca.completed_at
          WHEN ca.status IN ('submitted', 'ai_reviewing')
            AND ar.review_status = 'completed'
          THEN ar.completed_at
          ELSE ca.completed_at
        END as completed_at,
        ca.audit_date,
        ca.created_at,
        ca.updated_at,
        ar.id as ai_review_id,
        ar.review_description,
        ar.review_status,
        ar.total_flags,
        ar.flag_status,
        ar.score as ai_score,
        ar.started_at,
        ar.completed_at as ai_review_completed_at,
        a.first_name || ' ' || a.last_name as assigned_auditor_name,
        r.first_name || ' ' || r.last_name as assigned_reviewer_name,
        EXISTS(
          SELECT 1 FROM assessment_invitations ai
          WHERE ai.assessment_id = ca.id AND ai.status IN ('pending', 'accepted')
        ) as auditor_invited,
        (
          SELECT inv_aud.first_name || ' ' || inv_aud.last_name
          FROM assessment_invitations ai
          JOIN auditor inv_aud ON inv_aud.user_id = ai.invited_user_id
          WHERE ai.assessment_id = ca.id AND ai.status IN ('pending', 'accepted')
          LIMIT 1
        ) as invited_auditor_name
      FROM certificate_assessments ca
      LEFT JOIN organization o ON o.id = ca.organization_id
      LEFT JOIN branches b ON b.id = ca.branch_id
      LEFT JOIN certificates c ON c.id = ca.certificate_id
      LEFT JOIN LATERAL (
        SELECT assessment_id, badge_name, color
        FROM organization_badges
        WHERE assessment_id = ca.id
        ORDER BY created_at DESC
        LIMIT 1
      ) ob ON TRUE
      LEFT JOIN LATERAL (
        SELECT *
        FROM ai_reviews
        WHERE certificate_assessment_id = ca.id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ar ON TRUE
      LEFT JOIN auditor a ON a.user_id = ca.assigned_auditor_id
      LEFT JOIN reviewer r ON r.user_id = ca.assigned_reviewer_id
      WHERE ca.id = $1
      LIMIT 1`,
      [assessmentId],
    )) as QueryResult<{
      assessment_id: string;
      organization_id: string;
      organization_name: string;
      branch_id: string | null;
      branch_name: string | null;
      certificate_id: string;
      certificate_name: string;
      certificate_product_id: string | null;
      is_certificate_blocked: boolean;
      certificate_block_reason: string | null;
      payment_id: string;
      assessment_type: string;
      badge_id: string | null;
      badge_name: string | null;
      badge_color: string | null;
      score: number | null;
      is_submitted: boolean;
      status: string;
      submitted_at: Date | null;
      completed_at: Date | null;
      audit_date: Date | null;
      created_at: Date;
      updated_at: Date;
      ai_review_id: string | null;
      review_description: string | null;
      review_status: string | null;
      total_flags: number | null;
      flag_status: string | null;
      ai_score: number | null;
      started_at: Date | null;
      ai_review_completed_at: Date | null;
      assigned_auditor_name: string | null;
      assigned_reviewer_name: string | null;
      auditor_invited: boolean;
      invited_auditor_name: string | null;
    }>;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      assessmentId: row.assessment_id,
      organizationId: row.organization_id,
      organizationName: row.organization_name || 'Unknown Organization',
      branchId: row.branch_id,
      branchName: row.branch_name,
      certificateId: row.certificate_id,
      certificateName: row.certificate_name || 'Unknown Certificate',
      certificateProductId: row.certificate_product_id,
      isCertificateBlocked: Boolean(row.is_certificate_blocked),
      certificateBlockReason: row.certificate_block_reason || null,
      paymentId: row.payment_id,
      assessmentType: row.assessment_type,
      badgeId: row.badge_id,
      badgeName: row.badge_name,
      badgeColor: row.badge_color,
      score: row.score ? parseFloat(row.score.toString()) : null,
      isSubmitted: row.is_submitted,
      status: row.status,
      submittedAt: row.submitted_at,
      completedAt: row.completed_at,
      auditDate: row.audit_date || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      aiReview: row.ai_review_id
        ? {
            id: row.ai_review_id,
            reviewDescription: row.review_description,
            reviewStatus: row.review_status || 'pending',
            totalFlags: row.total_flags || 0,
            flagStatus: row.flag_status || null,
            score: row.ai_score ? parseFloat(row.ai_score.toString()) : null,
            startedAt: row.started_at,
            completedAt: row.ai_review_completed_at,
          }
        : null,
      assignedReviewer: row.assigned_reviewer_name || null,
      assignedAuditor: row.assigned_auditor_name || null,
      auditorInvited: Boolean(row.auditor_invited),
      invitedAuditorName: row.invited_auditor_name || null,
    };
  }

  async assignAuditor(
    assessmentId: string,
    auditorUserId: string | null,
    auditDate?: Date | null,
    assignedByUserId?: string | null,
  ): Promise<CertificateAssessment> {
    const setClauses: string[] = [
      'assigned_auditor_id = $2',
      'updated_at = NOW()',
    ];
    const params: Array<string | Date | null> = [assessmentId, auditorUserId];
    let paramIndex = 3;

    if (auditDate !== undefined) {
      setClauses.unshift(`audit_date = $${paramIndex}`);
      params.push(auditDate);
      paramIndex++;
    } else if (auditorUserId === null) {
      setClauses.unshift('audit_date = NULL');
    }

    if (assignedByUserId !== undefined) {
      setClauses.unshift(`assigned_by = $${paramIndex}`);
      params.push(assignedByUserId);
      paramIndex++;
    } else if (auditorUserId === null) {
      setClauses.unshift('assigned_by = NULL');
    }

    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params,
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async assignReviewer(
    assessmentId: string,
    reviewerUserId: string | null,
    assignedByUserId?: string | null,
  ): Promise<CertificateAssessment> {
    const setClauses: string[] = [
      'assigned_reviewer_id = $2',
      'updated_at = NOW()',
    ];
    const params: Array<string | null> = [assessmentId, reviewerUserId];
    let paramIndex = 3;

    if (assignedByUserId !== undefined) {
      setClauses.unshift(`assigned_by = $${paramIndex}`);
      params.push(assignedByUserId);
      paramIndex++;
    } else if (reviewerUserId === null) {
      setClauses.unshift('assigned_by = NULL');
    }

    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params,
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async setCertificateBlockStatus(
    assessmentId: string,
    isBlocked: boolean,
    reason: string | null,
  ): Promise<CertificateAssessment> {
    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET is_certificate_blocked = $2,
           certificate_block_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [assessmentId, isBlocked, reason],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async findLatestSelfDisclosureByOrganization(
    organizationId: string,
    certificateId: string,
    branchId?: string,
  ): Promise<{
    id: string;
    status: string;
    is_submitted: boolean;
    submitted_at: Date | null;
    created_at: Date;
  } | null> {
    const result = (await this.db.query(
      `SELECT
        ca.id,
        CASE
          WHEN ca.status IN ('submitted', 'ai_reviewing')
            AND ar.review_status = 'completed'
            AND COALESCE(ca.score, ar.score) IS NOT NULL
          THEN 'completed'
          ELSE ca.status
        END AS status,
        ca.is_submitted,
        ca.submitted_at,
        ca.created_at
       FROM certificate_assessments ca
       LEFT JOIN LATERAL (
         SELECT review_status, score
         FROM ai_reviews
         WHERE certificate_assessment_id = ca.id
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 1
       ) ar ON TRUE
       WHERE ca.organization_id = $1
         AND ca.certificate_id = $2
         ${branchId ? 'AND ca.branch_id = $3' : ''}
         AND ca.assessment_type = 'self_disclosure'
       ORDER BY
         CASE
              WHEN (
                CASE
                  WHEN ca.status IN ('submitted', 'ai_reviewing')
                    AND ar.review_status = 'completed'
                    AND COALESCE(ca.score, ar.score) IS NOT NULL
                  THEN 'completed'
                  ELSE ca.status
                END
              ) = 'completed' THEN 0
              WHEN ca.status = 'submitted' THEN 1
              WHEN ca.status = 'ai_reviewing' THEN 2
              ELSE 3
         END,
         ca.created_at DESC
       LIMIT 1`,
      branchId
        ? [organizationId, certificateId, branchId]
        : [organizationId, certificateId],
    )) as QueryResult<{
      id: string;
      status: string;
      is_submitted: boolean;
      submitted_at: Date | null;
      created_at: Date;
    }>;

    return result.rows[0] || null;
  }

  async hasAssuredAppliedByOrganization(
    organizationId: string,
    certificateId: string,
    branchId?: string,
  ): Promise<boolean> {
    const result = (await this.db.query(
      `SELECT 1 AS assured_exists
       FROM certificate_assessments
       WHERE organization_id = $1
         AND certificate_id = $2
         ${branchId ? 'AND branch_id = $3' : ''}
         AND assessment_type = 'assured'
       LIMIT 1`,
      branchId
        ? [organizationId, certificateId, branchId]
        : [organizationId, certificateId],
    )) as QueryResult<{ assured_exists: number }>;

    return result.rows.length > 0;
  }

  async updateAuditDate(
    assessmentId: string,
    auditDate: Date,
  ): Promise<CertificateAssessment> {
    const result = (await this.db.query(
      `UPDATE certificate_assessments
       SET audit_date = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [assessmentId, auditDate],
    )) as QueryResult<CertificateAssessment>;
    return result.rows[0];
  }

  async findAuditorByUserId(userId: string): Promise<{ id: string } | null> {
    const result = (await this.db.query(
      `SELECT id FROM auditor WHERE user_id = $1`,
      [userId],
    )) as QueryResult<{ id: string }>;
    return result.rows[0] || null;
  }

  async findReviewerByUserId(userId: string): Promise<{ id: string } | null> {
    const result = (await this.db.query(
      `SELECT id FROM reviewer WHERE user_id = $1`,
      [userId],
    )) as QueryResult<{ id: string }>;
    return result.rows[0] || null;
  }

  async findSubadminByUserId(userId: string): Promise<{ id: string } | null> {
    const result = (await this.db.query(
      `SELECT id FROM subadmin WHERE user_id = $1`,
      [userId],
    )) as QueryResult<{ id: string }>;
    return result.rows[0] || null;
  }

  async getOrganizationUserIds(organizationId: string): Promise<string[]> {
    const result = (await this.db.query(
      `SELECT o.user_id AS id FROM organization o WHERE o.id = $1
       UNION
       SELECT e.user_id AS id FROM employee e WHERE e.organization_id = $1 AND e.status = 'active'`,
      [organizationId],
    )) as QueryResult<{ id: string }>;
    return result.rows.map((r) => r.id);
  }

  /**
   * Returns the applicant user IDs for an assessment.
   * If branchId is provided, returns branch employees + org owner.
   * Otherwise, returns all organization users.
   */
  async getApplicantUserIds(
    organizationId: string,
    branchId: string | null,
  ): Promise<string[]> {
    if (branchId) {
      const result = (await this.db.query(
        `SELECT o.user_id AS id FROM organization o WHERE o.id = $1
         UNION
         SELECT e.user_id AS id FROM employee e
         WHERE e.organization_id = $1 AND e.branch_id = $2 AND e.status = 'active'`,
        [organizationId, branchId],
      )) as QueryResult<{ id: string }>;
      return result.rows.map((r) => r.id);
    }
    return this.getOrganizationUserIds(organizationId);
  }

  async saveAnswersBatch(
    answers: Array<{
      certificate_assessment_id: string;
      question_id: string;
      response_type: 'pdf' | 'boolean' | 'text' | 'number' | 'checkbox' | 'multiple_choice' | 'rating';
      response_value?: string;
      response_files?: string[] | null;
    }>,
  ): Promise<AssessmentQuery[]> {
    if (answers.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < answers.length; i++) {
      const offset = i * 5;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`,
      );
      values.push(
        answers[i].certificate_assessment_id,
        answers[i].question_id,
        answers[i].response_type,
        answers[i].response_value || null,
        answers[i].response_files ? JSON.stringify(answers[i].response_files) : null,
      );
    }

    const result = (await this.db.query(
      `INSERT INTO assessment_queries
       (certificate_assessment_id, question_id, response_type, response_value, response_files)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (certificate_assessment_id, question_id)
       DO UPDATE SET
         response_type = EXCLUDED.response_type,
         response_value = EXCLUDED.response_value,
         response_files = EXCLUDED.response_files,
         updated_at = NOW()
       RETURNING *`,
      values,
    )) as QueryResult<AssessmentQuery>;
    return result.rows;
  }

  async updateAnswersValueBatch(
    updates: Array<{
      id: string;
      response_value: string;
    }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < updates.length; i++) {
      const offset = i * 2;
      placeholders.push(`($${offset + 1}::uuid, $${offset + 2})`);
      values.push(updates[i].id, updates[i].response_value);
    }

    await this.db.query(
      `UPDATE assessment_queries AS aq SET
        response_value = v.response_value,
        updated_at = NOW()
      FROM (VALUES ${placeholders.join(', ')})
        AS v(id, response_value)
      WHERE aq.id = v.id`,
      values,
    );
  }

  async getAuditRecordForAssessment(
    assessmentId: string,
  ): Promise<{ audit_lifecycle_status: string } | null> {
    const result = (await this.db.query(
      `SELECT audit_lifecycle_status
       FROM audits
       WHERE assessment_id = $1 AND is_archived = FALSE
       LIMIT 1`,
      [assessmentId],
    )) as QueryResult<{ audit_lifecycle_status: string }>;
    return result.rows[0] || null;
  }

  async getAdminDashboardStats(): Promise<{
    selfDisclosure: {
      totalCertificates: number;
      inProgress: number;
      completed: number;
      activeIssuedCertificates: number;
    };
    selfAssured: {
      total: number;
      inProgress: number;
      auditorAssigned: number;
      completed: number;
    };
  }> {
    const result = (await this.db.query(
      `SELECT
        (SELECT COUNT(*) FROM certificates WHERE is_published = TRUE) AS total_certificates,

        COUNT(CASE
          WHEN ca.assessment_type = 'self_disclosure' AND ca.status = 'in_progress'
          THEN 1
        END) AS sd_in_progress,

        COUNT(CASE
          WHEN ca.assessment_type = 'self_disclosure' AND ca.status = 'completed'
          THEN 1
        END) AS sd_completed,

        (SELECT COUNT(*) FROM issued_certificates
         WHERE is_blocked = FALSE
           AND (expiry_date IS NULL OR expiry_date > NOW())
        ) AS active_issued_certificates,

        COUNT(CASE
          WHEN ca.assessment_type = 'assured'
          THEN 1
        END) AS sa_total,

        COUNT(CASE
          WHEN ca.assessment_type = 'assured' AND ca.status = 'in_progress'
          THEN 1
        END) AS sa_in_progress,

        COUNT(CASE
          WHEN ca.assessment_type = 'assured' AND ca.assigned_auditor_id IS NOT NULL
            AND ca.status NOT IN ('completed', 'expired')
          THEN 1
        END) AS sa_auditor_assigned,

        COUNT(CASE
          WHEN ca.assessment_type = 'assured' AND ca.status = 'completed'
          THEN 1
        END) AS sa_completed

      FROM certificate_assessments ca`,
      [],
    )) as QueryResult<{
      total_certificates: string;
      sd_in_progress: string;
      sd_completed: string;
      active_issued_certificates: string;
      sa_total: string;
      sa_in_progress: string;
      sa_auditor_assigned: string;
      sa_completed: string;
    }>;

    const row = result.rows[0];
    return {
      selfDisclosure: {
        totalCertificates: parseInt(row.total_certificates, 10),
        inProgress: parseInt(row.sd_in_progress, 10),
        completed: parseInt(row.sd_completed, 10),
        activeIssuedCertificates: parseInt(row.active_issued_certificates, 10),
      },
      selfAssured: {
        total: parseInt(row.sa_total, 10),
        inProgress: parseInt(row.sa_in_progress, 10),
        auditorAssigned: parseInt(row.sa_auditor_assigned, 10),
        completed: parseInt(row.sa_completed, 10),
      },
    };
  }

  async getAdminDashboardChartStats(): Promise<{
    certificationProgress: Array<{
      day: string;
      completed: number;
      inProgress: number;
    }>;
    assessmentResults: {
      total: number;
      passed: number;
      failed: number;
      pending: number;
    };
  }> {
    const progressResult = (await this.db.query(
      `WITH all_days AS (
        SELECT unnest(ARRAY[1,2,3,4,5,6,7]) AS dow,
               unnest(ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']) AS day
      ),
      counts AS (
        SELECT
          EXTRACT(ISODOW FROM ca.updated_at)::int AS dow,
          COUNT(CASE WHEN ca.status = 'completed' THEN 1 END) AS completed,
          COUNT(CASE
            WHEN ca.status IN ('in_progress', 'submitted', 'ai_reviewing', 'improvement_requested') THEN 1
          END) AS in_progress
        FROM certificate_assessments ca
        GROUP BY EXTRACT(ISODOW FROM ca.updated_at)
      )
      SELECT
        ad.day,
        COALESCE(c.completed, 0) AS completed,
        COALESCE(c.in_progress, 0) AS in_progress
      FROM all_days ad
      LEFT JOIN counts c ON c.dow = ad.dow
      ORDER BY ad.dow`,
      [],
    )) as QueryResult<{
      day: string;
      completed: string;
      in_progress: string;
    }>;

    const resultsResult = (await this.db.query(
      `SELECT
        COUNT(*) AS total,
        COUNT(CASE
          WHEN status = 'completed' AND score >= 50 THEN 1
        END) AS passed,
        COUNT(CASE
          WHEN status = 'completed' AND (score < 50 OR score IS NULL) THEN 1
        END) AS failed,
        COUNT(CASE
          WHEN status IN ('in_progress', 'submitted', 'ai_reviewing', 'improvement_requested') THEN 1
        END) AS pending
      FROM certificate_assessments`,
      [],
    )) as QueryResult<{
      total: string;
      passed: string;
      failed: string;
      pending: string;
    }>;

    const certificationProgress = progressResult.rows.map((row) => ({
      day: row.day,
      completed: parseInt(row.completed, 10),
      inProgress: parseInt(row.in_progress, 10),
    }));

    const resultsRow = resultsResult.rows[0];
    return {
      certificationProgress,
      assessmentResults: {
        total: parseInt(resultsRow.total, 10),
        passed: parseInt(resultsRow.passed, 10),
        failed: parseInt(resultsRow.failed, 10),
        pending: parseInt(resultsRow.pending, 10),
      },
    };
  }
}
