import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiReviewService } from './ai-review.service';
import { AiReviewRepository } from '../ai-review.repository';
import { AssessmentRepository } from '../../assessment/assessment.repository';

/**
 * Periodically re-runs AI reviews that ended in the 'failed' state.
 *
 * When an AI review fails, the analysis service reverts the submission and marks
 * the ai_reviews row 'failed' (rather than deleting it). This job sweeps those
 * failed reviews and re-drives them through the exact same path a real
 * submission uses — submit (status -> ai_reviewing) + triggerAiReview — so a
 * successful retry completes the assessment normally.
 *
 * Safeguards:
 *   - MAX_ATTEMPTS caps how many times one assessment is retried (prevents
 *     endless retries + notification spam on a permanently-failing assessment).
 *   - COOLDOWN_MINUTES spaces retries out and avoids re-picking one mid-flight.
 *   - BATCH_LIMIT bounds work per tick.
 *   - An in-process `running` flag prevents overlapping sweeps.
 */
@Injectable()
export class AiReviewRetryService {
  private readonly logger = new Logger('AiReviewRetry');

  /** Max automatic retries per assessment before giving up. */
  private readonly MAX_ATTEMPTS = 3;
  /** Minimum minutes between retries of the same assessment. */
  private readonly COOLDOWN_MINUTES = 10;
  /** Max assessments processed per sweep. */
  private readonly BATCH_LIMIT = 5;

  private running = false;

  constructor(
    private readonly aiReviewService: AiReviewService,
    private readonly aiReviewRepo: AiReviewRepository,
    private readonly assessmentRepo: AssessmentRepository,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'ai-review-retry-sweep' })
  async handleCron(): Promise<void> {
    await this.runSweep();
  }

  /**
   * Find failed-and-eligible assessments and retry each. Returns how many were
   * attempted. Safe to call manually (e.g. from a script).
   */
  async runSweep(): Promise<number> {
    if (this.running) {
      this.logger.warn('[AI Retry] Previous sweep still running — skipping tick');
      return 0;
    }
    this.running = true;
    try {
      const candidates = await this.aiReviewRepo.findFailedAssessmentsForRetry({
        maxAttempts: this.MAX_ATTEMPTS,
        cooldownMinutes: this.COOLDOWN_MINUTES,
        limit: this.BATCH_LIMIT,
      });

      if (candidates.length === 0) {
        this.logger.debug('[AI Retry] No failed AI reviews eligible for retry');
        return 0;
      }

      this.logger.log(
        `[AI Retry] Retrying ${candidates.length} failed AI review(s)`,
      );

      for (const c of candidates) {
        await this.retryAssessment(c.assessment_id, c.attempts + 1);
      }
      return candidates.length;
    } catch (error) {
      this.logger.error(
        `[AI Retry] Sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  /**
   * Manually retry specific assessments by id, bypassing the failed/cap filters.
   * Useful for one-off re-runs of assessments whose failure marker was lost.
   */
  async retrySpecific(assessmentIds: string[]): Promise<void> {
    for (const id of assessmentIds) {
      await this.retryAssessment(id);
    }
  }

  /**
   * Re-drive a single assessment through the submission + AI review path.
   * triggerAiReview swallows processing errors internally (it re-marks the
   * review 'failed'), so this resolves regardless of outcome; the next sweep
   * re-evaluates based on the resulting review status + attempt count.
   */
  private async retryAssessment(
    assessmentId: string,
    attemptLabel?: number,
  ): Promise<void> {
    const label = attemptLabel ? ` (attempt ${attemptLabel}/${this.MAX_ATTEMPTS})` : '';
    try {
      // Count this attempt first so a hard crash can't cause an endless loop.
      await this.aiReviewRepo.recordRetryAttempt(assessmentId);

      // Re-enter the same flow a real submission uses.
      await this.assessmentRepo.submitAndSetStatus(assessmentId, 'ai_reviewing');
      await this.aiReviewService.triggerAiReview(assessmentId);

      this.logger.log(`[AI Retry] Re-ran AI review for ${assessmentId}${label}`);
    } catch (error) {
      this.logger.error(
        `[AI Retry] Retry failed for ${assessmentId}${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
