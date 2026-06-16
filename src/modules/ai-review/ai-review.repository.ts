import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { QueryResult } from '../../common/types/database.types';

export interface AiReview {
  id: string;
  certificate_assessment_id: string;
  review_description: string | null;
  review_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_flags: number;
  score: number | null;
  flag_status?: 'open' | 'pending' | 'escalated' | 'resolved';
  started_at: Date | null;
  completed_at: Date | null;
  is_reviewer_assigned: boolean;
  is_admin_approved?: boolean;
  admin_approved_by?: string | null;
  admin_approved_at?: Date | null;
  original_score?: number | null;
  adjusted_score?: number | null;
  admin_approval_reason?: string | null;
  escalated_by?: string | null;
  escalated_at?: Date | null;
  escalation_reason?: string | null;
  improve_requested_by?: string | null;
  improve_requested_at?: Date | null;
  improve_message?: string | null;
  reviewer_adjusted_score?: number | null;
  reviewer_submitted_by?: string | null;
  reviewer_submitted_at?: Date | null;
  earned_score?: number | null;
  max_score?: number | null;
  final_percentage?: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface AiResponse {
  id: string;
  assessment_query_id: string;
  ai_review_id: string;
  response: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  confidence_score: number | null;
  risk_level?: 'low' | 'medium' | 'high' | null;
  category?: string | null;
  summary?: string | null;
  ai_suggestion?: string | null;
  applicant_answer?: string | null;
  is_question_approved?: boolean;
  reviewer_action?: 'accepted' | 'rejected' | null;
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
  created_at: Date;
}

export interface AiResponseWithQuestion extends AiResponse {
  question_text?: string;
  question_short_code?: string | null;
  question_type?: string;
  response_type?: string;
  response_value?: string;
}

@Injectable()
export class AiReviewRepository {
  constructor(private readonly db: DatabaseService) {}

