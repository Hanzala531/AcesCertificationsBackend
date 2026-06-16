import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import {
  AssessmentRepository,
  CertificateAssessment,
  AssessmentWithDetails,
  AssessmentQuery,
  QuestionWithAnswer,
  ReviewOverview,
  SubmittedQuestionSection,
} from '../assessment.repository';
import { PaymentService } from '../../payment/payment.service';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';
import { AiReviewService } from '../../ai-review/services/ai-review.service';
import { AiReviewRepository } from '../../ai-review/ai-review.repository';
import { AssessmentNotificationService } from './assessment-notification.service';
import { CreateAssessmentDto } from '../dto/create-assessment.dto';
import {
  SubmitAnswersDto,
  UpdateAnswerDto,
  ResponseType,
} from '../dto/submit-answer.dto';
import { BadgeRepository } from '../../notification/badge.repository';
import { ChatService } from '../../chat/chat.service';
import { ScoreCalculationService } from '../../certificate/services/score-calculation.service';

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly paymentService: PaymentService,
    private readonly organizationRepo: OrganizationRepository,
    private readonly employeeRepo: EmployeeRepository,
    @Inject(forwardRef(() => AiReviewService))
    private readonly aiReviewService: AiReviewService,
    @Inject(forwardRef(() => AiReviewRepository))
    private readonly aiReviewRepo: AiReviewRepository,
    private readonly assessmentNotificationService: AssessmentNotificationService,
    private readonly badgeRepository: BadgeRepository,
    private readonly scoreCalculationService: ScoreCalculationService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  private async resolveOrganizationIdForUser(
    userId: string,
    userRole: string,
  ): Promise<string> {
    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new NotFoundException('Organization not found for this user');
      }
      return org.id;
    }

    if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new NotFoundException('Employee record not found for this user');
      }
      return employee.organization_id;
    }

    throw new ForbiddenException('Invalid role');
  }

  async createAssessment(
    userId: string,
    userRole: string,
    dto: CreateAssessmentDto,
  ): Promise<CertificateAssessment> {
    const payment = await this.paymentService.verifyPaymentForAssessment(
      userId,
      dto.payment_id,
    );

    if ((payment.payment_type as string) !== (dto.assessment_type as string)) {
      throw new BadRequestException(
        `Payment type (${payment.payment_type}) does not match assessment type (${dto.assessment_type})`,
      );
    }

    if (payment.certificate_id !== dto.certificate_id) {
      throw new BadRequestException(
        'Payment certificate does not match assessment certificate',
      );
    }

    let organizationId: string;
    let branchId: string | undefined;

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new NotFoundException('Organization not found for this user');
      }
      organizationId = org.id;
      if (!dto.branch_id) {
        throw new BadRequestException('Branch ID is required to create an assessment');
      }
      branchId = dto.branch_id;
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new NotFoundException('Employee record not found for this user');
      }
      organizationId = employee.organization_id;

      if (!dto.branch_id && !employee.branch_id) {
        throw new BadRequestException(
          'Branch ID is required for organization members',
        );
      }
      branchId = dto.branch_id || employee.branch_id || undefined;
    } else {
      throw new ForbiddenException('Invalid role for creating assessments');
    }

    if (branchId) {
      const branch = await this.assessmentRepo.findBranchByIdAndOrganization(
        branchId,
        organizationId,
      );
      if (!branch) {
        throw new BadRequestException(
          'Branch not found or does not belong to this organization',
        );
      }
    }

    const existingAssessment = await this.assessmentRepo.findExistingAssessment(
      organizationId,
      dto.certificate_id,
      dto.payment_id,
    );

    if (existingAssessment) {
      return existingAssessment;
    }

    if ((dto.assessment_type as string) === 'assured') {
      // Check for completed self-disclosure assessment first
      const completedDisclosureAssessment =
        await this.assessmentRepo.findCompletedSelfDisclosureAssessment(
          organizationId,
          dto.certificate_id,
        );

      if (!completedDisclosureAssessment) {
        throw new BadRequestException(
          'You have not completed the self-disclosure assessment for this certificate yet. Please complete the self-disclosure assessment first before proceeding with assured assessment.',
        );
      }

      // Automatically find the badge for this organization and certificate
      const badge =
        await this.badgeRepository.findBadgeByOrganizationAndCertificate(
          organizationId,
          dto.certificate_id,
          branchId || null,
        );

      if (!badge) {
        throw new BadRequestException(
          'No badge found for this organization and certificate. You must have a badge allocated before creating an assured assessment.',
        );
      }

      const assessment = await this.assessmentRepo.createAssessment({
        organization_id: organizationId,
        branch_id: branchId,
        certificate_id: dto.certificate_id,
        payment_id: dto.payment_id,
        assessment_type: 'assured',
        status: 'in_progress',
        is_submitted: true,
      });

      try {
        const org = await this.organizationRepo.findById(organizationId);
        if (org && org.user_id) {
          await this.chatService.createThreadForAssuredAssessment(
            assessment.id,
            org.user_id,
          );
          this.logger.log(
            `Auto-created chat thread for assured assessment ${assessment.id}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to auto-create chat thread for assessment ${assessment.id}: ${error}`,
        );
      }

      this.logger.log(
        `Created assured assessment ${assessment.id} with status in_progress using badge ${badge.id}`,
      );

      return assessment;
    }

    return this.assessmentRepo.createAssessment({
      organization_id: organizationId,
      branch_id: branchId,
      certificate_id: dto.certificate_id,
      payment_id: dto.payment_id,
      assessment_type: dto.assessment_type,
    });
  }

  async getAssessments(
    userId: string,
    userRole: string,
    page: number,
    limit: number,
  ): Promise<{
    data: AssessmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    let organizationId: string;
    let branchId: string | undefined;

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      organizationId = org.id;
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
      organizationId = employee.organization_id;
      branchId = employee.branch_id ?? undefined;
    } else {
      throw new ForbiddenException('Invalid role');
    }

    return this.assessmentRepo.findAssessmentsByOrganization(organizationId, {
      page,
      limit,
      branchId,
    });
  }

  async getPendingAssessments(
    userId: string,
    userRole: string,
    page: number,
    limit: number,
  ): Promise<{
    data: AssessmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    let organizationId: string;
    let branchId: string | undefined;

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      organizationId = org.id;
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
      organizationId = employee.organization_id;
      branchId = employee.branch_id ?? undefined;
    } else {
      throw new ForbiddenException('Invalid role');
    }

    return this.assessmentRepo.findPendingAssessmentsByOrganization(
      organizationId,
      { page, limit, branchId },
    );
  }

  async getSelfDisclosureStatus(
    userId: string,
    userRole: string,
    certificateId: string,
    branchId?: string,
  ): Promise<{
    certificateId: string;
    hasSelfDisclosure: boolean;
    hasBadgeInSelfDisclosure: boolean;
    badgeId: string | null;
    badgeName: string | null;
    eligible: boolean;
    canStartAssured: boolean;
    isAssuredApplied: boolean;
    assessmentId: string | null;
    status: string | null;
    submittedAt: Date | null;
    createdAt: Date | null;
    isSubmitted: boolean | null;
  }> {
    let organizationId: string;

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new NotFoundException('Organization not found for this user');
      }
      organizationId = org.id;
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new NotFoundException('Employee record not found for this user');
      }
      organizationId = employee.organization_id;
    } else {
      throw new ForbiddenException('Invalid role');
    }

    const [assessment, isAssuredApplied] = await Promise.all([
      this.assessmentRepo.findLatestSelfDisclosureByOrganization(
        organizationId,
        certificateId,
        branchId,
      ),
      this.assessmentRepo.hasAssuredAppliedByOrganization(
        organizationId,
        certificateId,
        branchId,
      ),
    ]);

    const badge = await this.badgeRepository.findBadgeByOrganizationAndCertificate(
      organizationId,
      certificateId,
      branchId,
    );
    const hasBadgeInSelfDisclosure = Boolean(badge);
    const isCompletedSelfDisclosure = assessment?.status === 'completed';
    const canStartAssured =
      Boolean(assessment) && isCompletedSelfDisclosure && hasBadgeInSelfDisclosure;

    return {
      certificateId,
      hasSelfDisclosure: Boolean(assessment),
      hasBadgeInSelfDisclosure,
      badgeId: badge?.id ?? null,
      badgeName: badge?.badge_name ?? null,
      eligible: canStartAssured,
      canStartAssured,
      isAssuredApplied,
      assessmentId: assessment?.id ?? null,
      status: assessment?.status ?? null,
      submittedAt: assessment?.submitted_at ?? null,
      createdAt: assessment?.created_at ?? null,
      isSubmitted: assessment?.is_submitted ?? null,
    };
  }

  async getAssessmentById(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<AssessmentWithDetails> {
    const assessment =
      await this.assessmentRepo.findAssessmentWithDetails(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);

    return assessment;
  }

  async getQuestionsWithProgress(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<QuestionWithAnswer[]> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);
    this.ensureAssessmentCanProceed(userRole, assessment);

    return this.assessmentRepo.getQuestionsWithAnswers(
      assessmentId,
      assessment.certificate_id,
    );
  }

  async submitAnswers(
    userId: string,
    userRole: string,
    assessmentId: string,
    dto: SubmitAnswersDto,
  ): Promise<AssessmentQuery[]> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    this.ensureAssessmentCanProceed(userRole, assessment);

    if (assessment.is_submitted) {
      throw new BadRequestException('Assessment has already been submitted');
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);

    for (const answer of dto.answers) {
      if (answer.response_type === ResponseType.BOOLEAN) {
        if (
          answer.response_value &&
          !['yes', 'no'].includes(answer.response_value.toLowerCase())
        ) {
          throw new BadRequestException(
            `Invalid boolean response for question ${answer.question_id}. Must be "yes" or "no"`,
          );
        }
      }
      if (answer.response_type === ResponseType.NUMBER) {
        if (answer.response_value && isNaN(Number(answer.response_value))) {
          throw new BadRequestException(
            `Invalid number response for question ${answer.question_id}. Must be a valid numeric value`,
          );
        }
      }
      if (answer.response_type === ResponseType.CHECKBOX) {
        if (answer.response_value) {
          try {
            const parsed = JSON.parse(answer.response_value);
            if (!Array.isArray(parsed)) {
              throw new Error();
            }
          } catch {
            throw new BadRequestException(
              `Invalid checkbox response for question ${answer.question_id}. Must be a JSON array of selected options`,
            );
          }
        }
      }
      if (answer.response_type === ResponseType.RATING) {
        if (answer.response_value) {
          const num = Number(answer.response_value);
          if (isNaN(num) || !Number.isInteger(num) || num < 1) {
            throw new BadRequestException(
              `Invalid rating response for question ${answer.question_id}. Must be a positive integer`,
            );
          }
        }
      }
      if (answer.response_files && answer.response_type !== ResponseType.PDF) {
        throw new BadRequestException(
          `response_files is only allowed for pdf type questions (question ${answer.question_id})`,
        );
      }
    }

    const savedAnswers = await this.assessmentRepo.saveAnswersBatch(
      dto.answers.map((answer) => ({
        certificate_assessment_id: assessmentId,
        question_id: answer.question_id,
        response_type: answer.response_type,
        response_value: answer.response_value,
        response_files: answer.response_files ?? null,
      })),
    );

    return savedAnswers;
  }

  async updateAnswer(
    userId: string,
    userRole: string,
    assessmentId: string,
    answerId: string,
    dto: UpdateAnswerDto,
  ): Promise<AssessmentQuery> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    this.ensureAssessmentCanProceed(userRole, assessment);

    if (assessment.is_submitted) {
      throw new BadRequestException(
        'Cannot update answers on a submitted assessment',
      );
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);

    const answer = await this.assessmentRepo.findAnswerById(answerId);

    if (!answer) {
      throw new NotFoundException('Answer not found');
    }

    if (answer.certificate_assessment_id !== assessmentId) {
      throw new BadRequestException(
        'Answer does not belong to this assessment',
      );
    }

    if (dto.response_type === ResponseType.BOOLEAN) {
      if (
        dto.response_value &&
        !['yes', 'no'].includes(dto.response_value.toLowerCase())
      ) {
        throw new BadRequestException(
          'Invalid boolean response. Must be "yes" or "no"',
        );
      }
    }

    if (dto.response_type === ResponseType.NUMBER) {
      if (dto.response_value && isNaN(Number(dto.response_value))) {
        throw new BadRequestException(
          'Invalid number response. Must be a valid numeric value',
        );
      }
    }

    if (dto.response_type === ResponseType.CHECKBOX) {
      if (dto.response_value) {
        try {
          const parsed = JSON.parse(dto.response_value);
          if (!Array.isArray(parsed)) {
            throw new Error();
          }
        } catch {
          throw new BadRequestException(
            'Invalid checkbox response. Must be a JSON array of selected options',
          );
        }
      }
    }

    if (dto.response_type === ResponseType.RATING) {
      if (dto.response_value) {
        const num = Number(dto.response_value);
        if (isNaN(num) || !Number.isInteger(num) || num < 1) {
          throw new BadRequestException(
            'Invalid rating response. Must be a positive integer',
          );
        }
      }
    }

    if (dto.response_files && dto.response_type !== ResponseType.PDF) {
      throw new BadRequestException(
        'response_files is only allowed for pdf type questions',
      );
    }

    return this.assessmentRepo.updateAnswer(answerId, {
      response_type: dto.response_type,
      response_value: dto.response_value,
      response_files: dto.response_files ?? null,
    });
  }

  // Frontend marker stored verbatim as response_value when an applicant skips a question.
  private static readonly SKIP_MARKER = '__SKIPPED__';

  /**
   * Rejects submission if any question marked is_compulsory was explicitly skipped or
   * left blank. Questions with no answer row at all are intentionally NOT flagged here,
   * because conditional branching can legitimately hide a question (no row is written for
   * one that was never shown). This catches the real violation — a required question that
   * was reached and deliberately skipped/blanked — without false-blocking valid branches.
   */
  private async ensureCompulsoryQuestionsAnswered(
    assessmentId: string,
    certificateId: string,
  ): Promise<void> {
    const questions =
      (await this.assessmentRepo.getQuestionsWithAnswers(
        assessmentId,
        certificateId,
      )) ?? [];

    const unanswered = questions.filter((q) => {
      if (!q.is_compulsory) return false;
      // Untouched (no answer row) — may be hidden by branching, so don't block.
      if (!q.answer_id) return false;
      const hasFiles =
        Array.isArray(q.response_files) && q.response_files.length > 0;
      const value = (q.response_value ?? '').trim();
      const answered =
        hasFiles ||
        (value !== '' && value !== AssessmentService.SKIP_MARKER);
      return !answered;
    });

    if (unanswered.length > 0) {
      const names = unanswered.map((q) => q.question_text).join('; ');
      throw new BadRequestException(
        `Required question(s) must be answered before submitting: ${names}`,
      );
    }
  }

  async submitAssessment(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<CertificateAssessment> {
    this.logger.log(`[Assessment Submit] Starting submission for assessment: ${assessmentId} by user: ${userId}`);
    
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    this.logger.log(`[Assessment Submit] Assessment found: ${assessmentId}, status: ${assessment.status}, is_submitted: ${assessment.is_submitted}`);

    this.ensureAssessmentCanProceed(userRole, assessment);

    // Check for any existing AI review records that might be leftover from failed attempts
    const existingReview = await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
    this.logger.log(`[Assessment Submit] Existing AI review check: ${existingReview ? `Found review ${existingReview.id} with status ${existingReview.review_status}` : 'No existing review'}`);
    
    if (assessment.is_submitted) {
      if (existingReview) {
        this.logger.error(`[Assessment Submit] Assessment ${assessmentId} already submitted with existing AI review ${existingReview.id}`);
        throw new BadRequestException('Assessment has already been submitted');
      } else {
        this.logger.warn(
          `Assessment ${assessmentId} marked as submitted but no AI review found. Reverting to allow resubmission.`,
        );
        await this.revertAssessmentSubmission(
          assessmentId,
          'Assessment was submitted but AI review was not created',
        );
        // Re-fetch assessment after revert
        const updatedAssessment = await this.assessmentRepo.findAssessmentById(assessmentId);
        if (!updatedAssessment || updatedAssessment.is_submitted) {
          throw new BadRequestException('Failed to reset assessment for resubmission');
        }
      }
    } else if (existingReview) {
      // Assessment is not submitted but there's a leftover AI review from previous attempt
      this.logger.warn(
        `Assessment ${assessmentId} not submitted but has leftover AI review ${existingReview.id}. Cleaning up.`,
      );
      await this.aiReviewRepo.deleteAiReview(existingReview.id);
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);

    // Enforce compulsory questions server-side (the frontend already prevents skipping,
    // this is the backstop for direct API calls).
    await this.ensureCompulsoryQuestionsAnswered(
      assessmentId,
      assessment.certificate_id,
    );

    // FIRST: Test AI review service availability before making any database changes
    this.logger.log(`[Assessment Submit] Testing AI review service availability for assessment: ${assessmentId}`);
    try {
      // Test if we can create an AI review (this validates the assessment and AI service)
      const testReview = await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
      if (testReview && testReview.review_status === 'failed') {
        this.logger.log(`[Assessment Submit] Cleaning up failed AI review before proceeding`);
        await this.aiReviewRepo.deleteAiReview(testReview.id);
      }
      
      // Pre-validate AI service connection
      this.logger.log(`[Assessment Submit] Validating AI service availability`);
      
      // Check if AI review service is properly configured
      if (!this.aiReviewService) {
        throw new Error('AI review service not initialized');
      }
      
      // Validate environment variables
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('AI service not configured - missing API key');
      }
    } catch (aiPreCheckError) {
      this.logger.error(`[Assessment Submit] AI service pre-check failed for assessment ${assessmentId}:`, aiPreCheckError);
      throw new BadRequestException(
        'AI review service is currently unavailable. Please try again later.'
      );
    }

    // SECOND: Now that AI service is validated, proceed with database submission (atomic)
    this.logger.log(`[Assessment Submit] Starting database updates for assessment: ${assessmentId}`);
    const submitted = await this.assessmentRepo.submitAndSetStatus(assessmentId, 'ai_reviewing');
    this.logger.log(`[Assessment Submit] Assessment submitted and status set to ai_reviewing: ${assessmentId}`);

    // THIRD: Get assessment details for notifications
    const assessmentDetails =
      await this.assessmentRepo.findAssessmentWithDetails(assessmentId);

    // FOURTH: Trigger AI review in background (don't block the response)
    setImmediate(() => {
      this.logger.log(`[Assessment Submit] Starting AI review trigger for assessment ${assessmentId}`);
      this.aiReviewService.triggerAiReview(assessmentId)
        .then(() => {
          this.logger.log(`[Assessment Submit] AI review completed for assessment ${assessmentId}`);
        })
        .catch(async (error) => {
          this.logger.error(`[Assessment Submit] AI review failed for assessment ${assessmentId}:`, error);
          try {
            // Check if the assessment was already completed (e.g. by fallback scoring)
            // before reverting — prevents undoing a successful fallback
            const current = await this.assessmentRepo.findAssessmentById(assessmentId);
            if (current?.status === 'completed') {
              this.logger.log(
                `[Assessment Submit] Assessment ${assessmentId} already completed (likely fallback scoring), skipping revert`,
              );
              return;
            }
            await this.revertAssessmentSubmission(
              assessmentId,
              `AI review failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            this.logger.log(`[Assessment Submit] Assessment ${assessmentId} reverted due to AI review failure`);
          } catch (revertError) {
            this.logger.error(`[Assessment Submit] Failed to revert assessment ${assessmentId}:`, revertError);
          }
        });
    });

    // FIFTH: Send notifications immediately (assessment is submitted)
    if (assessmentDetails) {
      setImmediate(() => {
        this.assessmentNotificationService.sendAssessmentSubmissionNotification(
          assessmentDetails,
          userId,
        ).catch((error) => {
          this.logger.error(
            `Failed to send assessment submission notification for assessment ${assessmentId}:`,
            error,
          );
        });
      });
    }

    return submitted;
  }

  async getAssessmentScore(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<{
    score: number | null;
    badge_id: string | null;
    badge_name: string | null;
    badge_color: string | null;
    badge_tier: string | null;
    status: string;
  }> {
    const assessment =
      await this.assessmentRepo.findAssessmentWithDetails(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);

    let resolvedStatus = assessment.status;
    let aiReview:
      | {
          score: number | null;
          review_status?: string;
        }
      | undefined;

    let score: number | null =
      assessment.score !== null && assessment.score !== undefined
        ? Number(assessment.score)
        : null;

    const shouldCheckAiReview =
      score === null || assessment.status === 'submitted' || assessment.status === 'ai_reviewing';

    if (shouldCheckAiReview) {
      try {
        aiReview = await this.aiReviewService.getAiReviewForAssessment(
          userId,
          userRole,
          assessmentId,
        );

        if (score === null) {
          score =
            aiReview?.score !== null && aiReview?.score !== undefined
              ? Number(aiReview.score)
              : null;
        }

        const hasFinalizedScoreSignals =
          score !== null &&
          (
            aiReview?.review_status === 'completed' ||
            (
              assessment.status === 'ai_reviewing' &&
              assessment.badge_id !== null &&
              aiReview?.score !== null &&
              aiReview?.score !== undefined
            )
          );

        if (
          assessment.status !== 'completed' &&
          hasFinalizedScoreSignals
        ) {
          resolvedStatus = 'completed';

          // Self-heal stale assessment rows that still show ai_reviewing
          // even though the latest AI review already completed and scored.
          await this.assessmentRepo.updateAssessmentStatus(
            assessmentId,
            'completed',
          );
        }
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    // Derive tier from badge color hex
    const badgeColor = (assessment as any).badge_color || null;
    const colorToTier: Record<string, string> = {
      '#CD7F32': 'BRONZE',
      '#C0C0C0': 'SILVER',
      '#FFD700': 'GOLD',
      '#FFA500': 'SILVER',
      '#00C853': 'EMERALD',
      '#E5E4E2': 'EMERALD',
    };
    const badgeTier = badgeColor ? (colorToTier[badgeColor] || 'BRONZE') : null;

    return {
      score,
      badge_id: assessment.badge_id,
      badge_name: assessment.badge_name || null,
      badge_color: badgeColor,
      badge_tier: badgeTier,
      status: resolvedStatus,
    };
  }

  async calculateAndUpdateScore(assessmentId: string): Promise<{
    score: number;
    badge: { id: string; name: string } | null;
  }> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const questionsWithAnswers =
      await this.assessmentRepo.getQuestionsWithAnswers(
        assessmentId,
        assessment.certificate_id,
      );

    const scoreBreakdown = this.scoreCalculationService.calculateCertificateScore(
      this.scoreCalculationService.buildScoreInputsFromAnswers(
        questionsWithAnswers.map((question) => ({
          id: question.id,
          question_type: question.question_type,
          score: question.score,
          yes_score: question.yes_score,
          no_score: question.no_score,
          ai_review_enabled: question.ai_review_enabled,
          ai_review_score: question.ai_review_score,
          response_value: question.response_value,
        })),
      ),
    );
    const score = scoreBreakdown.finalPercentage;

    const badge = await this.scoreCalculationService.assignBadge(
      assessment.certificate_id,
      score,
      assessment.assessment_type,
      assessment.organization_id,
    );

    let aiReview =
      await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
    if (!aiReview) {
      aiReview = await this.aiReviewRepo.createAiReview(assessmentId);
    }

    await this.aiReviewRepo.updateScoreSummary(aiReview.id, {
      score,
      earned_score: scoreBreakdown.earnedScore,
      max_score: scoreBreakdown.maxScore,
      final_percentage: scoreBreakdown.finalPercentage,
    });

    await this.assessmentRepo.updateAssessmentScore(assessmentId, score, {
      earned_score: scoreBreakdown.earnedScore,
      max_score: scoreBreakdown.maxScore,
      final_percentage: scoreBreakdown.finalPercentage,
    });
    await this.assessmentRepo.updateAssessmentBadge(
      assessmentId,
      badge.badgeId ?? undefined,
    );

    return {
      score,
      badge: badge.badgeId
        ? { id: badge.badgeId, name: badge.badgeName ?? '' }
        : null,
    };
  }

  private async verifyAssessmentAccess(
    userId: string,
    userRole: string,
    assessment: CertificateAssessment | AssessmentWithDetails,
  ): Promise<void> {
    if (userRole === 'admin') {
      return;
    }

    let organizationId: string;
    let branchId: string | undefined;

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new ForbiddenException('Organization not found');
      }
      organizationId = org.id;
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new ForbiddenException('Employee not found');
      }
      organizationId = employee.organization_id;
      branchId = employee.branch_id ?? undefined;
    } else {
      throw new ForbiddenException('Invalid role');
    }

    if (assessment.organization_id !== organizationId) {
      throw new ForbiddenException('Access denied to this assessment');
    }

    // Org members can access any branch within their organization
  }

  private ensureAssessmentCanProceed(
    userRole: string,
    assessment: CertificateAssessment | AssessmentWithDetails,
  ): void {
    const isApplicant =
      userRole === 'organization' || userRole === 'organization_member';
    if (isApplicant && assessment.is_certificate_blocked) {
      throw new ForbiddenException(
        'Certificate allocation for this assessment is blocked by admin. You cannot proceed until it is unblocked.',
      );
    }
  }

  async getReviewOverview(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<ReviewOverview> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);

    return this.assessmentRepo.getAssessmentReviewOverview(assessmentId);
  }

  async getSubmittedAssessmentView(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<SubmittedQuestionSection[]> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);

    return this.assessmentRepo.getSubmittedQuestionsView(
      assessmentId,
      assessment.certificate_id,
    );
  }

  /**
   * Reverts an assessment submission when AI review fails or other errors occur.
   * Sets is_submitted back to false, status to in_progress, and clears submitted_at.
   */
  async revertAssessmentSubmission(
    assessmentId: string,
    reason?: string,
  ): Promise<CertificateAssessment> {
    this.logger.warn(
      `[Assessment Revert] Reverting assessment submission for ${assessmentId}${reason ? `: ${reason}` : ''}`,
    );

    // Check current state before reverting
    const currentAssessment = await this.assessmentRepo.findAssessmentById(assessmentId);
    if (currentAssessment) {
      this.logger.log(
        `[Assessment Revert] Current state - status: ${currentAssessment.status}, is_submitted: ${currentAssessment.is_submitted}`,
      );
    }

    try {
      // First clean up any AI review records
      const existingReview = await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
      if (existingReview) {
        this.logger.log(`[Assessment Revert] Cleaning up AI review ${existingReview.id}`);
        await this.aiReviewRepo.deleteAiReview(existingReview.id);
      }

      // Then revert the assessment
      const reverted = await this.assessmentRepo.revertAssessmentSubmission(assessmentId);

      this.logger.log(
        `[Assessment Revert] Assessment ${assessmentId} submission reverted successfully. Status: ${reverted.status}, isSubmitted: ${reverted.is_submitted}`,
      );

      return reverted;
    } catch (error) {
      this.logger.error(
        `[Assessment Revert] Failed to revert assessment ${assessmentId}:`,
        error,
      );
      
      // Try a more forceful revert using the proper repository method
      try {
        this.logger.warn(`[Assessment Revert] Attempting forceful revert for assessment ${assessmentId}`);

        const forceReverted = await this.assessmentRepo.revertAssessmentSubmission(assessmentId);

        this.logger.log(`[Assessment Revert] Forceful revert completed for assessment ${assessmentId}`);
        return forceReverted;
      } catch (forceError) {
        this.logger.error(
          `[Assessment Revert] Forceful revert also failed for assessment ${assessmentId}:`,
          forceError,
        );
        throw error; // Re-throw the original error
      }
    }
  }

  async getAssessmentStages(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<{
    assessmentId: string;
    assessmentType: string;
    stages: Array<{
      step: number;
      label: string;
      status: 'completed' | 'current' | 'upcoming';
    }>;
    currentStep: number;
  }> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    await this.verifyAssessmentAccess(userId, userRole, assessment);

    const stages =
      assessment.assessment_type === 'self_disclosure'
        ? this.getSelfDisclosureStages(assessment)
        : await this.getAssuredStages(assessment);

    const currentStep =
      stages.find((s) => s.status === 'current')?.step ??
      [...stages].reverse().find((s) => s.status === 'completed')?.step ??
      1;

    return {
      assessmentId: assessment.id,
      assessmentType: assessment.assessment_type,
      stages,
      currentStep,
    };
  }

  private getSelfDisclosureStages(
    assessment: { status: string },
  ): Array<{
    step: number;
    label: string;
    status: 'completed' | 'current' | 'upcoming';
  }> {
    const { status } = assessment;
    const isCompleted = status === 'completed';
    const isPastInProgress = status !== 'in_progress';

    return [
      {
        step: 1,
        label: 'Self-Disclosure In Progress',
        status: isPastInProgress ? 'completed' : 'current',
      },
      {
        step: 2,
        label: 'Self-Disclosure In Review',
        status: isCompleted
          ? 'completed'
          : isPastInProgress
            ? 'current'
            : 'upcoming',
      },
      {
        step: 3,
        label: 'Self-Disclosure Completed',
        status: isCompleted ? 'completed' : 'upcoming',
      },
    ];
  }

  private async getAssuredStages(
    assessment: { id: string; assigned_auditor_id: string | null; status: string },
  ): Promise<
    Array<{
      step: number;
      label: string;
      status: 'completed' | 'current' | 'upcoming';
    }>
  > {
    const audit =
      await this.assessmentRepo.getAuditRecordForAssessment(assessment.id);
    const lifecycle = audit?.audit_lifecycle_status ?? null;
    const hasAuditor = !!assessment.assigned_auditor_id;

    const lifecycleOrder = [
      'in_progress',
      'auditor_submitted',
      'reviewer_submitted',
      'completed',
    ];
    const lifecycleIndex = lifecycle
      ? lifecycleOrder.indexOf(lifecycle)
      : -1;

    return [
      {
        step: 1,
        label: 'Audit Requested',
        status: hasAuditor ? 'completed' : 'current',
      },
      {
        step: 2,
        label: 'Audit In Progress',
        status: lifecycleIndex >= 1
          ? 'completed'
          : hasAuditor
            ? 'current'
            : 'upcoming',
      },
      {
        step: 3,
        label: 'Pending Management Reviewer',
        status: lifecycleIndex >= 2
          ? 'completed'
          : lifecycleIndex === 1
            ? 'current'
            : 'upcoming',
      },
      {
        step: 4,
        label: 'Completed',
        status: lifecycleIndex >= 3
          ? 'completed'
          : lifecycleIndex === 2
            ? 'current'
            : 'upcoming',
      },
    ];
  }

  async getNextQuestion(
    assessmentId: string,
    currentQuestionId?: string,
    answer?: string,
  ): Promise<{ done: boolean; question: Record<string, unknown> | null }> {
    // 1. Get the assessment to find the certificate_id
    const assessmentResult = (await this.assessmentRepo['db'].query(
      `SELECT certificate_id FROM certificate_assessments WHERE id = $1`,
      [assessmentId],
    )) as { rows: { certificate_id: string }[] };

    if (!assessmentResult.rows.length) {
      throw new NotFoundException('Assessment not found');
    }
    const { certificate_id } = assessmentResult.rows[0];

    // 2. Load all questions for this certificate ordered by certificate_question_number
    const questionsResult = (await this.assessmentRepo['db'].query(
      `SELECT
         id,
         question,
         type,
         hint,
         criteria,
         ai_review_enabled,
         ai_review_criteria,
         ai_review_score,
         yes_score,
         no_score,
         conditional_logic_enabled,
         conditional_logic,
         options,
         score,
         short_code,
         question_number,
         certificate_question_number,
         main_section_id,
         section_id,
         sub_section_id,
         parent_question_id,
         parent_trigger_value,
         rank
       FROM questions
       WHERE certificate_id = $1
       ORDER BY certificate_question_number ASC NULLS LAST, rank ASC, id ASC`,
      [certificate_id],
    )) as {
      rows: Array<{
        id: string;
        question: string;
        type: string;
        hint: string | null;
        criteria: string | null;
        ai_review_enabled: boolean;
        ai_review_criteria: string | null;
        ai_review_score: number | null;
        yes_score: number | null;
        no_score: number | null;
        conditional_logic_enabled: boolean;
        conditional_logic: any | null;
        options: string[] | null;
        score: number;
        short_code: string | null;
        question_number: number;
        certificate_question_number: number;
        main_section_id: string;
        section_id: string;
        sub_section_id: string | null;
        parent_question_id: string | null;
        parent_trigger_value: 'yes' | 'no' | null;
        rank: number;
      }>;
    };

    const allQuestions = questionsResult.rows;

    // Helper: build sub-question arrays for a question
    const buildSubQuestions = (questionId: string, trigger: 'yes' | 'no') =>
      allQuestions
        .filter(
          (q) =>
            q.parent_question_id === questionId &&
            q.parent_trigger_value === trigger,
        )
        .sort((a, b) => a.rank - b.rank);

    // Helper: format a question for the response
    const formatQuestion = (q: (typeof allQuestions)[0]) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      hint: q.hint ?? null,
      criteria: q.criteria ?? null,
      ai_review_enabled: q.ai_review_enabled ?? false,
      ai_review_criteria: q.ai_review_criteria ?? null,
      ai_review_score: q.ai_review_score ?? null,
      yes_score: q.yes_score ?? null,
      no_score: q.no_score ?? null,
      conditional_logic_enabled: q.conditional_logic_enabled ?? false,
      conditional_logic: q.conditional_logic ?? null,
      options: q.options ?? null,
      score: q.score,
      short_code: q.short_code ?? null,
      question_number: q.question_number,
      certificate_question_number: q.certificate_question_number,
      parent_question_id: q.parent_question_id ?? null,
      parent_trigger_value: q.parent_trigger_value ?? null,
      yes_sub_questions: buildSubQuestions(q.id, 'yes'),
      no_sub_questions: buildSubQuestions(q.id, 'no'),
    });

    // Top-level questions (no parent)
    const topLevel = allQuestions.filter((q) => !q.parent_question_id);

    // 3. If no current_question_id, return first top-level question
    if (!currentQuestionId) {
      if (!topLevel.length) {
        return { done: true, question: null };
      }
      return { done: false, question: formatQuestion(topLevel[0]) };
    }

    // 4. Find the current question
    const current = allQuestions.find((q) => q.id === currentQuestionId);
    if (!current) {
      throw new NotFoundException('Current question not found');
    }

    // Helper: get next top-level question after a given top-level question id
    const targetMatchesQuestion = (
      q: (typeof allQuestions)[0],
      target: { target_type: string; target_id: string },
    ) => {
      if (target.target_type === 'question') return q.id === target.target_id;
      if (target.target_type === 'main_section')
        return q.main_section_id === target.target_id;
      if (target.target_type === 'section') return q.section_id === target.target_id;
      if (target.target_type === 'sub_section')
        return q.sub_section_id === target.target_id;
      return false;
    };

    const firstQuestionForTarget = (
      target?: { target_type: string; target_id: string } | null,
    ) => {
      if (!target) return null;
      return (
        allQuestions.find((q) => targetMatchesQuestion(q, target)) || null
      );
    };

    const nextTopLevel = (
      afterId: string,
      action?: {
        blocked_sections?: Array<{ target_type: string; target_id: string }>;
        allowed_sections?: Array<{ target_type: string; target_id: string }>;
      },
    ) => {
      const idx = topLevel.findIndex((q) => q.id === afterId);
      if (idx === -1 || idx + 1 >= topLevel.length) return null;

      const blocked = action?.blocked_sections || [];
      const allowed = action?.allowed_sections || [];
      return (
        topLevel.slice(idx + 1).find((q) => {
          const isBlocked = blocked.some((target) =>
            targetMatchesQuestion(q, target),
          );
          const isAllowed =
            allowed.length === 0 ||
            allowed.some((target) => targetMatchesQuestion(q, target));
          return !isBlocked && isAllowed;
        }) || null
      );
    };

    // 5. Current question is a sub-question (has parent)
    if (current.parent_question_id) {
      // find all sibling sub-questions in the same trigger group, ordered by rank
      const siblings = allQuestions
        .filter(
          (q) =>
            q.parent_question_id === current.parent_question_id &&
            q.parent_trigger_value === current.parent_trigger_value,
        )
        .sort((a, b) => a.rank - b.rank);

      const siblingIdx = siblings.findIndex((q) => q.id === currentQuestionId);
      if (siblingIdx !== -1 && siblingIdx + 1 < siblings.length) {
        // Next sibling in the group
        return { done: false, question: formatQuestion(siblings[siblingIdx + 1]) };
      }

      // After last sibling: go to next top-level after parent
      const next = nextTopLevel(current.parent_question_id);
      if (!next) return { done: true, question: null };
      return { done: false, question: formatQuestion(next) };
    }

    // 6. Current question is top-level
    if (current.type === 'boolean') {
      const triggerValue = answer === 'yes' ? 'yes' : answer === 'no' ? 'no' : null;
      if (triggerValue) {
        const conditionalAction =
          current.conditional_logic_enabled && current.conditional_logic
            ? current.conditional_logic[triggerValue]
            : null;
        const redirectedQuestion = firstQuestionForTarget(
          conditionalAction?.redirect_to,
        );
        if (redirectedQuestion) {
          return { done: false, question: formatQuestion(redirectedQuestion) };
        }

        const subQuestions = allQuestions
          .filter(
            (q) =>
              q.parent_question_id === current.id &&
              q.parent_trigger_value === triggerValue,
          )
          .sort((a, b) => a.rank - b.rank);

        if (subQuestions.length > 0) {
          return { done: false, question: formatQuestion(subQuestions[0]) };
        }

        const next = nextTopLevel(current.id, conditionalAction);
        if (!next) return { done: true, question: null };
        return { done: false, question: formatQuestion(next) };
      }
    }

    // Go to next top-level question
    const next = nextTopLevel(current.id);
    if (!next) return { done: true, question: null };
    return { done: false, question: formatQuestion(next) };
  }

}
