import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AssessmentRepository } from '../assessment/assessment.repository';
import { ChatService } from '../chat/chat.service';
import { NotificationService } from '../notification/services/notification.service';
import {
  NotificationType,
  NotificationPriority,
} from '../notification/types/notification.types';
import { AiProviderFactory } from '../ai-review/providers/ai-provider.factory';
import { AiConfigService } from '../../config/ai.config';
import { ScoreCalculationService } from '../certificate/services/score-calculation.service';
import {
  Audit,
  AuditWithDetails,
  AiAuditScore,
  AuditAssessmentView,
  AuditMainSection,
  AuditSection,
  AuditSubSection,
  AuditQuestion,
  AuditQuestionRow,
  AuditorAuditRow,
  ComplianceAction,
  IssuedCertificate,
  AuditorAuditsPaginatedResult,
} from './types/audit.types';
import {
  UpsertAuditDto,
  UpsertReviewDto,
  BlockCertificateDto,
} from './dto/audit.dto';

const ACTION_LABELS: Record<string, string> = {
  request_clarification: 'Request Clarification',
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly auditRepo: AuditRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly aiConfig: AiConfigService,
    private readonly scoreCalculationService: ScoreCalculationService,
  ) {}

  async getAuditView(
    assessmentId: string,
    filters?: {
      questionType?: 'pdf' | 'text' | 'boolean';
      flaggedOnly?: boolean;
    },
  ): Promise<AuditAssessmentView> {
    const assessment = await this.auditRepo.getAssessmentInfo(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const [rows, auditRecord] = await Promise.all([
      this.auditRepo.getQuestionsWithAuditData(
        assessmentId,
        assessment.certificate_id,
        assessment.organization_id,
        assessment.assessment_type,
      ),
      this.auditRepo.findByAssessmentIdWithDetails(assessmentId),
    ]);

    return {
      assessmentId: assessment.id,
      certificateId: assessment.certificate_id,
      certificateName: assessment.certificate_name,
      organizationId: assessment.organization_id,
      organizationName: assessment.organization_name,
      status: assessment.status,
      assessmentType: assessment.assessment_type,
      assignedAuditorId: assessment.assigned_auditor_id,
      assignedReviewerId: assessment.assigned_reviewer_id,
      auditDate: assessment.audit_date,
      requestedReviewer: {
        isTrue: assessment.requested_reviewer_is_true,
        name: assessment.requested_reviewer_name,
        date: assessment.requested_reviewer_date,
      },
      auditRecord,
      sections: this.buildHierarchy(rows, filters),
    };
  }

  async updateReviewerNotes(
    assessmentId: string,
    questionId: string,
    reviewerNotes: string,
    userId: string,
    reviewerProfileId?: string,
  ): Promise<{ id: string; reviewerNotes: string | null; updatedAt: Date }> {
    await this.verifyReviewerAccess(userId, assessmentId, reviewerProfileId);
    const assessment = await this.auditRepo.getAssessmentInfo(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    const query = await this.auditRepo.findQueryByQuestionAndAssessment(
      questionId,
      assessmentId,
      assessment.assessment_type,
    );
    if (!query) {
      throw new NotFoundException(
        'No answer found for this question in the assessment',
      );
    }
    const updated = await this.auditRepo.updateReviewerNotes(
      query.id,
      reviewerNotes,
    );
    return {
      id: updated.id,
      reviewerNotes: updated.reviewer_notes,
      updatedAt: updated.updated_at,
    };
  }

  async updateAuditorNotes(
    assessmentId: string,
    questionId: string,
    auditorNotes: string,
    userId: string,
    auditorProfileId?: string,
  ): Promise<{ id: string; auditorNotes: string | null; updatedAt: Date }> {
    await this.verifyAuditorAccess(userId, assessmentId, auditorProfileId);
    const assessment = await this.auditRepo.getAssessmentInfo(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    const query = await this.auditRepo.findQueryByQuestionAndAssessment(
      questionId,
      assessmentId,
      assessment.assessment_type,
    );
    if (!query) {
      throw new NotFoundException(
        'No answer found for this question in the assessment',
      );
    }
    const updated = await this.auditRepo.updateAuditorNotes(
      query.id,
      auditorNotes,
    );
    return {
      id: updated.id,
      auditorNotes: updated.auditor_notes,
      updatedAt: updated.updated_at,
    };
  }

  async upsertAudit(
    assessmentId: string,
    dto: UpsertAuditDto,
    userId?: string,
    userRole?: string,
    auditorProfileId?: string,
  ): Promise<Audit> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Auditors must be assigned to this assessment; admins/subadmins bypass
    if (userId && userRole === 'auditor') {
      await this.verifyAuditorAccess(userId, assessmentId, auditorProfileId);
    }

    // Require the assigned auditor to have a signature on file before
    // finalizing the audit decision.
    if (dto.status) {
      const auditorUserId = assessment.assigned_auditor_id;
      if (!auditorUserId) {
        throw new BadRequestException(
          'No auditor is assigned to this assessment',
        );
      }
      const signature =
        await this.auditRepo.findAuditorSignatureByUserId(auditorUserId);
      if (!signature) {
        throw new BadRequestException(
          'Auditor signature is required before submitting the audit decision. Upload a signature in the auditor profile first.',
        );
      }
    }

    const result = await this.auditRepo.upsert({
      assessmentId,
      certificateId: assessment.certificate_id,
      auditSummary: dto.auditSummary,
      auditSummaryDoc: dto.auditSummaryDoc,
      auditDescription: dto.auditDescription,
      status: dto.status,
    });

    if (dto.status) {
      await this.chatService
        .lockThreadByAssessmentId(
          assessmentId,
          `Assessment audit finalized: ${dto.status}`,
        )
        .catch(() => {});
    }

    return result;
  }

  async upsertReview(
    assessmentId: string,
    dto: UpsertReviewDto,
    userId: string,
    reviewerProfileId?: string,
  ): Promise<Audit> {
    await this.verifyReviewerAccess(userId, assessmentId, reviewerProfileId);

    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const audit = await this.auditRepo.findByAssessmentId(assessmentId);
    if (!audit) {
      throw new BadRequestException(
        'No audit record found for this assessment. The auditor must submit an audit first.',
      );
    }

    // Require the reviewer to have a signature on file before finalizing
    // the review decision.
    if (dto.reviewStatus) {
      const signature =
        await this.auditRepo.findReviewerSignatureByUserId(userId);
      if (!signature) {
        throw new BadRequestException(
          'Reviewer signature is required before submitting the review decision. Upload a signature in the reviewer profile first.',
        );
      }
    }

    const result = await this.auditRepo.upsertReview({
      assessmentId,
      reviewSummary: dto.reviewSummary,
      reviewSummaryDoc: dto.reviewSummaryDoc,
      reviewDescription: dto.reviewDescription,
      reviewStatus: dto.reviewStatus,
      reviewedBy: userId,
    });

    // Trigger AI audit scoring asynchronously after review submission
    this.triggerAiAuditScoring(assessmentId, result.id).catch((err) =>
      this.logger.error(
        `AI audit scoring failed for assessment ${assessmentId}: ${err.message}`,
      ),
    );

    return result;
  }

  async issueCertificate(
    assessmentId: string,
    userId: string,
    reviewerProfileId?: string,
  ): Promise<IssuedCertificate> {
    await this.verifyReviewerAccess(userId, assessmentId, reviewerProfileId);

    const assessment = await this.auditRepo.getAssessmentInfo(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const existing = await this.auditRepo.findIssuedCertificate(assessmentId);
    if (existing && !existing.is_blocked) {
      throw new ConflictException(
        'A certificate has already been issued for this assessment',
      );
    }

    const audit = await this.auditRepo.findByAssessmentId(assessmentId);
    if (!audit || !audit.review_status) {
      throw new BadRequestException(
        'Reviewer must submit a final review decision before issuing a certificate',
      );
    }
    if (audit.review_status === 'rejected') {
      throw new BadRequestException(
        'Cannot issue a certificate for a rejected assessment',
      );
    }

    // Use AI-generated score for badge determination
    const aiScore = await this.auditRepo.findLatestAiAuditScore(assessmentId);
    if (!aiScore) {
      throw new BadRequestException(
        'AI scoring has not completed yet. Please wait for the AI score before issuing a certificate.',
      );
    }

    let badge: {
      id: string;
      name: string;
      slot: number;
      color: string | null;
    } | null = null;
    badge = await this.scoreCalculationService.assignBadge(
      assessment.certificate_id,
      Number(aiScore.ai_score),
      assessment.assessment_type,
      assessment.organization_id,
    ).then((result) =>
      result.badgeId && result.badgeName
        ? {
            id: result.badgeId,
            name: result.badgeName,
            slot: 0,
            color: null,
          }
        : null,
    );

    // Look up the organization_badge allocated during AI scoring for this assessment
    const orgBadge =
      await this.auditRepo.findOrgBadgeByAssessmentId(assessmentId);

    const certNumber = await this.auditRepo.getNextCertificateNumber();

    // Compute expiry date from the certificate's validity configuration
    const validityDays = assessment.validity_days ?? 0;
    const validityMonths = assessment.validity_months ?? 0;
    const validityYears = assessment.validity_years ?? 0;
    let expiryDate: string | null = null;
    if (validityDays > 0 || validityMonths > 0 || validityYears > 0) {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + validityYears);
      expiry.setMonth(expiry.getMonth() + validityMonths);
      expiry.setDate(expiry.getDate() + validityDays);
      expiryDate = expiry.toISOString();
    }

    const issued = await this.auditRepo.createIssuedCertificate({
      assessmentId,
      certificateId: assessment.certificate_id,
      certificateName: assessment.certificate_name,
      organizationId: assessment.organization_id,
      branchId: assessment.branch_id,
      badgeId: badge?.id ?? null,
      badgeName: badge?.name ?? null,
      badgeColor: badge?.color ?? null,
      orgBadgeId: orgBadge?.id ?? null,
      certificateNumber: certNumber,
      reviewScore: Number(aiScore.ai_score),
      issuedBy: userId,
      expiryDate,
    });

    await this.auditRepo.setAssessmentCompleted(assessmentId).catch(() => {});
    await this.auditRepo
      .setAuditLifecycleStatus(assessmentId, 'completed')
      .catch(() => {});

    this.auditRepo
      .getApplicantUserIds(assessment.organization_id, assessment.branch_id)
      .then((userIds) => {
        if (userIds.length === 0) return;
        const badgeMsg = badge ? ` Badge awarded: ${badge.name}.` : '';
        return this.notificationService.notifyUsers(userIds, {
          type: NotificationType.SUCCESS,
          priority: NotificationPriority.HIGH,
          title: 'Certificate Issued',
          message: `Your certificate "${assessment.certificate_name}" has been issued. Number: ${certNumber}.${badgeMsg}`,
          module: 'audit',
          metadata: {
            assessmentId,
            certificateNumber: certNumber,
            badgeId: badge?.id ?? null,
          },
        });
      })
      .catch(() => {});

    return issued;
  }

  async blockCertificate(
    assessmentId: string,
    dto: BlockCertificateDto,
    userId: string,
  ): Promise<IssuedCertificate> {
    const assessment = await this.auditRepo.getAssessmentInfo(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const issued = await this.auditRepo.findIssuedCertificate(assessmentId);
    if (!issued) {
      throw new NotFoundException(
        'No issued certificate found for this assessment',
      );
    }
    if (issued.is_blocked) {
      throw new ConflictException('Certificate is already blocked');
    }

    const [blocked] = await Promise.all([
      this.auditRepo.blockIssuedCertificate(assessmentId, dto.reason, userId),
      this.auditRepo.blockAssessmentCertificate(assessmentId, dto.reason),
    ]);

    this.auditRepo
      .getApplicantUserIds(assessment.organization_id, assessment.branch_id)
      .then((userIds) => {
        if (userIds.length === 0) return;
        return this.notificationService.notifyUsers(userIds, {
          type: NotificationType.ACTION_REQUIRED,
          priority: NotificationPriority.HIGH,
          title: 'Certificate Blocked',
          message: `Your certificate "${assessment.certificate_name}" has been blocked. Reason: ${dto.reason}`,
          module: 'audit',
          metadata: { assessmentId, reason: dto.reason },
        });
      })
      .catch(() => {});

    return blocked;
  }

  async reauditAssessment(
    assessmentId: string,
    userId: string,
  ): Promise<{
    newAuditId: string;
    version: number;
    assessmentId: string;
    previousCertificateBlocked: boolean;
  }> {
    const assessment = await this.auditRepo.getAssessmentInfo(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const archived = await this.auditRepo.archiveCurrentAudit(assessmentId);
    const newVersion = (archived?.version ?? 0) + 1;

    const newAudit = await this.auditRepo.createAuditForReaudit(
      assessmentId,
      assessment.certificate_id,
      newVersion,
    );

    let previousCertificateBlocked = false;
    const issued = await this.auditRepo.findIssuedCertificate(assessmentId);
    if (issued && !issued.is_blocked) {
      await Promise.all([
        this.auditRepo.blockIssuedCertificate(
          assessmentId,
          'Re-audit initiated',
          userId,
        ),
        this.auditRepo.blockAssessmentCertificate(
          assessmentId,
          'Re-audit initiated',
        ),
      ]).catch(() => {});
      previousCertificateBlocked = true;
    }

    if (assessment.assigned_auditor_id) {
      this.notificationService
        .notifyUsers([assessment.assigned_auditor_id], {
          type: NotificationType.ACTION_REQUIRED,
          priority: NotificationPriority.HIGH,
          title: 'Re-audit Required',
          message: `Assessment for certificate "${assessment.certificate_name}" has been sent for re-audit. Please review and submit a new audit.`,
          module: 'audit',
          metadata: { assessmentId },
        })
        .catch(() => {});
    }

    return {
      newAuditId: newAudit.id,
      version: newVersion,
      assessmentId,
      previousCertificateBlocked,
    };
  }

  async postComplianceAction(
    assessmentId: string,
    questionId: string,
    action: 'request_clarification',
    message: string,
    userId: string,
    userRole: string,
    auditorProfileId?: string,
    reviewerProfileId?: string,
    clarificationTarget?: 'applicant' | 'reviewer',
  ): Promise<ComplianceAction> {
    const assessment = await this.auditRepo.getAssessmentInfo(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const audit = await this.auditRepo.findByAssessmentId(assessmentId);
    if (audit?.review_status) {
      throw new ConflictException(
        'Assessment audit is finalized; no further compliance actions are allowed',
      );
    }

    if (userRole === 'auditor') {
      await this.verifyAuditorAccess(userId, assessmentId, auditorProfileId);
    } else {
      await this.verifyReviewerAccess(userId, assessmentId, reviewerProfileId);
    }

    const chatContent = message;
    const orgUserIds = await this.auditRepo.getApplicantUserIds(
      assessment.organization_id,
      assessment.branch_id,
    );

    // Thread routing:
    //   reviewer → reviewer_applicant (reviewer ↔ applicant), per question
    //   auditor + request_clarification → auditor_reviewer (auditor ↔ reviewer), per question
    //   auditor + non-clarification → auditor_applicant (auditor ↔ applicant)
    let thread;
    let resolvedTarget: 'applicant' | 'reviewer' | null = null;

    if (userRole === 'reviewer') {
      thread = await this.chatService.findOrCreateTypedThread(
        assessmentId,
        'reviewer_applicant',
        userId,
        'reviewer',
        orgUserIds,
        'applicant',
        questionId,
      );
    } else {
      // Auditor request_clarification → auditor_reviewer thread (per question)
      const reviewerUserId =
        await this.auditRepo.getAssignedReviewerUserId(assessmentId);
      if (!reviewerUserId) {
        throw new BadRequestException(
          'No reviewer assigned to this assessment',
        );
      }
      thread = await this.chatService.findOrCreateTypedThread(
        assessmentId,
        'auditor_reviewer',
        userId,
        'auditor',
        [reviewerUserId],
        'reviewer',
        questionId,
      );
      resolvedTarget = 'reviewer';
    }

    const chatMsg = await this.chatService.sendMessage(
      thread.id,
      userId,
      chatContent,
    );

    const complianceAction = await this.auditRepo.createComplianceAction({
      assessmentId,
      questionId,
      actionType: action,
      message,
      createdBy: userId,
      createdByRole: userRole,
      chatMessageId: chatMsg.id,
      clarificationTarget: resolvedTarget,
    });

    // Fetch question context for rich notifications
    const questionContext = await this.auditRepo
      .getQuestionContext(questionId, assessmentId)
      .catch(() => null);

    const label = ACTION_LABELS[action];
    const sectionPath = questionContext
      ? [
          questionContext.main_section_name,
          questionContext.section_name,
          questionContext.sub_section_name,
        ]
          .filter(Boolean)
          .join(' > ')
      : '';
    const questionText = questionContext?.question_text || 'Unknown question';
    const answerText = questionContext?.response_value || 'No answer provided';
    const preview =
      message.length > 100 ? `${message.slice(0, 100)}…` : message;

    const notificationMetadata: Record<string, unknown> = {
      assessmentId,
      questionId,
      action,
      questionText,
      answerText,
      sectionPath,
      certificateName: assessment.certificate_name,
    };

    // Build structured message with question context
    const buildMessage = (audience: 'reviewer' | 'applicant') => {
      const lines: string[] = [];
      if (action === 'request_clarification' && audience === 'reviewer') {
        lines.push(
          `Auditor has requested clarification on a question in "${assessment.certificate_name}".`,
        );
      } else {
        lines.push(
          `A compliance action has been recorded for your assessment "${assessment.certificate_name}".`,
        );
      }
      if (sectionPath) {
        lines.push(`Section: ${sectionPath}`);
      }
      lines.push(`Question: ${questionText}`);
      lines.push(`Applicant Answer: ${answerText}`);
      lines.push(`Auditor's Note: ${preview}`);
      return lines.join('\n');
    };

    const notificationTitle = `Clarification Requested — ${assessment.certificate_name}`;

    // Notify reviewer
    if (resolvedTarget === 'reviewer') {
      const reviewerUserId =
        await this.auditRepo.getAssignedReviewerUserId(assessmentId);
      if (reviewerUserId) {
        this.notificationService
          .notifyUsers([reviewerUserId], {
            type: NotificationType.ACTION_REQUIRED,
            priority: NotificationPriority.HIGH,
            title: notificationTitle,
            message: buildMessage('reviewer'),
            module: 'audit',
            metadata: notificationMetadata,
          })
          .catch(() => {});
      }
    }

    // Notify applicant(s)
    if (orgUserIds.length > 0) {
      this.notificationService
        .notifyUsers(orgUserIds, {
          type: NotificationType.ACTION_REQUIRED,
          priority: NotificationPriority.HIGH,
          title: notificationTitle,
          message: buildMessage('applicant'),
          module: 'audit',
          metadata: notificationMetadata,
        })
        .catch(() => {});
    }

    return complianceAction;
  }

  async getAiAuditScore(assessmentId: string): Promise<AiAuditScore | null> {
    return this.auditRepo.findLatestAiAuditScore(assessmentId);
  }

  private async triggerAiAuditScoring(
    assessmentId: string,
    auditId: string,
  ): Promise<void> {
    const audit = await this.auditRepo.findByAssessmentId(assessmentId);
    if (!audit) return;

    const assessment = await this.auditRepo.getAssessmentInfo(assessmentId);
    if (!assessment) return;

    const provider = this.aiProviderFactory.getProvider();
    const model = this.aiConfig.getModel();

    const result = await provider.scoreAuditReview(
      {
        auditSummary: audit.audit_summary,
        auditDescription: audit.audit_description,
        auditStatus: audit.status,
        reviewSummary: audit.review_summary,
        reviewDescription: audit.review_description,
        reviewStatus: audit.review_status,
      },
      {
        certificateName: assessment.certificate_name,
        organizationName: assessment.organization_name,
        assessmentType: assessment.assessment_type,
      },
    );

    await this.auditRepo.createAiAuditScore({
      assessmentId,
      auditId,
      aiScore: result.score,
      aiReasoning: result.reasoning,
      promptVersion: '1.0',
      modelUsed: model,
    });

    await this.auditRepo.updateAuditScores(auditId, result.score);

    this.logger.log(
      `AI audit scoring completed for assessment ${assessmentId}: score=${result.score}`,
    );
  }

  private async verifyReviewerAccess(
    userId: string,
    assessmentId: string,
    reviewerProfileId?: string,
  ): Promise<void> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    const assignedId = assessment.assigned_reviewer_id;

    this.logger.debug(
      `verifyReviewerAccess — assignedId="${assignedId}", userId="${userId}", reviewerProfileId="${reviewerProfileId}"`,
    );

    if (!assignedId) {
      throw new BadRequestException(
        'No reviewer has been assigned to this assessment. Please assign a reviewer first.',
      );
    }

    // Match against user ID (from JWT sub)
    if (assignedId === userId) return;
    // Match against reviewer profile ID (from JWT reviewer_id)
    if (reviewerProfileId && assignedId === reviewerProfileId) return;
    // Fallback: look up reviewer profile and match against profile ID
    const reviewerRecord =
      await this.assessmentRepo.findReviewerByUserId(userId);
    if (reviewerRecord && assignedId === reviewerRecord.id) return;

    this.logger.error(
      `Reviewer access denied — assignedId="${assignedId}", userId="${userId}", reviewerProfileId="${reviewerProfileId}", reviewerRecord.id="${reviewerRecord?.id}"`,
    );
    throw new ForbiddenException(
      'You are not assigned as reviewer for this assessment',
    );
  }

  private async verifyAuditorAccess(
    userId: string,
    assessmentId: string,
    auditorProfileId?: string,
  ): Promise<void> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    const assignedId = assessment.assigned_auditor_id;

    this.logger.debug(
      `verifyAuditorAccess — assignedId="${assignedId}", userId="${userId}", auditorProfileId="${auditorProfileId}"`,
    );

    if (!assignedId) {
      throw new BadRequestException(
        'No auditor has been assigned to this assessment. Please assign an auditor first.',
      );
    }

    // Match against user ID (from JWT sub)
    if (assignedId === userId) return;
    // Match against auditor profile ID (from JWT auditor_id)
    if (auditorProfileId && assignedId === auditorProfileId) return;
    // Fallback: look up auditor profile and match against profile ID
    const auditorRecord = await this.assessmentRepo.findAuditorByUserId(userId);
    if (auditorRecord && assignedId === auditorRecord.id) return;

    this.logger.error(
      `Auditor access denied — assignedId="${assignedId}", userId="${userId}", auditorProfileId="${auditorProfileId}", auditorRecord.id="${auditorRecord?.id}"`,
    );
    throw new ForbiddenException(
      'You are not assigned as auditor for this assessment',
    );
  }

  private buildHierarchy(
    rows: AuditQuestionRow[],
    filters?: {
      questionType?: 'pdf' | 'text' | 'boolean';
      flaggedOnly?: boolean;
    },
  ): AuditMainSection[] {
    const mainSectionMap = new Map<string, AuditMainSection>();
    const sectionMap = new Map<string, AuditSection>();
    const subSectionMap = new Map<string, AuditSubSection>();

    // Base: only show questions that have been answered (attempted)
    let filteredRows = rows.filter((r) => r.answer_id !== null);

    if (filters?.questionType) {
      filteredRows = filteredRows.filter(
        (r) => r.response_type === filters.questionType,
      );
    }

    if (filters?.flaggedOnly) {
      filteredRows = filteredRows.filter((r) => r.is_flagged === true);
    }

    for (const row of filteredRows) {
      if (!mainSectionMap.has(row.main_section_id)) {
        mainSectionMap.set(row.main_section_id, {
          mainSectionId: row.main_section_id,
          mainSectionName: row.main_section_name,
          mainSectionShortCode: row.main_section_short_code,
          sections: [],
        });
      }

      const mainSection = mainSectionMap.get(row.main_section_id)!;

      if (!sectionMap.has(row.section_id)) {
        const section: AuditSection = {
          sectionId: row.section_id,
          sectionName: row.section_name,
          sectionShortCode: row.section_short_code,
          subSections: [],
          questions: [],
        };
        sectionMap.set(row.section_id, section);
        mainSection.sections.push(section);
      }

      const section = sectionMap.get(row.section_id)!;
      const question = this.buildQuestion(row);

      if (row.is_third_level && row.sub_section_id) {
        if (!subSectionMap.has(row.sub_section_id)) {
          const subSection: AuditSubSection = {
            subSectionId: row.sub_section_id,
            subSectionName: row.sub_section_name!,
            subSectionShortCode: row.sub_section_short_code,
            questions: [],
          };
          subSectionMap.set(row.sub_section_id, subSection);
          section.subSections.push(subSection);
        }
        subSectionMap.get(row.sub_section_id)!.questions.push(question);
      } else {
        section.questions.push(question);
      }
    }

    return Array.from(mainSectionMap.values());
  }

  private buildQuestion(row: AuditQuestionRow): AuditQuestion {
    const hasAiData =
      row.is_flagged !== null ||
      row.flag_reason !== null ||
      row.summary !== null;

    return {
      questionId: row.question_id,
      questionText: row.question_text,
      questionShortCode: row.question_short_code,
      questionType: row.question_type,
      applicantAnswer: row.response_value,
      responseType: row.response_type,
      responseFiles: row.response_files ?? null,
      reviewerNotes: row.reviewer_notes,
      auditorNotes: row.auditor_notes,
      aiReview: hasAiData
        ? {
            isFlagged: Boolean(row.is_flagged),
            flagReason: row.flag_reason,
            confidenceScore: row.confidence_score,
            riskLevel: row.risk_level,
            category: row.category,
            summary: row.summary,
            aiSuggestion: row.ai_suggestion,
          }
        : null,
    };
  }

  async getAuditorAudits(
    userId: string,
    role: string,
    auditorProfileId?: string,
    lifecycleStatus?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<AuditorAuditsPaginatedResult> {
    let auditorUserId: string;

    if (role === 'auditor') {
      auditorUserId = userId;
    } else {
      if (!auditorProfileId) {
        throw new BadRequestException(
          'auditorProfileId query parameter is required for admin access',
        );
      }
      const resolvedUserId =
        await this.auditRepo.findAuditorUserIdByProfileId(auditorProfileId);
      if (!resolvedUserId) {
        throw new NotFoundException('Auditor not found');
      }
      auditorUserId = resolvedUserId;
    }

    return this.auditRepo.findAuditorAudits(
      auditorUserId,
      lifecycleStatus,
      page,
      limit,
    );
  }
}
