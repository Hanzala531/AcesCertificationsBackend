import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

export interface OverviewAssessmentRow {
  id: string;
  organization_id: string;
  organization_name: string;
  branch_id: string | null;
  branch_name: string | null;
  certificate_id: string;
  certificate_name: string;
  assessment_type: 'self_disclosure' | 'assured';
  status: string;
  score: number | null;
  badge_name: string | null;
  submitted_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  /**
   * Total number of questions on the certificate. Populated only for
   * self-disclosure rows in the in-progress bucket; null otherwise.
   */
  total_questions: number | null;
  /**
   * Number of questions answered so far. Populated only for
   * self-disclosure rows in the in-progress bucket; null otherwise.
   */
  answered_questions: number | null;
  /**
   * answered_questions / total_questions * 100, rounded to an integer.
   * Populated only for self-disclosure rows in the in-progress bucket;
   * null otherwise.
   */
  answered_percent: number | null;
}

export interface OverviewIssuedCertRow {
  id: string;
  assessment_id: string;
  certificate_id: string;
  certificate_name: string;
  organization_id: string;
  organization_name: string;
  branch_id: string | null;
  branch_name: string | null;
  badge_name: string | null;
  badge_color: string | null;
  certificate_number: string;
  review_score: number | null;
  issued_at: Date;
  expiry_date: Date | null;
  is_blocked: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

@Injectable()
export class CertificationOverviewRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * IN_PROGRESS: Assessments that are still part of the certification journey,
   * and where no active issued certificate exists for that cert+org+branch combo.
   * A completed assessment stays here only if it earned a qualifying badge.
   * Completed assessments with no badge are treated as failed instead.
   */
  async getInProgressAssessments(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<OverviewAssessmentRow>> {
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM certificate_assessments ca
      WHERE ca.organization_id = $1
        AND ca.status NOT IN ('failed', 'rejected')
        AND NOT (
          ca.status = 'completed'
          AND ca.badge_id IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM issued_certificates ic
          WHERE ic.organization_id = ca.organization_id
            AND ic.certificate_id = ca.certificate_id
            AND (ic.branch_id = ca.branch_id OR (ic.branch_id IS NULL AND ca.branch_id IS NULL))
            AND ic.is_blocked = false
            AND (ic.expiry_date IS NULL OR ic.expiry_date >= NOW())
        )
    `;

    const dataQuery = `
      SELECT
        ca.id,
        ca.organization_id,
        o.name AS organization_name,
        ca.branch_id,
        b.name AS branch_name,
        ca.certificate_id,
        c.name AS certificate_name,
        ca.assessment_type,
        CASE
          WHEN ca.status IN ('submitted', 'ai_reviewing')
            AND ar.review_status = 'completed'
            AND COALESCE(ca.score, ar.score) IS NOT NULL
          THEN 'completed'
          ELSE ca.status
        END AS status,
        ca.score,
        bg.name AS badge_name,
        ca.submitted_at,
        CASE
          WHEN ca.completed_at IS NOT NULL THEN ca.completed_at
          WHEN ca.status IN ('submitted', 'ai_reviewing')
            AND ar.review_status = 'completed'
          THEN ar.completed_at
          ELSE ca.completed_at
        END AS completed_at,
        ca.created_at,
        ca.updated_at,
        -- Applicable questions = top-level questions + sub-questions whose parent
        --   boolean was answered with the matching trigger value.
        -- Sub-questions only "exist" for an in-progress assessment once the user
        --   has answered the parent question accordingly, so the denominator is
        --   dynamic per assessment.
        CASE WHEN ca.assessment_type = 'self_disclosure'
          THEN (
            SELECT COUNT(*)::int
            FROM questions q
            WHERE q.certificate_id = ca.certificate_id
              AND (
                q.parent_question_id IS NULL
                OR EXISTS (
                  SELECT 1 FROM assessment_queries pa
                  WHERE pa.certificate_assessment_id = ca.id
                    AND pa.question_id = q.parent_question_id
                    AND LOWER(pa.response_value) = LOWER(q.parent_trigger_value)
                )
              )
          )
          ELSE NULL
        END AS total_questions,
        CASE WHEN ca.assessment_type = 'self_disclosure'
          THEN (SELECT COUNT(*)::int FROM assessment_queries aq WHERE aq.certificate_assessment_id = ca.id)
          ELSE NULL
        END AS answered_questions,
        CASE
          WHEN ca.assessment_type != 'self_disclosure' THEN NULL
          -- Any post-submission status is by definition 100% complete
          WHEN ca.status IN ('submitted', 'ai_reviewing', 'completed') THEN 100
          ELSE (
            SELECT CASE
              WHEN applicable.cnt = 0 THEN 0
              ELSE LEAST(100, ROUND(answered.cnt::numeric * 100.0 / applicable.cnt))::int
            END
            FROM (
              SELECT COUNT(*) AS cnt
              FROM questions q
              WHERE q.certificate_id = ca.certificate_id
                AND (
                  q.parent_question_id IS NULL
                  OR EXISTS (
                    SELECT 1 FROM assessment_queries pa
                    WHERE pa.certificate_assessment_id = ca.id
                      AND pa.question_id = q.parent_question_id
                      AND LOWER(pa.response_value) = LOWER(q.parent_trigger_value)
                  )
                )
            ) applicable,
            (SELECT COUNT(*) AS cnt FROM assessment_queries aq WHERE aq.certificate_assessment_id = ca.id) answered
          )
        END AS answered_percent
      FROM certificate_assessments ca
      JOIN organization o ON o.id = ca.organization_id
      JOIN certificates c ON c.id = ca.certificate_id
      LEFT JOIN branches b ON b.id = ca.branch_id
      LEFT JOIN badges bg ON bg.id = ca.badge_id
      LEFT JOIN LATERAL (
        SELECT review_status, score, completed_at
        FROM ai_reviews
        WHERE certificate_assessment_id = ca.id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ar ON TRUE
      WHERE ca.organization_id = $1
        AND ca.status NOT IN ('failed', 'rejected')
        AND NOT (
          ca.status = 'completed'
          AND ca.badge_id IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM issued_certificates ic
          WHERE ic.organization_id = ca.organization_id
            AND ic.certificate_id = ca.certificate_id
            AND (ic.branch_id = ca.branch_id OR (ic.branch_id IS NULL AND ca.branch_id IS NULL))
            AND ic.is_blocked = false
            AND (ic.expiry_date IS NULL OR ic.expiry_date >= NOW())
        )
      ORDER BY ca.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [countRes, dataRes] = await Promise.all([
      this.db.query(countQuery, [organizationId]),
      this.db.query(dataQuery, [organizationId, limit, offset]),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);

    return {
      data: dataRes.rows as OverviewAssessmentRow[],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /**
   * ACTIVE: Issued certificates that are not expired and not blocked.
   */
  async getActiveCertificates(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<OverviewIssuedCertRow>> {
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM issued_certificates ic
      WHERE ic.organization_id = $1
        AND ic.is_blocked = false
        AND (ic.expiry_date IS NULL OR ic.expiry_date >= NOW())
    `;

    const dataQuery = `
      SELECT
        ic.id,
        ic.assessment_id,
        ic.certificate_id,
        ic.certificate_name,
        ic.organization_id,
        o.name AS organization_name,
        ic.branch_id,
        b.name AS branch_name,
        ic.badge_name,
        ic.badge_color,
        ic.certificate_number,
        ic.review_score,
        ic.issued_at,
        ic.expiry_date,
        ic.is_blocked
      FROM issued_certificates ic
      JOIN organization o ON o.id = ic.organization_id
      LEFT JOIN branches b ON b.id = ic.branch_id
      WHERE ic.organization_id = $1
        AND ic.is_blocked = false
        AND (ic.expiry_date IS NULL OR ic.expiry_date >= NOW())
      ORDER BY ic.issued_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [countRes, dataRes] = await Promise.all([
      this.db.query(countQuery, [organizationId]),
      this.db.query(dataQuery, [organizationId, limit, offset]),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);

    return {
      data: dataRes.rows as OverviewIssuedCertRow[],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /**
   * FAILED: Assessments that explicitly failed/rejected, or completed without
   * earning any badge threshold. Excludes those where a valid issued
   * certificate now exists (i.e., the applicant later succeeded).
   */
  async getFailedAssessments(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<OverviewAssessmentRow>> {
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM certificate_assessments ca
      WHERE ca.organization_id = $1
        AND (
          ca.status IN ('failed', 'rejected')
          OR (
            ca.status = 'completed'
            AND ca.badge_id IS NULL
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM issued_certificates ic
          WHERE ic.organization_id = ca.organization_id
            AND ic.certificate_id = ca.certificate_id
            AND (ic.branch_id = ca.branch_id OR (ic.branch_id IS NULL AND ca.branch_id IS NULL))
            AND ic.is_blocked = false
            AND (ic.expiry_date IS NULL OR ic.expiry_date >= NOW())
        )
    `;

    const dataQuery = `
      SELECT
        ca.id,
        ca.organization_id,
        o.name AS organization_name,
        ca.branch_id,
        b.name AS branch_name,
        ca.certificate_id,
        c.name AS certificate_name,
        ca.assessment_type,
        ca.status,
        ca.score,
        bg.name AS badge_name,
        ca.submitted_at,
        ca.completed_at,
        ca.created_at,
        ca.updated_at,
        NULL::int AS total_questions,
        NULL::int AS answered_questions,
        NULL::int AS answered_percent
      FROM certificate_assessments ca
      JOIN organization o ON o.id = ca.organization_id
      JOIN certificates c ON c.id = ca.certificate_id
      LEFT JOIN branches b ON b.id = ca.branch_id
      LEFT JOIN badges bg ON bg.id = ca.badge_id
      WHERE ca.organization_id = $1
        AND (
          ca.status IN ('failed', 'rejected')
          OR (
            ca.status = 'completed'
            AND ca.badge_id IS NULL
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM issued_certificates ic
          WHERE ic.organization_id = ca.organization_id
            AND ic.certificate_id = ca.certificate_id
            AND (ic.branch_id = ca.branch_id OR (ic.branch_id IS NULL AND ca.branch_id IS NULL))
            AND ic.is_blocked = false
            AND (ic.expiry_date IS NULL OR ic.expiry_date >= NOW())
        )
      ORDER BY ca.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [countRes, dataRes] = await Promise.all([
      this.db.query(countQuery, [organizationId]),
      this.db.query(dataQuery, [organizationId, limit, offset]),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);

    return {
      data: dataRes.rows as OverviewAssessmentRow[],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /**
   * EXPIRED: Issued certificates whose expiry_date has passed and are not blocked.
   */
  async getExpiredCertificates(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<OverviewIssuedCertRow>> {
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM issued_certificates ic
      WHERE ic.organization_id = $1
        AND ic.is_blocked = false
        AND ic.expiry_date IS NOT NULL
        AND ic.expiry_date < NOW()
    `;

    const dataQuery = `
      SELECT
        ic.id,
        ic.assessment_id,
        ic.certificate_id,
        ic.certificate_name,
        ic.organization_id,
        o.name AS organization_name,
        ic.branch_id,
        b.name AS branch_name,
        ic.badge_name,
        ic.badge_color,
        ic.certificate_number,
        ic.review_score,
        ic.issued_at,
        ic.expiry_date,
        ic.is_blocked
      FROM issued_certificates ic
      JOIN organization o ON o.id = ic.organization_id
      LEFT JOIN branches b ON b.id = ic.branch_id
      WHERE ic.organization_id = $1
        AND ic.is_blocked = false
        AND ic.expiry_date IS NOT NULL
        AND ic.expiry_date < NOW()
      ORDER BY ic.expiry_date DESC
      LIMIT $2 OFFSET $3
    `;

    const [countRes, dataRes] = await Promise.all([
      this.db.query(countQuery, [organizationId]),
      this.db.query(dataQuery, [organizationId, limit, offset]),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);

    return {
      data: dataRes.rows as OverviewIssuedCertRow[],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 0,
      },
    };
  }
}
