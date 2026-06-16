import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AssessmentRepository } from '../assessment.repository';
import {
  AiReviewRepository,
  AiResponseWithQuestion,
} from '../../ai-review/ai-review.repository';
import { AiReviewAnalysisService } from '../../ai-review/services/ai-review-analysis.service';
import { AssessmentService } from './assessment.service';
import { AssessmentNotificationService } from './assessment-notification.service';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../notification/types/notification.types';
import { BadgeRepository } from '../../notification/badge.repository';
import { DatabaseService } from '../../../database/database.service';
import { ScoreCalculationService } from '../../certificate/services/score-calculation.service';

@Injectable()
export class AdminAssessmentActionsService {
  private readonly logger = new Logger(AdminAssessmentActionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly aiReviewRepo: AiReviewRepository,
    @Inject(forwardRef(() => AiReviewAnalysisService))
    private readonly aiReviewAnalysisService: AiReviewAnalysisService,
    @Inject(forwardRef(() => AssessmentService))
    private readonly assessmentService: AssessmentService,
    private readonly assessmentNotificationService: AssessmentNotificationService,
    private readonly notificationService: NotificationService,
    private readonly badgeRepository: BadgeRepository,
    private readonly scoreCalculationService: ScoreCalculationService,
  ) {}

  async improveAndResolve(
    assessmentId: string,
    adminUserId: string,
    message: string,
  ): Promise<{ assessmentId: string; status: string }> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.status !== 'completed') {
      throw new BadRequestException(
        'Assessment must be in completed status to request improvement',
      );
    }

    const review =
      await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
    if (!review) {
      throw new NotFoundException('AI review not found for this assessment');
    }

    await this.aiReviewRepo.setImproveRequested(
      review.id,
      adminUserId,
      message,
    );

    await this.assessmentRepo.updateAssessmentStatus(
      assessmentId,
      'improvement_requested',
    );

    const organizationUsers =
      await this.assessmentNotificationService.getOrganizationUsers(
        assessment.organization_id,
      );

    if (organizationUsers.length > 0) {
      await this.notificationService.notifyUsers(organizationUsers, {
        type: NotificationType.WARNING,
        title: 'Assessment Improvement Requested',
        message: `An admin has requested improvements to your assessment. Please review the flagged questions and submit updated answers.`,
        module: 'assessment',
        actionUrl: `/assessments/${assessmentId}/flagged-questions`,
        metadata: {
          assessment_id: assessmentId,
          organization_id: assessment.organization_id,
          admin_message: message,
        },
      });
    }

    return { assessmentId, status: 'improvement_requested' };
  }

  async getFlaggedQuestions(
    assessmentId: string,
  ): Promise<AiResponseWithQuestion[]> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    return this.aiReviewRepo.findFlaggedResponsesByAssessmentId(assessmentId);
  }

  async submitImprovements(
    assessmentId: string,
    answers: Array<{ questionId: string; responseValue: string }>,
  ): Promise<void> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.status !== 'improvement_requested') {
      throw new BadRequestException(
        'Assessment must be in improvement_requested status to submit improvements',
      );
    }

    const review =
      await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
    if (!review) {
      throw new NotFoundException('AI review not found for this assessment');
    }

    // Validate question ownership: only flagged questions can be re-answered
    const flaggedResponses =
      await this.aiReviewRepo.findFlaggedResponsesByAssessmentId(assessmentId);
    const flaggedQueryIds = new Set(
      flaggedResponses.map((r) => r.assessment_query_id),
    );

    for (const answer of answers) {
      if (!flaggedQueryIds.has(answer.questionId)) {
        throw new BadRequestException(
          `Question ${answer.questionId} is not flagged and cannot be resubmitted`,
        );
      }
    }

    await this.assessmentRepo.updateAnswersValueBatch(
      answers.map((a) => ({
        id: a.questionId,
        response_value: a.responseValue,
      })),
    );

    await this.aiReviewAnalysisService.reReviewFlaggedQuestions(assessmentId);
  }

  async approveAssessment(
    assessmentId: string,
    adminUserId: string,
    reason?: string,
  ): Promise<{
    assessmentId: string;
    isAdjusted: boolean;
    originalScore: number;
    adjustedScore: number;
  }> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const review =
      await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
    if (!review) {
      throw new NotFoundException('AI review not found for this assessment');
    }

    if (review.is_admin_approved) {
      throw new BadRequestException(
        'Assessment has already been admin-approved',
      );
    }

    const originalScore = review.score ?? 0;
    let adjustedScore = originalScore;
    let isAdjusted = false;

    if (originalScore < 50) {
      adjustedScore = Math.floor(Math.random() * 11) + 50; // 50-60
      isAdjusted = true;
    }

    const badge = await this.scoreCalculationService.assignBadge(
      assessment.certificate_id,
      adjustedScore,
      assessment.assessment_type,
      assessment.organization_id,
    );
    const badgeId = badge.badgeId;

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE ai_reviews
         SET is_admin_approved = TRUE,
             admin_approved_by = $2,
             admin_original_score = $3,
             admin_adjusted_score = $4,
             admin_approval_reason = $5,
             updated_at = NOW()
         WHERE id = $1`,
        [review.id, adminUserId, originalScore, adjustedScore, reason || null],
      );

      await client.query(
        `UPDATE certificate_assessments SET score = $2, updated_at = NOW() WHERE id = $1`,
        [assessmentId, adjustedScore],
      );
      await client.query(
        `UPDATE certificate_assessments SET badge_id = $2, updated_at = NOW() WHERE id = $1`,
        [assessmentId, badgeId],
      );
    });

    const organizationUsers =
      await this.assessmentNotificationService.getOrganizationUsers(
        assessment.organization_id,
      );

    if (organizationUsers.length > 0) {
      await this.notificationService.notifyUsers(organizationUsers, {
        type: NotificationType.SUCCESS,
        title: 'Assessment Approved',
        message: `Your assessment has been approved by an administrator. ${isAdjusted ? `Score adjusted to ${adjustedScore}%.` : `Score: ${originalScore}%.`}`,
        module: 'assessment',
        actionUrl: `/assessments/${assessmentId}`,
        metadata: {
          assessment_id: assessmentId,
          organization_id: assessment.organization_id,
          original_score: originalScore,
          adjusted_score: adjustedScore,
          is_adjusted: isAdjusted,
        },
      });
    }

    return { assessmentId, isAdjusted, originalScore, adjustedScore };
  }

  async escalateAssessment(
    assessmentId: string,
    adminUserId: string,
    reason: string,
  ): Promise<{ assessmentId: string; status: string }> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const review =
      await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
    if (!review) {
      throw new NotFoundException('AI review not found for this assessment');
    }

    if (review.flag_status === 'escalated') {
      throw new BadRequestException('Assessment has already been escalated');
    }

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE ai_reviews
         SET flag_status = 'escalated',
             escalated_by = $2,
             escalated_reason = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [review.id, adminUserId, reason],
      );

      await client.query(
        `UPDATE certificate_assessments
         SET is_certificate_blocked = TRUE,
             certificate_block_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [assessmentId, `Escalated: ${reason}`],
      );
    });

    const organizationUsers =
      await this.assessmentNotificationService.getOrganizationUsers(
        assessment.organization_id,
      );

    if (organizationUsers.length > 0) {
      await this.notificationService.notifyUsers(organizationUsers, {
        type: NotificationType.WARNING,
        title: 'Assessment Under Review',
        message: `Your assessment has been escalated for further review. The certificate allocation has been temporarily locked.`,
        module: 'assessment',
        actionUrl: `/assessments/${assessmentId}`,
        metadata: {
          assessment_id: assessmentId,
          organization_id: assessment.organization_id,
          escalation_reason: reason,
        },
      });
    }

    return { assessmentId, status: 'escalated' };
  }
}
