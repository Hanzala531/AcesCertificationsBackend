import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { QueryResult } from '../../common/types/database.types';
import {
  Audit,
  AuditWithDetails,
  AiAuditScore,
  AuditorAuditRow,
  AuditorAuditsPaginatedResult,
  AuditQuestionRow,
  ComplianceAction,
  IssuedCertificate,
} from './types/audit.types';

@Injectable()
export class AuditRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByAssessmentId(assessmentId: string): Promise<Audit | null> {
    const result = (await this.db.query(
      `SELECT * FROM audits WHERE assessment_id = $1 AND is_archived = FALSE`,
      [assessmentId],
    )) as QueryResult<Audit>;
    return result.rows[0] || null;
  }

  async findAuditorSignatureByUserId(
    userId: string,
  ): Promise<string | null> {
    const result = (await this.db.query(
      `SELECT signature FROM auditor WHERE user_id = $1`,
      [userId],
    )) as QueryResult<{ signature: string | null }>;
    return result.rows[0]?.signature ?? null;
  }

  async findReviewerSignatureByUserId(
    userId: string,
  ): Promise<string | null> {
    const result = (await this.db.query(
      `SELECT signature FROM reviewer WHERE user_id = $1`,
      [userId],
    )) as QueryResult<{ signature: string | null }>;
    return result.rows[0]?.signature ?? null;
  }

  async findByAssessmentIdWithDetails(
    assessmentId: string,
  ): Promise<AuditWithDetails | null> {
    const result = (await this.db.query(
      `SELECT
         a.*,
         CONCAT_WS(' ', aud_p.first_name, aud_p.last_name) AS auditor_name,
         aud_u.email AS auditor_email,
         aud_p.signature AS auditor_signature,
         CONCAT_WS(' ', rev_p.first_name, rev_p.last_name) AS reviewer_name,
         rev_u.email AS reviewer_email,
         rev_p.signature AS reviewer_signature
       FROM audits a
       LEFT JOIN users aud_u ON aud_u.id = a.assigned_auditor_id
       LEFT JOIN auditor aud_p ON aud_p.user_id = a.assigned_auditor_id
       LEFT JOIN users rev_u ON rev_u.id = COALESCE(a.reviewed_by, a.assigned_reviewer_id)
       LEFT JOIN reviewer rev_p ON rev_p.user_id = COALESCE(a.reviewed_by, a.assigned_reviewer_id)
       WHERE a.assessment_id = $1 AND a.is_archived = FALSE`,
      [assessmentId],
    )) as QueryResult<AuditWithDetails>;
    return result.rows[0] || null;
  }

  async upsert(data: {
    assessmentId: string;
    certificateId: string;
    auditSummary?: string;
    auditSummaryDoc?: string;
    auditDescription?: string;
    status?: 'approved' | 'conditionally_approved' | 'rejected';
  }): Promise<Audit> {
    const lifecycleStatus = data.status ? 'auditor_submitted' : null;
    const result = (await this.db.query(
      `INSERT INTO audits
         (assessment_id, certificate_id, audit_summary, audit_summary_doc, audit_description, status, audit_lifecycle_status)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::text::audit_lifecycle_status, 'in_progress'::audit_lifecycle_status))
       ON CONFLICT (assessment_id) WHERE is_archived = FALSE DO UPDATE SET
         audit_summary      = COALESCE(EXCLUDED.audit_summary,      audits.audit_summary),
         audit_summary_doc  = COALESCE(EXCLUDED.audit_summary_doc,  audits.audit_summary_doc),
         audit_description  = COALESCE(EXCLUDED.audit_description,  audits.audit_description),
         status             = COALESCE(EXCLUDED.status,             audits.status),
         audit_lifecycle_status = COALESCE($7::text::audit_lifecycle_status, audits.audit_lifecycle_status::audit_lifecycle_status),
         updated_at         = NOW()
       RETURNING *`,
      [
        data.assessmentId,
        data.certificateId,
        data.auditSummary ?? null,
        data.auditSummaryDoc ?? null,
        data.auditDescription ?? null,
        data.status ?? null,
        lifecycleStatus,
      ],
    )) as QueryResult<Audit>;
    return result.rows[0];
  }

  async upsertReview(data: {
    assessmentId: string;
    reviewSummary?: string;
    reviewSummaryDoc?: string;
    reviewDescription?: string;
    reviewStatus?: 'approved' | 'conditionally_approved' | 'rejected';
    reviewedBy: string;
  }): Promise<Audit> {
    const lifecycleStatus = data.reviewStatus ? 'reviewer_submitted' : null;
    const result = (await this.db.query(
      `UPDATE audits SET
         review_summary     = COALESCE($2, review_summary),
         review_summary_doc = COALESCE($3, review_summary_doc),
         review_description = COALESCE($4, review_description),
         review_status      = COALESCE($5::audit_status, review_status),
         reviewed_by        = $6,
         reviewed_at        = NOW(),
         audit_lifecycle_status = COALESCE($7::text::audit_lifecycle_status, audit_lifecycle_status::audit_lifecycle_status),
         updated_at         = NOW()
       WHERE assessment_id = $1 AND is_archived = FALSE
       RETURNING *`,
      [
        data.assessmentId,
        data.reviewSummary ?? null,
        data.reviewSummaryDoc ?? null,
        data.reviewDescription ?? null,
        data.reviewStatus ?? null,
        data.reviewedBy,
        lifecycleStatus,
      ],
    )) as QueryResult<Audit>;
    return result.rows[0];
  }

  async getBadgeForScore(
    certificateId: string,
    score: number,
    assessmentType?: string,
  ): Promise<{
    id: string;
    name: string;
    slot: number;
    color: string | null;
  } | null> {
    const result = (await this.db.query(
      `SELECT b.id, b.name, b.slot, bc.color
       FROM badge_colors bc
       JOIN badges b ON b.id = bc.badge_id
       WHERE b.certificate_id = $1
         AND $2::numeric BETWEEN bc.min_score AND bc.max_score
         AND (
           $3::text IS NULL
           OR ($3 = 'self_disclosure' AND b.slot = 1)
           OR ($3 = 'assured' AND b.slot IN (2, 3))
         )
       ORDER BY b.slot ASC
       LIMIT 1`,
      [certificateId, score, assessmentType ?? null],
    )) as QueryResult<{
      id: string;
      name: string;
      slot: number;
      color: string | null;
    }>;
    return result.rows[0] || null;
  }

  async getNextCertificateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = (await this.db.query(
      `SELECT LPAD(nextval('issued_certificate_number_seq')::text, 6, '0') AS seq`,
      [],
    )) as QueryResult<{ seq: string }>;
    return `ACES-${year}-${result.rows[0].seq}`;
  }

  async findOrgBadgeByAssessmentId(assessmentId: string): Promise<{
    id: string;
    badge_name: string;
    color: string;
    score: number;
  } | null> {
    const result = (await this.db.query(
      `SELECT id, badge_name, color, score
       FROM organization_badges
       WHERE assessment_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [assessmentId],
    )) as QueryResult<{
      id: string;
      badge_name: string;
      color: string;
      score: number;
    }>;
    return result.rows[0] || null;
  }

  async createIssuedCertificate(data: {
    assessmentId: string;
    certificateId: string;
    certificateName: string;
    organizationId: string;
    branchId: string | null;
    badgeId: string | null;
    badgeName: string | null;
    badgeColor: string | null;
    orgBadgeId: string | null;
    certificateNumber: string;
    reviewScore: number | null;
    issuedBy: string;
    expiryDate: string | null;
  }): Promise<IssuedCertificate> {
    const result = (await this.db.query(
      `INSERT INTO issued_certificates
         (assessment_id, certificate_id, certificate_name, organization_id, branch_id,
          badge_id, badge_name, badge_color, org_badge_id, certificate_number,
          review_score, issued_by, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.assessmentId,
        data.certificateId,
        data.certificateName,
        data.organizationId,
        data.branchId,
        data.badgeId,
        data.badgeName,
        data.badgeColor,
        data.orgBadgeId,
        data.certificateNumber,
        data.reviewScore,
        data.issuedBy,
        data.expiryDate ?? null,
      ],
    )) as QueryResult<IssuedCertificate>;
    return result.rows[0];
  }

  async findIssuedCertificate(
    assessmentId: string,
  ): Promise<IssuedCertificate | null> {
    const result = (await this.db.query(
      `SELECT * FROM issued_certificates WHERE assessment_id = $1`,
      [assessmentId],
    )) as QueryResult<IssuedCertificate>;
    return result.rows[0] || null;
  }

  async blockIssuedCertificate(
    assessmentId: string,
    reason: string,
    blockedBy: string,
  ): Promise<IssuedCertificate> {
    const result = (await this.db.query(
      `UPDATE issued_certificates
       SET is_blocked   = TRUE,
           block_reason = $2,
           blocked_by   = $3,
           blocked_at   = NOW(),
           updated_at   = NOW()
       WHERE assessment_id = $1
       RETURNING *`,
      [assessmentId, reason, blockedBy],
    )) as QueryResult<IssuedCertificate>;
    return result.rows[0];
  }

  async archiveCurrentAudit(
    assessmentId: string,
  ): Promise<{ version: number } | null> {
    const result = (await this.db.query(
      `UPDATE audits
       SET is_archived = TRUE, updated_at = NOW()
       WHERE assessment_id = $1 AND is_archived = FALSE
       RETURNING version`,
      [assessmentId],
    )) as QueryResult<{ version: number }>;
    return result.rows[0] || null;
  }

  async createAuditForReaudit(
    assessmentId: string,
    certificateId: string,
    newVersion: number,
  ): Promise<Audit> {
    const result = (await this.db.query(
      `INSERT INTO audits (assessment_id, certificate_id, version)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [assessmentId, certificateId, newVersion],
    )) as QueryResult<Audit>;
    return result.rows[0];
  }

  async getAssessmentInfo(assessmentId: string): Promise<{
    id: string;
    certificate_id: string;
    certificate_name: string;
    organization_id: string;
    organization_name: string;
    status: string;
    assessment_type: string;
    branch_id: string | null;
    assigned_auditor_id: string | null;
    assigned_reviewer_id: string | null;
    audit_date: Date | null;
    validity_days: number;
    validity_months: number;
    validity_years: number;
    requested_reviewer_is_true: boolean;
    requested_reviewer_name: string | null;
    requested_reviewer_date: Date | null;
  } | null> {
    const result = (await this.db.query(
      `SELECT
         ca.id,
         ca.certificate_id,
         c.name            AS certificate_name,
         ca.organization_id,
         o.name            AS organization_name,
         ca.status,
         ca.assessment_type,
         ca.branch_id,
         ca.assigned_auditor_id,
         ca.assigned_reviewer_id,
         ca.audit_date,
         COALESCE(c.validity_days,   0) AS validity_days,
         COALESCE(c.validity_months, 0) AS validity_months,
         COALESCE(c.validity_years,  0) AS validity_years,
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
       FROM certificate_assessments ca
       JOIN certificates  c ON c.id = ca.certificate_id
       JOIN organization  o ON o.id = ca.organization_id
       LEFT JOIN LATERAL (
         SELECT ai.status, ai.invited_by, ai.created_at FROM assessment_invitations ai
         WHERE ai.assessment_id = ca.id
         ORDER BY ai.created_at DESC LIMIT 1
       ) latest_inv ON true
       LEFT JOIN reviewer inv_u_profile ON inv_u_profile.user_id = latest_inv.invited_by
       WHERE ca.id = $1`,
      [assessmentId],
    )) as QueryResult<{
      id: string;
      certificate_id: string;
      certificate_name: string;
      organization_id: string;
      organization_name: string;
      status: string;
      assessment_type: string;
      branch_id: string | null;
      assigned_auditor_id: string | null;
      assigned_reviewer_id: string | null;
      audit_date: Date | null;
      validity_days: number;
      validity_months: number;
      validity_years: number;
      requested_reviewer_is_true: boolean;
      requested_reviewer_name: string | null;
      requested_reviewer_date: Date | null;
    }>;
    return result.rows[0] || null;
  }

  async getQuestionsWithAuditData(
    assessmentId: string,
    certificateId: string,
    organizationId: string,
    assessmentType: string,
  ): Promise<AuditQuestionRow[]> {
    const result = (await this.db.query(
      `WITH sd_ca AS (
         SELECT CASE
           WHEN $4 = 'self_disclosure' THEN $3::uuid
           ELSE (
             SELECT id FROM certificate_assessments
             WHERE organization_id = $2
               AND certificate_id  = $1
               AND assessment_type = 'self_disclosure'
             AND status          IN ('submitted', 'ai_reviewing', 'completed')
             ORDER BY completed_at DESC
             LIMIT 1
           )
         END AS id
       )
       SELECT
         ms.id                        AS main_section_id,
         ms.name                      AS main_section_name,
         ms.short_code                AS main_section_short_code,
         COALESCE(ms.rank, 0)         AS main_section_rank,
         s.id                         AS section_id,
         s.name                       AS section_name,
         s.short_code                 AS section_short_code,
         COALESCE(s.rank, 0)          AS section_rank,
         ss.id                        AS sub_section_id,
         ss.name                      AS sub_section_name,
         ss.short_code                AS sub_section_short_code,
         ss.rank                      AS sub_section_rank,
         q.id                         AS question_id,
         q.question                   AS question_text,
         q.short_code                 AS question_short_code,
         q.type                       AS question_type,
         q.is_third_level,
         COALESCE(q.rank, 0)          AS question_rank,
         aq.id                        AS answer_id,
         aq.response_type,
         aq.response_value,
         aq.response_files,
         aq.reviewer_notes,
         aq.auditor_notes,
         ar.is_flagged,
         ar.flag_reason,
         ar.confidence_score,
         ar.risk_level,
         ar.category,
         ar.summary,
         ar.ai_suggestion
       FROM questions q
       JOIN main_section ms ON ms.id = q.main_section_id
       JOIN sections     s  ON s.id  = q.section_id
       LEFT JOIN sub_section ss ON ss.id = q.sub_section_id
       LEFT JOIN assessment_queries aq
         ON aq.question_id = q.id
        AND aq.certificate_assessment_id = (SELECT id FROM sd_ca)
       LEFT JOIN ai_reviews ai ON ai.certificate_assessment_id = (SELECT id FROM sd_ca)
       LEFT JOIN ai_responses ar
         ON ar.assessment_query_id = aq.id AND ar.ai_review_id = ai.id
       WHERE q.certificate_id = $1
       ORDER BY
         COALESCE(ms.rank, 0),
         COALESCE(s.rank, 0),
         COALESCE(ss.rank, 0),
         COALESCE(q.rank, 0)`,
      [certificateId, organizationId, assessmentId, assessmentType],
    )) as QueryResult<AuditQuestionRow>;
    return result.rows;
  }

  async getQuestionContext(
    questionId: string,
    assessmentId: string,
  ): Promise<{
    question_text: string;
    question_short_code: string | null;
    question_type: string;
    main_section_name: string;
    section_name: string;
    sub_section_name: string | null;
    response_value: string | null;
    response_type: string | null;
  } | null> {
    const result = (await this.db.query(
      `SELECT
         q.question       AS question_text,
         q.short_code     AS question_short_code,
         q.type           AS question_type,
         ms.name          AS main_section_name,
         s.name           AS section_name,
         ss.name          AS sub_section_name,
         aq.response_value,
         aq.response_type
       FROM questions q
       JOIN main_section ms ON ms.id = q.main_section_id
       JOIN sections     s  ON s.id  = q.section_id
       LEFT JOIN sub_section ss ON ss.id = q.sub_section_id
       LEFT JOIN assessment_queries aq
         ON aq.question_id = q.id
        AND aq.certificate_assessment_id = $2
       WHERE q.id = $1
       LIMIT 1`,
      [questionId, assessmentId],
    )) as QueryResult<{
      question_text: string;
      question_short_code: string | null;
      question_type: string;
      main_section_name: string;
      section_name: string;
      sub_section_name: string | null;
      response_value: string | null;
      response_type: string | null;
    }>;
    return result.rows[0] || null;
  }

  async findQueryByQuestionAndAssessment(
    questionId: string,
    assessmentId: string,
    assessmentType: string,
  ): Promise<{
    id: string;
    certificate_assessment_id: string;
    question_id: string;
    reviewer_notes: string | null;
    auditor_notes: string | null;
  } | null> {
    const result = (await this.db.query(
      `SELECT aq.id, aq.certificate_assessment_id, aq.question_id,
              aq.reviewer_notes, aq.auditor_notes
       FROM assessment_queries aq
       JOIN certificate_assessments target ON target.id = $2
       JOIN certificate_assessments source ON source.id = aq.certificate_assessment_id
       WHERE aq.question_id = $1
         AND (
           ($3 = 'self_disclosure' AND source.id = $2)
           OR
           ($3 != 'self_disclosure'
            AND source.organization_id = target.organization_id
            AND source.certificate_id  = target.certificate_id
            AND source.assessment_type = 'self_disclosure'
            AND source.status          = 'completed')
         )
       ORDER BY source.completed_at DESC
       LIMIT 1`,
      [questionId, assessmentId, assessmentType],
    )) as QueryResult<{
      id: string;
      certificate_assessment_id: string;
      question_id: string;
      reviewer_notes: string | null;
      auditor_notes: string | null;
    }>;
    return result.rows[0] || null;
  }

  async updateReviewerNotes(
    queryId: string,
    reviewerNotes: string,
  ): Promise<{ id: string; reviewer_notes: string | null; updated_at: Date }> {
    const result = (await this.db.query(
      `UPDATE assessment_queries
       SET reviewer_notes = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, reviewer_notes, updated_at`,
      [queryId, reviewerNotes],
    )) as QueryResult<{
      id: string;
      reviewer_notes: string | null;
      updated_at: Date;
    }>;
    return result.rows[0];
  }

  async updateAuditorNotes(
    queryId: string,
    auditorNotes: string,
  ): Promise<{ id: string; auditor_notes: string | null; updated_at: Date }> {
    const result = (await this.db.query(
      `UPDATE assessment_queries
       SET auditor_notes = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, auditor_notes, updated_at`,
      [queryId, auditorNotes],
    )) as QueryResult<{
      id: string;
      auditor_notes: string | null;
      updated_at: Date;
    }>;
    return result.rows[0];
  }

  async createComplianceAction(data: {
    assessmentId: string;
    questionId: string;
    actionType: 'non_compliant' | 'request_clarification' | 'compliant';
    message: string;
    createdBy: string;
    createdByRole: string;
    chatMessageId: string | null;
    clarificationTarget?: 'applicant' | 'reviewer' | null;
  }): Promise<ComplianceAction> {
    const result = (await this.db.query(
      `INSERT INTO compliance_actions
         (assessment_id, question_id, action_type, message, created_by, created_by_role, chat_message_id, clarification_target)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING
         id,
         assessment_id        AS "assessmentId",
         question_id          AS "questionId",
         action_type          AS "actionType",
         message,
         created_by           AS "createdBy",
         created_by_role      AS "createdByRole",
         chat_message_id      AS "chatMessageId",
         clarification_target AS "clarificationTarget",
         created_at           AS "createdAt"`,
      [
        data.assessmentId,
        data.questionId,
        data.actionType,
        data.message,
        data.createdBy,
        data.createdByRole,
        data.chatMessageId,
        data.clarificationTarget ?? null,
      ],
    )) as QueryResult<ComplianceAction>;
    return result.rows[0];
  }

  async getAssignedReviewerUserId(
    assessmentId: string,
  ): Promise<string | null> {
    // certificate_assessments.assigned_reviewer_id stores the user's UUID
    // directly (set by assignReviewer with reviewerUserId), NOT the
    // reviewer profile id. Reading the column directly is correct;
    // an earlier version JOINed reviewer ON r.id = ca.assigned_reviewer_id
    // which never matched and made downstream features (e.g. auditor
    // request_clarification) wrongly throw "No reviewer assigned".
    const result = (await this.db.query(
      `SELECT ca.assigned_reviewer_id AS user_id
       FROM certificate_assessments ca
       WHERE ca.id = $1`,
      [assessmentId],
    )) as QueryResult<{ user_id: string | null }>;
    return result.rows[0]?.user_id || null;
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
   * If the assessment has a branch_id, returns branch employees + org owner.
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

  async blockAssessmentCertificate(
    assessmentId: string,
    reason: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE certificate_assessments
       SET is_certificate_blocked = TRUE,
           certificate_block_reason = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [assessmentId, reason],
    );
  }

  async setAssessmentCompleted(assessmentId: string): Promise<void> {
    await this.db.query(
      `UPDATE certificate_assessments
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [assessmentId],
    );
  }

  async createAiAuditScore(data: {
    assessmentId: string;
    auditId: string;
    aiScore: number;
    aiReasoning: string;
    promptVersion: string;
    modelUsed: string;
  }): Promise<AiAuditScore> {
    const result = (await this.db.query(
      `INSERT INTO ai_audit_scores
         (assessment_id, audit_id, ai_score, ai_reasoning, prompt_version, model_used)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.assessmentId,
        data.auditId,
        data.aiScore,
        data.aiReasoning,
        data.promptVersion,
        data.modelUsed,
      ],
    )) as QueryResult<AiAuditScore>;
    return result.rows[0];
  }

  async findLatestAiAuditScore(
    assessmentId: string,
  ): Promise<AiAuditScore | null> {
    const result = (await this.db.query(
      `SELECT * FROM ai_audit_scores
       WHERE assessment_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [assessmentId],
    )) as QueryResult<AiAuditScore>;
    return result.rows[0] || null;
  }

  async updateAuditScores(auditId: string, score: number): Promise<void> {
    await this.db.query(
      `UPDATE audits
       SET score = $2, review_score = $2, updated_at = NOW()
       WHERE id = $1 AND is_archived = FALSE`,
      [auditId, score],
    );
  }

  async createAuditOnAssignment(
    assessmentId: string,
    certificateId: string,
    assignedAuditorId: string,
  ): Promise<Audit> {
    // Carry over assigned_reviewer_id from certificate_assessments if the
    // reviewer was assigned before the auditor — keeps the audits row in
    // sync with the authoritative certificate_assessments source.
    const result = (await this.db.query(
      `INSERT INTO audits (assessment_id, certificate_id, assigned_auditor_id, assigned_reviewer_id)
       SELECT $1, $2, $3, ca.assigned_reviewer_id
       FROM certificate_assessments ca
       WHERE ca.id = $1
       ON CONFLICT (assessment_id) WHERE is_archived = FALSE DO UPDATE SET
         assigned_auditor_id = EXCLUDED.assigned_auditor_id,
         assigned_reviewer_id = COALESCE(audits.assigned_reviewer_id, EXCLUDED.assigned_reviewer_id),
         updated_at = NOW()
       RETURNING *`,
      [assessmentId, certificateId, assignedAuditorId],
    )) as QueryResult<Audit>;
    return result.rows[0];
  }

  async setAssignedReviewer(
    assessmentId: string,
    reviewerUserId: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO audits (assessment_id, assigned_reviewer_id)
       VALUES ($1, $2)
       ON CONFLICT (assessment_id) WHERE is_archived = FALSE DO UPDATE SET
         assigned_reviewer_id = EXCLUDED.assigned_reviewer_id,
         updated_at = NOW()`,
      [assessmentId, reviewerUserId],
    );
  }

  async setAuditLifecycleStatus(
    assessmentId: string,
    status:
      | 'in_progress'
      | 'auditor_submitted'
      | 'reviewer_submitted'
      | 'completed',
  ): Promise<void> {
    await this.db.query(
      `UPDATE audits SET audit_lifecycle_status = $2::audit_lifecycle_status, updated_at = NOW()
       WHERE assessment_id = $1 AND is_archived = FALSE`,
      [assessmentId, status],
    );
  }

  async findAuditorUserIdByProfileId(
    profileId: string,
  ): Promise<string | null> {
    const result = (await this.db.query(
      `SELECT user_id FROM auditor WHERE id = $1`,
      [profileId],
    )) as QueryResult<{ user_id: string }>;
    return result.rows[0]?.user_id ?? null;
  }

  async findAuditorAudits(
    auditorUserId: string,
    computedStatusFilter?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<AuditorAuditsPaginatedResult> {
    const offset = (page - 1) * limit;
    const params: (string | number)[] = [auditorUserId];
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
           END AS computed_status
         FROM audits a
         JOIN certificate_assessments ca ON ca.id = a.assessment_id
         JOIN certificates c ON c.id = ca.certificate_id
         JOIN organization o ON o.id = ca.organization_id
         WHERE a.assigned_auditor_id = $1
           AND a.is_archived = FALSE
       )`;

    const countResult = (await this.db.query(
      `${baseCte}
       SELECT COUNT(*)::int AS total
       FROM audit_data
       ${statusFilter}`,
      params,
    )) as QueryResult<{ total: number }>;

    const total = countResult.rows[0]?.total ?? 0;
    const limitParamIndex = computedStatusFilter ? 3 : 2;
    const offsetParamIndex = computedStatusFilter ? 4 : 3;
    const dataParams = [...params, limit, offset];

    const result = (await this.db.query(
      `${baseCte}
       SELECT * FROM audit_data
       ${statusFilter}
       ORDER BY audit_updated_at DESC
       LIMIT $${limitParamIndex}
       OFFSET $${offsetParamIndex}`,
      dataParams,
    )) as QueryResult<AuditorAuditRow>;

    return {
      items: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

}