  async createAiReview(assessmentId: string): Promise<AiReview> {
    const result = (await this.db.query(
      `INSERT INTO ai_reviews (certificate_assessment_id)
       VALUES ($1)
       RETURNING *`,
      [assessmentId],
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async findAiReviewByAssessmentId(
    assessmentId: string,
  ): Promise<AiReview | null> {
    const result = (await this.db.query(
      `SELECT *
       FROM ai_reviews
       WHERE certificate_assessment_id = $1
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [assessmentId],
    )) as QueryResult<AiReview>;
    return result.rows[0] || null;
  }

  async findAiReviewById(id: string): Promise<AiReview | null> {
    const result = (await this.db.query(
      `SELECT * FROM ai_reviews WHERE id = $1`,
      [id],
    )) as QueryResult<AiReview>;
    return result.rows[0] || null;
  }


  async updateAiReviewStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    description?: string,
  ): Promise<AiReview> {
    let extraFields = '';
    const params: (string | number)[] = [id, status];

    if (status === 'in_progress') {
      extraFields = ', started_at = NOW()';
    } else if (status === 'completed' || status === 'failed') {
      extraFields = ', completed_at = NOW()';
    }

    if (description) {
      params.push(description);
      extraFields += `, review_description = $${params.length}`;
    }

    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET review_status = $2${extraFields}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      params,
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  /**
   * Find assessments whose AI review is in the 'failed' state and are still
   * eligible for an automatic retry — i.e. under the attempt cap and past the
   * cooldown since their last retry. Ordered oldest-failure-first.
   */
  async findFailedAssessmentsForRetry(opts: {
    maxAttempts: number;
    cooldownMinutes: number;
    limit: number;
  }): Promise<
    Array<{ assessment_id: string; review_id: string; attempts: number }>
  > {
    const result = (await this.db.query(
      `SELECT ca.id AS assessment_id,
              ar.id AS review_id,
              ca.ai_review_attempts AS attempts
       FROM ai_reviews ar
       JOIN certificate_assessments ca ON ca.id = ar.certificate_assessment_id
       WHERE ar.review_status = 'failed'
         AND ca.ai_review_attempts < $1
         AND (
           ca.ai_review_last_attempt_at IS NULL
           OR ca.ai_review_last_attempt_at < NOW() - ($2 * INTERVAL '1 minute')
         )
       ORDER BY ar.updated_at ASC
       LIMIT $3`,
      [opts.maxAttempts, opts.cooldownMinutes, opts.limit],
    )) as QueryResult<{
      assessment_id: string;
      review_id: string;
      attempts: number;
    }>;
    return result.rows;
  }

  /** Increment the retry counter and stamp the attempt time on an assessment. */
  async recordRetryAttempt(assessmentId: string): Promise<void> {
    await this.db.query(
      `UPDATE certificate_assessments
       SET ai_review_attempts = ai_review_attempts + 1,
           ai_review_last_attempt_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [assessmentId],
    );
  }

  async updateTotalFlags(id: string, totalFlags: number): Promise<AiReview> {
    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET total_flags = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, totalFlags],
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async updateScore(id: string, score: number): Promise<AiReview> {
    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET score = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, score],
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async updateScoreSummary(
    id: string,
    data: {
      score: number;
      earned_score?: number | null;
      max_score?: number | null;
      final_percentage?: number | null;
    },
  ): Promise<AiReview> {
    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET score = $2,
           earned_score = $3,
           max_score = $4,
           final_percentage = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.score,
        data.earned_score ?? null,
        data.max_score ?? null,
        data.final_percentage ?? null,
      ],
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async createAiResponse(data: {
    assessment_query_id: string;
    ai_review_id: string;
    response?: string;
    is_flagged?: boolean;
    flag_reason?: string;
    confidence_score?: number;
    risk_level?: 'low' | 'medium' | 'high' | null;
    category?: string | null;
    summary?: string | null;
    applicant_answer?: string | null;
  }): Promise<AiResponse> {
    const result = (await this.db.query(
      `INSERT INTO ai_responses
       (assessment_query_id, ai_review_id, response, is_flagged, flag_reason, 
        confidence_score, risk_level, category, summary, applicant_answer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.assessment_query_id,
        data.ai_review_id,
        data.response || null,
        data.is_flagged || false,
        data.flag_reason || null,
        data.confidence_score || null,
        data.risk_level || null,
        data.category || null,
        data.summary || null,
        data.applicant_answer || null,
      ],
    )) as QueryResult<AiResponse>;
    return result.rows[0];
  }

  async findAiResponsesByReviewId(
    reviewId: string,
  ): Promise<AiResponseWithQuestion[]> {
    const result = (await this.db.query(
      `SELECT
         ar.*,
         q.question as question_text,
         q.short_code as question_short_code,
         q.type as question_type,
         aq.response_type,
         aq.response_value
       FROM ai_responses ar
       JOIN assessment_queries aq ON aq.id = ar.assessment_query_id
       JOIN questions q ON q.id = aq.question_id
       WHERE ar.ai_review_id = $1
       ORDER BY ar.created_at`,
      [reviewId],
    )) as QueryResult<AiResponseWithQuestion>;
    return result.rows;
  }

  async updateFlagStatus(
    reviewId: string,
    status: 'open' | 'pending' | 'escalated' | 'resolved',
  ): Promise<AiReview> {
    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET flag_status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [reviewId, status],
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async findAllAiFlags(params: {
    status?: 'open' | 'pending' | 'escalated' | 'resolved';
    limit?: number;
    offset?: number;
  }): Promise<{
    flags: Array<{
      id: string;
      organization_name: string;
      certificate_name: string;
      assessment_type: string;
      status: string;
      summary: string;
      flagged_at: Date;
      total_flags: number;
      risk_level: string | null;
      is_reviewer_assigned: boolean;
    }>;
    total: number;
  }> {
    const { status, limit = 25, offset = 0 } = params;

    let whereClause = 'WHERE ar.is_flagged = TRUE';
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND arv.flag_status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    const countResult = (await this.db.query(
      `SELECT COUNT(DISTINCT arv.id) as total
       FROM ai_reviews arv
       JOIN ai_responses ar ON ar.ai_review_id = arv.id
       JOIN certificate_assessments ca ON ca.id = arv.certificate_assessment_id
       ${whereClause}`,
      queryParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    queryParams.push(limit, offset);
    const result = (await this.db.query(
      `SELECT DISTINCT ON (arv.id)
         arv.id,
         ca.id as assessment_id,
         ca.certificate_id,
         o.name as organization_name,
         c.name as certificate_name,
         c.certificate_id as product_id,
         ca.assessment_type,
         COALESCE(arv.flag_status, 'open')::text as status,
         COALESCE(
           (SELECT summary FROM ai_responses WHERE ai_review_id = arv.id AND is_flagged = TRUE LIMIT 1),
           arv.review_description
         ) as summary,
         arv.created_at as flagged_at,
         arv.total_flags,
         arv.score as ai_score,
         (SELECT MAX(risk_level) FROM ai_responses WHERE ai_review_id = arv.id AND is_flagged = TRUE) as risk_level,
         arv.is_reviewer_assigned,
         arv.reviewer_submitted_at,
         ca.assigned_reviewer_id,
         rv.first_name || ' ' || rv.last_name as reviewer_name,
         ca.assigned_auditor_id,
         au.first_name || ' ' || au.last_name as auditor_name,
         au_user.email as auditor_email
       FROM ai_reviews arv
       JOIN certificate_assessments ca ON ca.id = arv.certificate_assessment_id
       JOIN organization o ON o.id = ca.organization_id
       JOIN certificates c ON c.id = ca.certificate_id
       JOIN ai_responses ar ON ar.ai_review_id = arv.id
       LEFT JOIN reviewer rv ON rv.user_id = ca.assigned_reviewer_id
       LEFT JOIN auditor au ON au.user_id = ca.assigned_auditor_id
       LEFT JOIN users au_user ON au_user.id = ca.assigned_auditor_id
       ${whereClause}
       ORDER BY arv.id, arv.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams,
    )) as QueryResult<{
      id: string;
      assessment_id: string;
      certificate_id: string;
      organization_name: string;
      certificate_name: string;
      product_id: string | null;
      assessment_type: string;
      status: string;
      summary: string;
      flagged_at: Date;
      total_flags: number;
      ai_score: number | null;
      risk_level: string | null;
      is_reviewer_assigned: boolean;
      reviewer_submitted_at: Date | null;
      assigned_reviewer_id: string | null;
      reviewer_name: string | null;
      assigned_auditor_id: string | null;
      auditor_name: string | null;
      auditor_email: string | null;
    }>;

    return {
      flags: result.rows,
      total,
    };
  }

  async findFlaggedAssessments(params: {
    limit?: number;
    offset?: number;
  }): Promise<{
    assessments: Array<{
      assessment_id: string;
      assessment_name: string;
      certificate_id: string;
      certificate_name: string;
      product_id: string | null;
      organization_id: string;
      organization_name: string;
      total_flags: number;
    }>;
    total: number;
  }> {
    const { limit = 25, offset = 0 } = params;

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total
       FROM certificate_assessments ca
       JOIN ai_reviews arv ON arv.certificate_assessment_id = ca.id
       WHERE arv.total_flags > 0`,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const result = (await this.db.query(
      `SELECT
         ca.id AS assessment_id,
         c.name AS assessment_name,
         ca.certificate_id,
         c.name AS certificate_name,
         c.certificate_id AS product_id,
         ca.organization_id,
         o.name AS organization_name,
         arv.total_flags,
         (SELECT COUNT(*) FROM questions q
          WHERE q.certificate_id = ca.certificate_id
         )::int AS total_questions,
         (SELECT COUNT(*) FROM assessment_queries aq
          WHERE aq.certificate_assessment_id = ca.id
            AND aq.response_value IS NOT NULL
            AND aq.response_value != ''
         )::int AS total_attempted
       FROM certificate_assessments ca
       JOIN ai_reviews arv ON arv.certificate_assessment_id = ca.id
       JOIN certificates c ON c.id = ca.certificate_id
       JOIN organization o ON o.id = ca.organization_id
       WHERE arv.total_flags > 0
       ORDER BY arv.total_flags DESC, arv.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    )) as QueryResult<{
      assessment_id: string;
      assessment_name: string;
      certificate_id: string;
      certificate_name: string;
      product_id: string | null;
      organization_id: string;
      organization_name: string;
      total_flags: number;
      total_questions: number;
      total_attempted: number;
    }>;

    return {
      assessments: result.rows,
      total,
    };
  }

  async findFlaggedResponses(
    reviewId: string,
  ): Promise<AiResponseWithQuestion[]> {
    const result = (await this.db.query(
      `SELECT
         ar.*,
         q.question as question_text,
         q.short_code as question_short_code,
         q.type as question_type,
         aq.response_type,
         aq.response_value
       FROM ai_responses ar
       JOIN assessment_queries aq ON aq.id = ar.assessment_query_id
       JOIN questions q ON q.id = aq.question_id
       WHERE ar.ai_review_id = $1 AND ar.is_flagged = TRUE
       ORDER BY ar.created_at`,
      [reviewId],
    )) as QueryResult<AiResponseWithQuestion>;
    return result.rows;
  }

  async findFlaggedResponsesByAssessmentId(
    assessmentId: string,
  ): Promise<AiResponseWithQuestion[]> {
    const result = (await this.db.query(
      `SELECT
         ar.*,
         q.question as question_text,
         q.short_code as question_short_code,
         q.type as question_type,
         aq.response_type,
         aq.response_value
       FROM ai_responses ar
       JOIN ai_reviews arv ON arv.id = ar.ai_review_id
       JOIN assessment_queries aq ON aq.id = ar.assessment_query_id
       JOIN questions q ON q.id = aq.question_id
       WHERE arv.certificate_assessment_id = $1 AND ar.is_flagged = TRUE
       ORDER BY ar.created_at`,
      [assessmentId],
    )) as QueryResult<AiResponseWithQuestion>;
    return result.rows;
  }

  async getAiResponseByQueryId(
    reviewId: string,
    queryId: string,
  ): Promise<AiResponse | null> {
    const result = (await this.db.query(
      `SELECT * FROM ai_responses
       WHERE ai_review_id = $1 AND assessment_query_id = $2`,
      [reviewId, queryId],
    )) as QueryResult<AiResponse>;
    return result.rows[0] || null;
  }

  async getAiResponseByQuestionId(
    assessmentId: string,
    questionId: string,
  ): Promise<AiResponseWithQuestion | null> {
    const result = (await this.db.query(
      `SELECT
         ar.*,
         q.question as question_text,
         q.short_code as question_short_code,
         q.type as question_type,
         q.hint,
         aq.response_type,
         aq.response_value
       FROM ai_responses ar
       JOIN ai_reviews arv ON arv.id = ar.ai_review_id
       JOIN assessment_queries aq ON aq.id = ar.assessment_query_id
       JOIN questions q ON q.id = aq.question_id
       WHERE arv.certificate_assessment_id = $1
         AND aq.question_id = $2
       LIMIT 1`,
      [assessmentId, questionId],
    )) as QueryResult<AiResponseWithQuestion>;
    return result.rows[0] || null;
  }

  async updateAiResponse(
    aiResponseId: string,
    data: {
      response?: string;
      is_flagged?: boolean;
      flag_reason?: string | null;
      confidence_score?: number | null;
      risk_level?: 'low' | 'medium' | 'high' | null;
      category?: string | null;
      summary?: string | null;
      applicant_answer?: string | null;
    },
  ): Promise<AiResponse> {
    const result = (await this.db.query(
      `UPDATE ai_responses
       SET response = $2,
           is_flagged = $3,
           flag_reason = $4,
           confidence_score = $5,
           risk_level = $6,
           category = $7,
           summary = $8,
           applicant_answer = $9
       WHERE id = $1
       RETURNING *`,
      [
        aiResponseId,
        data.response || null,
        data.is_flagged ?? false,
        data.flag_reason ?? null,
        data.confidence_score ?? null,
        data.risk_level ?? null,
        data.category ?? null,
        data.summary ?? null,
        data.applicant_answer ?? null,
      ],
    )) as QueryResult<AiResponse>;
    return result.rows[0];
  }

  async getAllResponsesByReviewId(reviewId: string): Promise<AiResponse[]> {
    const result = (await this.db.query(
      `SELECT * FROM ai_responses WHERE ai_review_id = $1`,
      [reviewId],
    )) as QueryResult<AiResponse>;
    return result.rows;
  }

  async setImproveRequested(
    reviewId: string,
    requestedBy: string,
    message: string,
  ): Promise<AiReview> {
    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET flag_status = 'pending',
           improve_requested_by = $2,
           improve_requested_at = NOW(),
           improve_message = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [reviewId, requestedBy, message],
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async adminApproveReview(
    reviewId: string,
    adminUserId: string,
    originalScore: number,
    adjustedScore: number,
    reason: string | null,
  ): Promise<AiReview> {
    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET is_admin_approved = TRUE,
           admin_approved_by = $2,
           admin_approved_at = NOW(),
           original_score = $3,
           adjusted_score = $4,
           admin_approval_reason = $5,
           score = $4,
           flag_status = 'resolved',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [reviewId, adminUserId, originalScore, adjustedScore, reason],
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async escalateReview(
    reviewId: string,
    escalatedBy: string,
    reason: string,
  ): Promise<AiReview> {
    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET flag_status = 'escalated',
           escalated_by = $2,
           escalated_at = NOW(),
           escalation_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [reviewId, escalatedBy, reason],
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async createAiResponsesBatch(
    responses: Array<{
      assessment_query_id: string;
      ai_review_id: string;
      response?: string;
      is_flagged?: boolean;
      flag_reason?: string;
      confidence_score?: number;
      risk_level?: 'low' | 'medium' | 'high' | null;
      category?: string | null;
      summary?: string | null;
      applicant_answer?: string | null;
    }>,
  ): Promise<AiResponse[]> {
    if (responses.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < responses.length; i++) {
      const offset = i * 10;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`,
      );
      values.push(
        responses[i].assessment_query_id,
        responses[i].ai_review_id,
        responses[i].response || null,
        responses[i].is_flagged || false,
        responses[i].flag_reason || null,
        responses[i].confidence_score ?? null,
        responses[i].risk_level || null,
        responses[i].category || null,
        responses[i].summary || null,
        responses[i].applicant_answer || null,
      );
    }

    const result = (await this.db.query(
      `INSERT INTO ai_responses
       (assessment_query_id, ai_review_id, response, is_flagged, flag_reason,
        confidence_score, risk_level, category, summary, applicant_answer)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values,
    )) as QueryResult<AiResponse>;
    return result.rows;
  }

  async findAiResponseByIdAndReviewId(
    responseId: string,
    reviewId: string,
  ): Promise<AiResponse | null> {
    const result = (await this.db.query(
      `SELECT * FROM ai_responses WHERE id = $1 AND ai_review_id = $2`,
      [responseId, reviewId],
    )) as QueryResult<AiResponse>;
    return result.rows[0] || null;
  }

  async approveQuestionResponse(responseId: string): Promise<AiResponse> {
    const result = (await this.db.query(
      `UPDATE ai_responses
       SET is_question_approved = TRUE
       WHERE id = $1
       RETURNING *`,
      [responseId],
    )) as QueryResult<AiResponse>;
    return result.rows[0];
  }

  async areAllFlaggedResponsesApproved(reviewId: string): Promise<boolean> {
    const result = (await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_flagged = TRUE)                              AS total_flagged,
         COUNT(*) FILTER (WHERE is_flagged = TRUE AND is_question_approved = TRUE) AS total_approved
       FROM ai_responses
       WHERE ai_review_id = $1`,
      [reviewId],
    )) as QueryResult<{ total_flagged: string; total_approved: string }>;
    const row = result.rows[0];
    const totalFlagged = parseInt(row.total_flagged, 10);
    const totalApproved = parseInt(row.total_approved, 10);
    return totalFlagged > 0 && totalFlagged === totalApproved;
  }

  async updateReviewerAssignedStatus(
    assessmentId: string,
    isAssigned: boolean,
  ): Promise<void> {
    await this.db.query(
      `UPDATE ai_reviews
       SET is_reviewer_assigned = $2, updated_at = NOW()
       WHERE certificate_assessment_id = $1`,
      [assessmentId, isAssigned],
    );
  }

  async updateAiResponsesBatch(
    updates: Array<{
      id: string;
      response?: string | null;
      is_flagged?: boolean;
      flag_reason?: string | null;
      confidence_score?: number | null;
      risk_level?: string | null;
      category?: string | null;
      summary?: string | null;
      applicant_answer?: string | null;
    }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < updates.length; i++) {
      const offset = i * 9;
      placeholders.push(
        `($${offset + 1}::uuid, $${offset + 2}, $${offset + 3}::boolean, $${offset + 4}, $${offset + 5}::numeric, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`,
      );
      values.push(
        updates[i].id,
        updates[i].response ?? null,
        updates[i].is_flagged ?? false,
        updates[i].flag_reason ?? null,
        updates[i].confidence_score ?? null,
        updates[i].risk_level ?? null,
        updates[i].category ?? null,
        updates[i].summary ?? null,
        updates[i].applicant_answer ?? null,
      );
    }

    await this.db.query(
      `UPDATE ai_responses AS ar SET
        response = v.response,
        is_flagged = v.is_flagged,
        flag_reason = v.flag_reason,
        confidence_score = v.confidence_score,
        risk_level = v.risk_level,
        category = v.category,
        summary = v.summary,
        applicant_answer = v.applicant_answer
      FROM (VALUES ${placeholders.join(', ')})
        AS v(id, response, is_flagged, flag_reason, confidence_score, risk_level, category, summary, applicant_answer)
      WHERE ar.id = v.id`,
      values,
    );
  }

  /**
   * Deletes an AI review and all its associated responses.
   * Used when AI review fails and needs to be completely cleaned up.
   */
  async deleteAiReview(reviewId: string): Promise<void> {
    // First delete all AI responses associated with this review
    await this.db.query(
      `DELETE FROM ai_responses WHERE ai_review_id = $1`,
      [reviewId],
    );

    // Then delete the AI review itself
    await this.db.query(
      `DELETE FROM ai_reviews WHERE id = $1`,
      [reviewId],
    );
  }

  // ── Reviewer flag review methods ──

  async reviewFlaggedResponse(
    responseId: string,
    reviewerId: string,
    action: 'accepted' | 'rejected',
    notes?: string | null,
  ): Promise<AiResponse> {
    const isAccepted = action === 'accepted';
    const result = (await this.db.query(
      `UPDATE ai_responses
       SET reviewer_action = $2,
           reviewer_notes = $3,
           reviewed_by = $4,
           reviewed_at = NOW(),
           is_question_approved = CASE WHEN $5 THEN TRUE ELSE is_question_approved END
       WHERE id = $1
       RETURNING *`,
      [responseId, action, notes || null, reviewerId, isAccepted],
    )) as QueryResult<AiResponse>;
    return result.rows[0];
  }

  async areAllFlaggedResponsesReviewed(reviewId: string): Promise<boolean> {
    const result = (await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_flagged = TRUE) AS total_flagged,
         COUNT(*) FILTER (WHERE is_flagged = TRUE AND reviewer_action IS NOT NULL) AS total_reviewed
       FROM ai_responses
       WHERE ai_review_id = $1`,
      [reviewId],
    )) as QueryResult<{ total_flagged: string; total_reviewed: string }>;
    const row = result.rows[0];
    const totalFlagged = parseInt(row.total_flagged, 10);
    const totalReviewed = parseInt(row.total_reviewed, 10);
    return totalFlagged > 0 && totalFlagged === totalReviewed;
  }

  async submitReviewerReview(
    reviewId: string,
    reviewerUserId: string,
    adjustedScore?: number | null,
  ): Promise<AiReview> {
    const params: unknown[] = [reviewId, reviewerUserId];
    let scoreClause = '';
    if (adjustedScore != null) {
      params.push(adjustedScore);
      scoreClause = `, reviewer_adjusted_score = $${params.length}`;
    }

    const result = (await this.db.query(
      `UPDATE ai_reviews
       SET reviewer_submitted_by = $2,
           reviewer_submitted_at = NOW()${scoreClause},
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      params,
    )) as QueryResult<AiReview>;
    return result.rows[0];
  }

  async findReviewerAssignedFlags(
    reviewerUserId: string,
    params: {
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    flags: Array<{
      review_id: string;
      assessment_id: string;
      certificate_id: string;
      certificate_name: string;
      organization_name: string;
      branch_name: string | null;
      product_id: string | null;
      assessment_type: string;
      ai_score: number | null;
      total_flags: number;
      flag_status: string;
      assigned_auditor_id: string | null;
      auditor_name: string | null;
      auditor_email: string | null;
      reviewer_submitted_at: Date | null;
      created_at: Date;
      updated_at: Date;
      total_questions: number;
      total_attempted: number;
    }>;
    total: number;
  }> {
    const { status, limit = 25, offset = 0 } = params;

    const queryParams: unknown[] = [reviewerUserId];
    let paramIndex = 2;
    let statusFilter = '';

    if (status) {
      statusFilter = ` AND COALESCE(arv.flag_status, 'open') = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total
       FROM ai_reviews arv
       JOIN certificate_assessments ca ON ca.id = arv.certificate_assessment_id
       WHERE ca.assigned_reviewer_id = $1
         AND arv.is_reviewer_assigned = TRUE
         ${statusFilter}`,
      queryParams,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    queryParams.push(limit, offset);
    const result = (await this.db.query(
      `SELECT
         arv.id AS review_id,
         ca.id AS assessment_id,
         ca.certificate_id,
         c.name AS certificate_name,
         o.name AS organization_name,
         b.name AS branch_name,
         c.certificate_id AS product_id,
         ca.assessment_type,
         arv.score AS ai_score,
         arv.total_flags,
         COALESCE(arv.flag_status, 'open') AS flag_status,
         ca.assigned_auditor_id,
         CONCAT(aud.first_name, ' ', aud.last_name) AS auditor_name,
         u_aud.email AS auditor_email,
         arv.reviewer_submitted_at,
         arv.created_at,
         arv.updated_at,
         (SELECT COUNT(*) FROM questions q
          WHERE q.certificate_id = ca.certificate_id
         )::int AS total_questions,
         (SELECT COUNT(*) FROM assessment_queries aq
          WHERE aq.certificate_assessment_id = ca.id
            AND aq.response_value IS NOT NULL
            AND aq.response_value != ''
         )::int AS total_attempted
       FROM ai_reviews arv
       JOIN certificate_assessments ca ON ca.id = arv.certificate_assessment_id
       JOIN certificates c ON c.id = ca.certificate_id
       JOIN organization o ON o.id = ca.organization_id
       LEFT JOIN branches b ON b.id = ca.branch_id
       LEFT JOIN auditor aud ON aud.user_id = ca.assigned_auditor_id
       LEFT JOIN users u_aud ON u_aud.id = ca.assigned_auditor_id
       WHERE ca.assigned_reviewer_id = $1
         AND arv.is_reviewer_assigned = TRUE
         ${statusFilter}
       ORDER BY arv.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams,
    )) as QueryResult<{
      review_id: string;
      assessment_id: string;
      certificate_id: string;
      certificate_name: string;
      organization_name: string;
      branch_name: string | null;
      product_id: string | null;
      assessment_type: string;
      ai_score: number | null;
      total_flags: number;
      flag_status: string;
      assigned_auditor_id: string | null;
      auditor_name: string | null;
      auditor_email: string | null;
      reviewer_submitted_at: Date | null;
      created_at: Date;
      updated_at: Date;
      total_questions: number;
      total_attempted: number;
    }>;

    return { flags: result.rows, total };
  }

  async findReviewerFlagDetails(
    reviewId: string,
    reviewerUserId: string,
  ): Promise<{
    review: AiReview;
    assessment_id: string;
    certificate_id: string;
    certificate_name: string;
    organization_name: string;
    branch_name: string | null;
    product_id: string | null;
    assigned_auditor_id: string | null;
    auditor_name: string | null;
    auditor_email: string | null;
    total_questions: number;
    total_attempted: number;
  } | null> {
    const result = (await this.db.query(
      `SELECT
         arv.*,
         ca.id AS assessment_id,
         ca.certificate_id,
         c.name AS certificate_name,
         o.name AS organization_name,
         b.name AS branch_name,
         c.certificate_id AS product_id,
         ca.assigned_auditor_id,
         CONCAT(aud.first_name, ' ', aud.last_name) AS auditor_name,
         u_aud.email AS auditor_email,
         (SELECT COUNT(*) FROM questions q
          WHERE q.certificate_id = ca.certificate_id
         )::int AS total_questions,
         (SELECT COUNT(*) FROM assessment_queries aq
          WHERE aq.certificate_assessment_id = ca.id
            AND aq.response_value IS NOT NULL
            AND aq.response_value != ''
         )::int AS total_attempted
       FROM ai_reviews arv
       JOIN certificate_assessments ca ON ca.id = arv.certificate_assessment_id
       JOIN certificates c ON c.id = ca.certificate_id
       JOIN organization o ON o.id = ca.organization_id
       LEFT JOIN branches b ON b.id = ca.branch_id
       LEFT JOIN auditor aud ON aud.user_id = ca.assigned_auditor_id
       LEFT JOIN users u_aud ON u_aud.id = ca.assigned_auditor_id
       WHERE arv.id = $1
         AND ca.assigned_reviewer_id = $2
         AND arv.is_reviewer_assigned = TRUE`,
      [reviewId, reviewerUserId],
    )) as QueryResult<
      AiReview & {
        assessment_id: string;
        certificate_id: string;
        certificate_name: string;
        organization_name: string;
        branch_name: string | null;
        product_id: string | null;
        assigned_auditor_id: string | null;
        auditor_name: string | null;
        auditor_email: string | null;
        total_questions: number;
        total_attempted: number;
      }
    >;

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      review: row,
      assessment_id: row.assessment_id,
      certificate_id: row.certificate_id,
      certificate_name: row.certificate_name,
      organization_name: row.organization_name,
      branch_name: row.branch_name,
      product_id: row.product_id,
      assigned_auditor_id: row.assigned_auditor_id,
      auditor_name: row.auditor_name,
      auditor_email: row.auditor_email,
      total_questions: row.total_questions,
      total_attempted: row.total_attempted,
    };
  }

  async getReviewerAcceptedResponseIds(reviewId: string): Promise<string[]> {
    const result = (await this.db.query(
      `SELECT id FROM ai_responses
       WHERE ai_review_id = $1 AND is_flagged = TRUE AND reviewer_action = 'accepted'`,
      [reviewId],
    )) as QueryResult<{ id: string }>;
    return result.rows.map((r) => r.id);
  }

  /**
   * Deletes an AI review by assessment ID and all its associated responses.
   * Used when AI review fails and needs to be completely cleaned up.
   */
  async deleteAiReviewByAssessmentId(assessmentId: string): Promise<void> {
    // First delete all AI responses for reviews associated with this assessment
    await this.db.query(
      `DELETE FROM ai_responses 
       WHERE ai_review_id IN (
         SELECT id FROM ai_reviews WHERE certificate_assessment_id = $1
       )`,
      [assessmentId],
    );

    // Then delete the AI review itself
    await this.db.query(
      `DELETE FROM ai_reviews WHERE certificate_assessment_id = $1`,
      [assessmentId],
    );
  }
}
