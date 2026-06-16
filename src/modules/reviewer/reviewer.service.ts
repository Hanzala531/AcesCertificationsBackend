import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ReviewerRepository } from './reviewer.repository';
import {
  AssessmentRepository,
  AssessmentWithDetails,
} from '../assessment/assessment.repository';
import { ChatService } from '../chat/chat.service';
import {
  AiReviewRepository,
  AiResponseWithQuestion,
} from '../ai-review/ai-review.repository';
import { AiReviewAnalysisService } from '../ai-review/services/ai-review-analysis.service';
import { AiReviewService } from '../ai-review/services/ai-review.service';
import { AiReviewNotificationService } from '../ai-review/services/ai-review-notification.service';
import { AuditRepository } from '../audit/audit.repository';
import { ScoreCalculationService } from '../certificate/services/score-calculation.service';
import {
  ReviewerAssessmentStatus,
  CertificateAssessmentItemDto,
} from './dto/certificate-assessments-query.dto';
import { ReviewerAiFlagItemDto } from './dto/reviewer-ai-flags.dto';

@Injectable()
export class ReviewerService {
  private readonly logger = new Logger(ReviewerService.name);

  constructor(
    private reviewerRepo: ReviewerRepository,
    @Inject(forwardRef(() => AssessmentRepository))
    private assessmentRepo: AssessmentRepository,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
    private aiReviewRepo: AiReviewRepository,
    private readonly auditRepo: AuditRepository,
    private readonly scoreCalculationService: ScoreCalculationService,
    @Inject(forwardRef(() => AiReviewAnalysisService))
    private readonly aiReviewAnalysisService: AiReviewAnalysisService,
    @Inject(forwardRef(() => AiReviewService))
    private readonly aiReviewService: AiReviewService,
    private readonly aiReviewNotificationService: AiReviewNotificationService,
  ) {}

