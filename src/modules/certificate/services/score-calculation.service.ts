import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { QueryResult } from '../../../common/types/database.types';

export interface QuestionScoreInput {
  questionId: string;
  questionType: string;
  score: number;
  yesScore: number | null;
  noScore: number | null;
  aiReviewEnabled: boolean;
  aiReviewScore: number | null;
  isFlagged: boolean;
  confidenceScore: number | null;
  responseValue: string | null;
}

export interface CertificateScoreResult {
  earnedScore: number;
  maxScore: number;
  finalPercentage: number;
}

export interface ScoreAggregateItem {
  earnedScore: number;
  maxScore: number;
}

export interface BadgeAssignmentResult {
  badgeId: string | null;
  badgeName: string | null;
}

@Injectable()
export class ScoreCalculationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * AI-reviewed question: earned = (confidence / 100) * question_score
   * If flagged/rejected: earned = 0
   */
  calculateAiQuestionScore(
    questionScore: number,
    confidenceScore: number | null,
    isFlagged: boolean,
  ): number {
    if (isFlagged) return 0;
    // Clamp confidence to [0,100] so a malformed/over-100 AI confidence can never
    // earn more than the question's max score.
    const confidence = Math.max(0, Math.min(100, confidenceScore ?? 100));
    return (confidence / 100) * questionScore;
  }

  /**
   * Boolean question: earned = yes_score or no_score based on answer
   */
  calculateBooleanQuestionScore(
    yesScore: number | null,
    noScore: number | null,
    responseValue: string | null,
  ): number {
    if (!responseValue) return 0;
    const answer = responseValue.toLowerCase().trim();
    if (answer === 'yes') return yesScore ?? 0;
    if (answer === 'no') return noScore ?? 0;
    return 0;
  }

  /**
   * Manual (non-AI) question: earned = score if correct, 0 if incorrect/empty
   * For non-boolean types: any non-empty answer = full score
   */
  calculateQuestionScore(input: QuestionScoreInput): number {
    const { questionType, score, yesScore, noScore, aiReviewEnabled,
      isFlagged, confidenceScore, responseValue } = input;

    if (questionType === 'boolean') {
      if (aiReviewEnabled) {
        return this.calculateAiQuestionScore(score, confidenceScore, isFlagged);
      }
      return this.calculateBooleanQuestionScore(yesScore, noScore, responseValue);
    }

    if (aiReviewEnabled) {
      return this.calculateAiQuestionScore(score, confidenceScore, isFlagged);
    }

    // Manual non-boolean: full score if answered
    if (!responseValue || responseValue.trim() === '') return 0;
    return score;
  }

  /**
   * Max score for a question (what it's worth at 100%)
   */
  getQuestionMaxScore(input: Pick<QuestionScoreInput, 'questionType' | 'score' | 'yesScore' | 'noScore' | 'aiReviewScore' | 'aiReviewEnabled'>): number {
    const { questionType, score, yesScore, noScore, aiReviewEnabled } = input;

    // For a manually-scored boolean question the earned value is yes_score or
    // no_score (see calculateBooleanQuestionScore), so the MAX achievable is the
    // larger of the two — NOT `score`. Using `score` here let yes_score/no_score
    // values that exceed `score` push the total above 100%.
    if (questionType === 'boolean' && !aiReviewEnabled) {
      const best = Math.max(yesScore ?? 0, noScore ?? 0);
      return best > 0 ? best : score;
    }

    // AI-reviewed and manual non-boolean questions earn at most `score`.
    return score;
  }

  calculateSectionScore(questions: ScoreAggregateItem[]): CertificateScoreResult {
    return this.aggregateScores(questions);
  }

  calculateSubsectionScore(
    questions: ScoreAggregateItem[],
  ): CertificateScoreResult {
    return this.aggregateScores(questions);
  }

  /**
   * Certificate-level score calculation
   */
  calculateCertificateScore(
    questions: ScoreAggregateItem[],
  ): CertificateScoreResult {
    return this.aggregateScores(questions);
  }

  /**
   * final_percentage = (earned / max) * 100, rounded to 2 decimal places
   */
  calculateFinalPercentage(earnedScore: number, maxScore: number): number {
    if (maxScore === 0) return 0;
    const pct = (earnedScore / maxScore) * 100;
    // Defensive clamp to [0,100] so no data inconsistency can ever yield a
    // percentage outside the badge-tier ranges (which would leave it badge-less).
    const bounded = Math.max(0, Math.min(100, pct));
    return Math.round(bounded * 100) / 100;
  }

  /**
   * Assign badge based on final_percentage and certificate badge_colors config
   */
  async assignBadge(
    certificateId: string,
    finalPercentage: number,
    assessmentType?: string,
    organizationId?: string,
  ): Promise<BadgeAssignmentResult> {
    if (assessmentType === 'assured' && organizationId) {
      const assuredSlot = await this.getAssuredSlotForOrg(certificateId, organizationId);
      if (assuredSlot === null) return { badgeId: null, badgeName: null };

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
          [certificateId, finalPercentage, slot],
        )) as QueryResult<{ id: string; name: string }>;
        if (result.rows[0]) return { badgeId: result.rows[0].id, badgeName: result.rows[0].name };
      }
      return { badgeId: null, badgeName: null };
    }

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
      [certificateId, finalPercentage, assessmentType ?? null],
    )) as QueryResult<{ id: string; name: string }>;

    return result.rows[0]
      ? { badgeId: result.rows[0].id, badgeName: result.rows[0].name }
      : { badgeId: null, badgeName: null };
  }

  private async getAssuredSlotForOrg(
    certificateId: string,
    organizationId: string,
  ): Promise<number | null> {
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

    const color = result.rows[0]?.color;
    if (!color) return null;
    return color === '#CD7F32' ? 2 : 3;
  }

  /**
   * Build score inputs from AI review responses for a full assessment
   */
  buildScoreInputsFromAiResponses(
    questionsWithAnswers: Array<{
      id: string;
      question_type: string;
      score: number;
      yes_score: number | null;
      no_score: number | null;
      ai_review_enabled: boolean;
      ai_review_score: number | null;
      answer_id: string | null;
      response_value: string | null;
    }>,
    aiResponsesByAnswerId: Map<string, { is_flagged: boolean; confidence_score: number | null }>,
  ): Array<{ maxScore: number; earnedScore: number }> {
    return questionsWithAnswers.map((q) => {
      const aiResp = q.answer_id ? aiResponsesByAnswerId.get(q.answer_id) : undefined;
      const isFlagged = aiResp?.is_flagged ?? false;
      const confidenceScore = aiResp?.confidence_score ?? null;

      const input: QuestionScoreInput = {
        questionId: q.id,
        questionType: q.question_type,
        score: q.score,
        yesScore: q.yes_score,
        noScore: q.no_score,
        aiReviewEnabled: q.ai_review_enabled,
        aiReviewScore: q.ai_review_score,
        isFlagged,
        confidenceScore,
        responseValue: q.response_value,
      };

      return {
        maxScore: this.getQuestionMaxScore(input),
        earnedScore: this.calculateQuestionScore(input),
      };
    });
  }

  buildScoreInputsFromAnswers(
    questionsWithAnswers: Array<{
      id: string;
      question_type: string;
      score: number;
      yes_score: number | null;
      no_score: number | null;
      ai_review_enabled: boolean;
      ai_review_score: number | null;
      response_value: string | null;
    }>,
  ): ScoreAggregateItem[] {
    return questionsWithAnswers.map((q) => {
      const input: QuestionScoreInput = {
        questionId: q.id,
        questionType: q.question_type,
        score: q.score,
        yesScore: q.yes_score,
        noScore: q.no_score,
        aiReviewEnabled: q.ai_review_enabled,
        aiReviewScore: q.ai_review_score,
        isFlagged: false,
        confidenceScore: null,
        responseValue: q.response_value,
      };

      return {
        maxScore: this.getQuestionMaxScore(input),
        earnedScore: this.calculateQuestionScore(input),
      };
    });
  }

  private aggregateScores(items: ScoreAggregateItem[]): CertificateScoreResult {
    const maxScore = items.reduce((sum, item) => sum + item.maxScore, 0);
    const earnedScore = items.reduce((sum, item) => sum + item.earnedScore, 0);
    const finalPercentage = this.calculateFinalPercentage(earnedScore, maxScore);

    return {
      earnedScore: Math.round(earnedScore * 100) / 100,
      maxScore: Math.round(maxScore * 100) / 100,
      finalPercentage,
    };
  }
}