  async create(
    userId: string,
    firstName: string,
    lastName: string,
    profilePicture?: string,
    tags?: string[],
    accountStatus?: boolean,
  ): Promise<Record<string, unknown>> {
    if (!userId) throw new BadRequestException('User ID is required');
    if (!firstName) throw new BadRequestException('First name is required');
    if (!lastName) throw new BadRequestException('Last name is required');

    return this.reviewerRepo.create(
      userId,
      firstName,
      lastName,
      profilePicture,
      tags || [],
      accountStatus,
    );
  }

  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    return this.reviewerRepo.findByUserId(userId);
  }

  async findById(id: string): Promise<Record<string, unknown>> {
    const reviewer = await this.reviewerRepo.findById(id);
    if (!reviewer) throw new NotFoundException('Reviewer not found');
    return reviewer;
  }

  async findAll(params?: { limit?: number; offset?: number }): Promise<{
    reviewers: Record<string, unknown>[];
    total: number;
  }> {
    return this.reviewerRepo.findAll(params);
  }

  async update(
    id: string,
    fields: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const reviewer = await this.reviewerRepo.findById(id);
    if (!reviewer) throw new NotFoundException('Reviewer not found');
    return this.reviewerRepo.update(id, fields);
  }

  async addTags(
    id: string,
    tags: string[],
  ): Promise<Record<string, unknown> | null> {
    const reviewer = await this.reviewerRepo.findById(id);
    if (!reviewer) throw new NotFoundException('Reviewer not found');
    return this.reviewerRepo.addTags(id, tags);
  }

  async removeTags(
    id: string,
    tags: string[],
  ): Promise<Record<string, unknown> | null> {
    const reviewer = await this.reviewerRepo.findById(id);
    if (!reviewer) throw new NotFoundException('Reviewer not found');
    return this.reviewerRepo.removeTags(id, tags);
  }

  async delete(id: string): Promise<boolean> {
    const reviewer = await this.reviewerRepo.findById(id);
    if (!reviewer) throw new NotFoundException('Reviewer not found');
    return this.reviewerRepo.delete(id);
  }

  async assignToAssessment(
    assessmentId: string,
    reviewerId: string | null,
    assignedByUserId?: string | null,
  ): Promise<{
    assessmentId: string;
    reviewerId: string | null;
    reviewerName: string | null;
  }> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException(
        `Assessment with ID "${assessmentId}" not found`,
      );
    }

    if (reviewerId && assessment.assigned_reviewer_id) {
      throw new BadRequestException(
        'This assessment is already assigned to a reviewer. Unassign the current reviewer before reassigning.',
      );
    }

    let reviewerProfileId: string | null = null;
    let reviewerUserId: string | null = null;
    let reviewerName: string | null = null;

    if (reviewerId) {
      const reviewer = await this.reviewerRepo.findById(reviewerId);
      if (!reviewer) {
        throw new NotFoundException(
          `Reviewer with ID "${reviewerId}" not found`,
        );
      }

      reviewerProfileId = reviewerId;
      reviewerUserId = reviewer.user_id as string;
      const firstName = reviewer.first_name as string;
      const lastName = reviewer.last_name as string;
      reviewerName = `${firstName} ${lastName}`.trim();
    }

    const updatedAssessment = await this.assessmentRepo.assignReviewer(
      assessmentId,
      reviewerUserId,
      assignedByUserId,
    );

    if (reviewerProfileId && reviewerUserId) {
      await this.reviewerRepo.addAssignedAssessment(
        reviewerProfileId,
        assessmentId,
        assessment.certificate_id,
        assignedByUserId || undefined,
      );

      await this.aiReviewRepo.updateReviewerAssignedStatus(assessmentId, true);

      try {
        await this.chatService.addParticipantToAssessmentThread(
          assessmentId,
          reviewerUserId,
          'reviewer',
        );
      } catch (error) {}

      // Update audit record with reviewer assignment
      await this.auditRepo
        .setAssignedReviewer(assessmentId, reviewerUserId)
        .catch((err) => {
          this.logger.error(
            `Failed to set assigned reviewer on audit for assessment ${assessmentId}: ${err?.message}`,
            err?.stack,
          );
        });
    } else if (reviewerId === null) {
      if (assessment.assigned_reviewer_id) {
        const previousReviewer = await this.reviewerRepo.findByUserId(
          assessment.assigned_reviewer_id,
        );
        if (previousReviewer) {
          await this.reviewerRepo.removeAssignedAssessment(
            previousReviewer.id as string,
            assessmentId,
          );
        }
      }
      await this.aiReviewRepo.updateReviewerAssignedStatus(assessmentId, false);
    }

    return {
      assessmentId: updatedAssessment.id,
      reviewerId: reviewerId,
      reviewerName: reviewerName,
    };
  }

  async getAssignedAssessments(
    reviewerUserId: string,
    page: number,
    limit: number,
    status?: string,
    assignedByRole?: string,
    assessmentType?: string,
  ): Promise<{
    data: AssessmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const reviewer = await this.reviewerRepo.findByUserId(reviewerUserId);
    if (!reviewer) throw new NotFoundException('Reviewer not found');

    return this.assessmentRepo.findAssessmentsByReviewer(reviewerUserId, {
      page,
      limit,
      status,
      assignedByRole,
      assessmentType,
    });
  }

  async getCertificateAssessments(
    reviewerUserId: string,
    page: number,
    limit: number,
    assessmentType?: string,
  ): Promise<{
    items: CertificateAssessmentItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const reviewer = await this.reviewerRepo.findByUserId(reviewerUserId);
    if (!reviewer) throw new NotFoundException('Reviewer not found');

    const { rows, total } =
      await this.reviewerRepo.findCertificateAssessments(
        reviewerUserId,
        page,
        limit,
        assessmentType,
      );

    const items: CertificateAssessmentItemDto[] = rows.map((row) => ({
      assessmentId: row.id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      branchId: row.branch_id || null,
      branchName: row.branch_name || null,
      certificateId: row.certificate_id,
      certificateName: row.certificate_name,
      productId: row.product_id || null,
      totalAiFlags: row.total_ai_flags,
      status: this.deriveAssessmentStatus(row),
      assignedDate: row.assigned_date,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReviewerAudits(
    reviewerUserId: string,
    lifecycleStatus?: string,
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
    const reviewer = await this.reviewerRepo.findByUserId(reviewerUserId);
    if (!reviewer) throw new NotFoundException('Reviewer not found');

    return this.reviewerRepo.findReviewerAudits(
      reviewerUserId,
      lifecycleStatus,
      page,
      limit,
    );
  }

  async getDashboardAnalytics(reviewerUserId: string) {
    const reviewer = await this.reviewerRepo.findByUserId(reviewerUserId);
    if (!reviewer) throw new NotFoundException('Reviewer not found');

    return this.reviewerRepo.getDashboardAnalytics(reviewerUserId);
  }

  // ── Reviewer AI Flag Review Methods ──

  async getAssignedAiFlags(
    reviewerUserId: string,
    params: { status?: string; page?: number; limit?: number },
  ): Promise<{
    items: ReviewerAiFlagItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const reviewer = await this.reviewerRepo.findByUserId(reviewerUserId);
    if (!reviewer) throw new NotFoundException('Reviewer not found');

    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const offset = (page - 1) * limit;

    const { flags, total } = await this.aiReviewRepo.findReviewerAssignedFlags(
      reviewerUserId,
      { status: params.status, limit, offset },
    );

    const items: ReviewerAiFlagItemDto[] = flags.map((f) => ({
      reviewId: f.review_id,
      assessmentId: f.assessment_id,
      certificateId: f.certificate_id,
      certificateName: f.certificate_name,
      organizationName: f.organization_name,
      branchName: f.branch_name,
      productId: f.product_id,
      assessmentType: f.assessment_type,
      aiScore: f.ai_score,
      totalFlags: f.total_flags,
      flagStatus: f.flag_status,
      auditor: f.assigned_auditor_id
        ? {
            id: f.assigned_auditor_id,
            name: f.auditor_name || '',
            email: f.auditor_email || '',
          }
        : null,
      reviewerSubmittedAt: f.reviewer_submitted_at,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      totalQuestions: f.total_questions,
      totalAttempted: f.total_attempted,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAiFlagDetails(
    reviewerUserId: string,
    reviewId: string,
  ): Promise<{
    review: ReviewerAiFlagItemDto;
    flaggedResponses: AiResponseWithQuestion[];
  }> {
    const details = await this.aiReviewRepo.findReviewerFlagDetails(
      reviewId,
      reviewerUserId,
    );

    if (!details) {
      throw new NotFoundException(
        'AI flag review not found or not assigned to you',
      );
    }

    const flaggedResponses = await this.aiReviewRepo.findFlaggedResponses(
      reviewId,
    );

    const flagItem: ReviewerAiFlagItemDto = {
      reviewId: details.review.id,
      assessmentId: details.assessment_id,
      certificateId: details.certificate_id,
      certificateName: details.certificate_name,
      organizationName: details.organization_name,
      branchName: details.branch_name,
      productId: details.product_id,
      assessmentType: '', // filled below
      aiScore: details.review.score,
      totalFlags: details.review.total_flags,
      flagStatus: details.review.flag_status || 'open',
      auditor: details.assigned_auditor_id
        ? {
            id: details.assigned_auditor_id,
            name: details.auditor_name || '',
            email: details.auditor_email || '',
          }
        : null,
      reviewerSubmittedAt: details.review.reviewer_submitted_at || null,
      createdAt: details.review.created_at,
      updatedAt: details.review.updated_at,
      totalQuestions: details.total_questions,
      totalAttempted: details.total_attempted,
    };

    return { review: flagItem, flaggedResponses };
  }

  async reviewFlag(
    reviewerUserId: string,
    reviewId: string,
    responseId: string,
    action: 'accepted' | 'rejected',
    notes?: string | null,
  ): Promise<{ reviewClosed: boolean }> {
    // Verify this review is assigned to this reviewer
    const details = await this.aiReviewRepo.findReviewerFlagDetails(
      reviewId,
      reviewerUserId,
    );
    if (!details) {
      throw new ForbiddenException(
        'AI flag review not found or not assigned to you',
      );
    }

    if (details.review.reviewer_submitted_at) {
      throw new BadRequestException(
        'This review has already been submitted. Cannot modify flags.',
      );
    }

    // Verify the response belongs to this review and is flagged
    const aiResponse = await this.aiReviewRepo.findAiResponseByIdAndReviewId(
      responseId,
      reviewId,
    );
    if (!aiResponse) {
      throw new NotFoundException(
        'AI response not found or does not belong to this review',
      );
    }
    if (!aiResponse.is_flagged) {
      throw new BadRequestException('This response is not flagged');
    }

    await this.aiReviewRepo.reviewFlaggedResponse(
      responseId,
      reviewerUserId,
      action,
      notes,
    );

    const allReviewed =
      await this.aiReviewRepo.areAllFlaggedResponsesReviewed(reviewId);

    return { reviewClosed: allReviewed };
  }

  async submitReviewerReview(
    reviewerUserId: string,
    reviewId: string,
    adjustedScore?: number,
  ): Promise<{ message: string }> {
    const details = await this.aiReviewRepo.findReviewerFlagDetails(
      reviewId,
      reviewerUserId,
    );
    if (!details) {
      throw new ForbiddenException(
        'AI flag review not found or not assigned to you',
      );
    }

    const alreadySubmitted = !!details.review.reviewer_submitted_at;

    // Only block if already submitted AND flag_status is resolved (re-review succeeded)
    if (alreadySubmitted && details.review.flag_status === 'resolved') {
      throw new BadRequestException('This review has already been submitted and resolved');
    }

    // Check all flags have been reviewed
    const allReviewed =
      await this.aiReviewRepo.areAllFlaggedResponsesReviewed(reviewId);
    if (!allReviewed) {
      throw new BadRequestException(
        'All flagged questions must be reviewed (accepted or rejected) before submitting',
      );
    }

    // Mark review as submitted (or re-stamp if retrying)
    await this.aiReviewRepo.submitReviewerReview(
      reviewId,
      reviewerUserId,
      adjustedScore,
    );

    const assessmentId = details.review.certificate_assessment_id;

    // PATH 1: Reviewer provided a score — use it as final, skip AI re-review
    if (adjustedScore !== undefined && adjustedScore !== null) {
      this.logger.log(
        `[Reviewer Review] Using reviewer's adjusted score ${adjustedScore} as final for assessment ${assessmentId}`,
      );

      // Update the score on AI review and assessment
      await this.aiReviewRepo.updateScore(reviewId, adjustedScore);
      await this.assessmentRepo.updateAssessmentScore(assessmentId, adjustedScore);

      // Resolve all flags since reviewer has reviewed everything
      await this.aiReviewRepo.updateFlagStatus(reviewId, 'resolved');
      await this.aiReviewRepo.updateAiReviewStatus(
        reviewId,
        'completed',
        `Review completed with reviewer-adjusted score: ${adjustedScore}`,
      );

      // Re-allocate badge based on the new score
      const assessment =
        await this.assessmentRepo.findAssessmentById(assessmentId);
      if (assessment) {
        const badge = await this.scoreCalculationService.assignBadge(
          assessment.certificate_id,
          adjustedScore,
          assessment.assessment_type,
          assessment.organization_id,
        );
        await this.assessmentRepo.updateAssessmentBadge(
          assessmentId,
          badge.badgeId ?? undefined,
        );
        await this.assessmentRepo.updateAssessmentStatus(
          assessmentId,
          'completed',
        );

        const organizationUsers =
          await this.aiReviewNotificationService.getOrganizationUsers(
            assessment.organization_id,
          );
        await this.aiReviewNotificationService.allocateOrganizationBadge(
          assessment,
          adjustedScore,
          organizationUsers,
        );

        this.logger.log(
          `[Reviewer Review] Badge re-allocated for assessment ${assessmentId}: ${badge.badgeName || 'none'}`,
        );
      }

      return { message: 'Review submitted with adjusted score. Badge re-allocated.' };
    }

    // PATH 2: No score — trigger AI re-review (respects reviewer-accepted flags)
    this.logger.log(
      `[Reviewer Review] Triggering AI re-review for assessment ${assessmentId} after reviewer submission`,
    );

    try {
      await this.aiReviewService.triggerAiReview(assessmentId);
    } catch (error) {
      this.logger.error(
        `[Reviewer Review] AI re-review failed for assessment ${assessmentId}:`,
        error,
      );
      throw new BadRequestException(
        'Review submitted but AI re-review failed. Admin will be notified.',
      );
    }

    return { message: 'Review submitted and AI re-review triggered' };
  }

  deriveAssessmentStatus(row: {
    is_certificate_blocked: boolean;
    has_issued_certificate: boolean;
    issued_cert_blocked: boolean;
    audit_lifecycle_status: string | null;
    assigned_auditor_id: string | null;
    total_ai_flags: number;
  }): ReviewerAssessmentStatus {
    if (row.is_certificate_blocked || row.issued_cert_blocked) {
      return ReviewerAssessmentStatus.BLOCKED;
    }
    if (row.has_issued_certificate) {
      return ReviewerAssessmentStatus.APPROVED;
    }
    if (
      row.audit_lifecycle_status === 'reviewer_submitted' ||
      row.audit_lifecycle_status === 'completed'
    ) {
      return ReviewerAssessmentStatus.AUDIT_COMPLETED;
    }
    if (row.assigned_auditor_id) {
      return ReviewerAssessmentStatus.ASSIGNED_TO_AUDITOR;
    }
    if (row.total_ai_flags > 0) {
      return ReviewerAssessmentStatus.AI_FLAGGED;
    }
    return ReviewerAssessmentStatus.UNDER_REVIEWER;
  }
}
