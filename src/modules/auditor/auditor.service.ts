import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { AuditorRepository } from './auditor.repository';
import {
  AssessmentRepository,
  AssessmentWithDetails,
} from '../assessment/assessment.repository';
import { AssignedByRole } from '../../common/enums/assigned-by-role.enum';
import { ChatService } from '../chat/chat.service';
import { AssessmentInvitationService } from '../assessment-invitation/assessment-invitation.service';
import { NotificationService } from '../notification/services/notification.service';
import {
  NotificationType,
  NotificationPriority,
} from '../notification/types/notification.types';
import { AuditRepository } from '../audit/audit.repository';

@Injectable()
export class AuditorService {
  constructor(
    private auditorRepo: AuditorRepository,
    @Inject(forwardRef(() => AssessmentRepository))
    private assessmentRepo: AssessmentRepository,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
    @Inject(forwardRef(() => AssessmentInvitationService))
    private invitationService: AssessmentInvitationService,
    private readonly notificationService: NotificationService,
    private readonly auditRepo: AuditRepository,
  ) {}

  private readonly logger = new Logger(AuditorService.name);

  async create(
    userId: string,
    firstName: string,
    lastName: string,
    country?: string,
    state?: string,
    city?: string,
    profilePicture?: string,
    assignedCertificates?: string[],
    status?: string,
    accountStatus?: boolean,
  ): Promise<Record<string, unknown>> {
    if (!userId) throw new BadRequestException('User ID is required');
    if (!firstName) throw new BadRequestException('First name is required');
    if (!lastName) throw new BadRequestException('Last name is required');

    return this.auditorRepo.create(
      userId,
      firstName,
      lastName,
      country,
      state,
      city,
      profilePicture,
      assignedCertificates || [],
      status || 'available',
      accountStatus,
    );
  }

  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    return this.auditorRepo.findByUserId(userId);
  }

  async findById(id: string): Promise<Record<string, unknown>> {
    const auditor = await this.auditorRepo.findById(id);
    if (!auditor) throw new NotFoundException('Auditor not found');
    return auditor;
  }

  async findAll(params?: { limit?: number; offset?: number }): Promise<{
    auditors: Record<string, unknown>[];
    total: number;
  }> {
    return this.auditorRepo.findAll(params);
  }

  async update(
    id: string,
    fields: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const auditor = await this.auditorRepo.findById(id);
    if (!auditor) throw new NotFoundException('Auditor not found');
    return this.auditorRepo.update(id, fields);
  }

  async assignCertificates(
    id: string,
    certificateIds: string[],
  ): Promise<Record<string, unknown> | null> {
    let auditor = await this.auditorRepo.findById(id);
    if (!auditor) {
      auditor = await this.auditorRepo.findByUserId(id);
    }
    if (!auditor) throw new NotFoundException('Auditor not found');
    try {
      return await this.auditorRepo.assignCertificates(
        auditor.id as string,
        certificateIds,
      );
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message || '';
        if (
          msg.includes('invalid') ||
          msg.includes('already assigned') ||
          msg.includes('not assigned')
        ) {
          throw new BadRequestException(msg);
        }
      }
      throw error;
    }
  }

  async unassignCertificates(
    id: string,
    certificateIds: string[],
  ): Promise<Record<string, unknown> | null> {
    let auditor = await this.auditorRepo.findById(id);
    if (!auditor) {
      auditor = await this.auditorRepo.findByUserId(id);
    }
    if (!auditor) throw new NotFoundException('Auditor not found');
    try {
      return await this.auditorRepo.unassignCertificates(
        auditor.id as string,
        certificateIds,
      );
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message || '';
        if (msg.includes('invalid') || msg.includes('not assigned')) {
          throw new BadRequestException(msg);
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const auditor = await this.auditorRepo.findById(id);
    if (!auditor) throw new NotFoundException('Auditor not found');
    return this.auditorRepo.delete(id);
  }

  async assignToAssessment(
    assessmentId: string,
    auditorId: string | null,
    auditDate?: string,
    assignedByUserId?: string | null,
    assignerRole?: string,
    skipInvitationFlow = false,
  ): Promise<{
    assessmentId: string;
    auditorId: string | null;
    auditorName: string | null;
    auditDate: string | null;
    invited?: boolean;
  }> {
    // Reviewer/admin/subadmin assignment should be invitation-based unless explicitly bypassed.
    if (
      auditorId &&
      assignedByUserId &&
      !skipInvitationFlow &&
      ['reviewer', 'admin', 'subadmin'].includes(assignerRole || '')
    ) {
      const result = await this.invitationService.createInvitation(
        assessmentId,
        auditorId,
        assignedByUserId,
        assignerRole,
      );

      // Notify organization that an auditor has been invited
      this.notifyOrganization(assessmentId, result.auditorName, true).catch(
        () => {},
      );

      return result;
    }

    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException(
        `Assessment with ID "${assessmentId}" not found`,
      );
    }

    // Allow reassignment for completed self-disclosure assessments
    // (auto-unassign previous auditor so a new one can audit the disclosure)
    const isCompletedSelfDisclosure =
      assessment.assessment_type === 'self_disclosure' &&
      assessment.status === 'completed';

    if (auditorId && assessment.assigned_auditor_id) {
      if (isCompletedSelfDisclosure) {
        // Auto-unassign the previous auditor
        const previousAuditor = await this.auditorRepo.findByUserId(
          assessment.assigned_auditor_id,
        );
        if (previousAuditor) {
          await this.auditorRepo.removeAssignedAssessment(
            previousAuditor.id as string,
            assessmentId,
          );
        }
      } else {
        throw new BadRequestException(
          'This assessment is already assigned to an auditor. Unassign the current auditor before reassigning.',
        );
      }
    }

    let auditorProfileId: string | null = null;
    let auditorUserIdForDb: string | null = null;
    let auditorName: string | null = null;

    if (auditorId) {
      const auditor = await this.auditorRepo.findById(auditorId);
      if (!auditor) {
        throw new NotFoundException(`Auditor with ID "${auditorId}" not found`);
      }

      auditorProfileId = auditorId;
      auditorUserIdForDb = auditor.user_id as string;
      const firstName = auditor.first_name as string;
      const lastName = auditor.last_name as string;
      auditorName = `${firstName} ${lastName}`.trim();
    }

    const updatedAssessment = await this.assessmentRepo.assignAuditor(
      assessmentId,
      auditorUserIdForDb,
      auditDate ? new Date(auditDate) : auditorUserIdForDb ? undefined : null,
      assignedByUserId,
    );

    // When assigning an auditor to a completed self-disclosure, move status
    // to 'submitted' so the auditor can perform audit operations on it.
    if (auditorUserIdForDb && isCompletedSelfDisclosure) {
      await this.assessmentRepo.updateAssessmentStatus(
        assessmentId,
        'submitted',
      );
    }

    if (auditorProfileId && auditorUserIdForDb) {
      await this.auditorRepo.addAssignedAssessment(
        auditorProfileId,
        assessmentId,
        assessment.certificate_id,
        assignedByUserId || undefined,
      );

      try {
        await this.chatService.addParticipantToAssessmentThread(
          assessmentId,
          auditorUserIdForDb,
          'auditor',
        );
      } catch (error) {}

      // Create audit record on auditor assignment
      await this.auditRepo
        .createAuditOnAssignment(
          assessmentId,
          assessment.certificate_id,
          auditorUserIdForDb,
        )
        .catch((err) => {
          this.logger.error(
            `Failed to create audit record for assessment ${assessmentId}: ${err?.message}`,
            err?.stack,
          );
        });

      // Notify the auditor about the direct assignment
      const certName = await this.auditorRepo
        .getCertificateName(assessment.certificate_id)
        .catch(() => null);
      this.notificationService
        .notifyUser(auditorUserIdForDb, {
          type: NotificationType.ACTION_REQUIRED,
          priority: NotificationPriority.HIGH,
          title: 'Assessment Assigned',
          message: `You have been assigned to audit${certName ? ` the "${certName}"` : ' an'} assessment.`,
          module: 'auditor',
          metadata: {
            assessmentId,
            certificateId: assessment.certificate_id,
          },
        })
        .catch(() => {});

      // Notify organization about the auditor assignment
      this.notifyOrganization(assessmentId, auditorName).catch(() => {});
    } else if (auditorId === null) {
      if (assessment.assigned_auditor_id) {
        const previousAuditor = await this.auditorRepo.findByUserId(
          assessment.assigned_auditor_id,
        );
        if (previousAuditor) {
          await this.auditorRepo.removeAssignedAssessment(
            previousAuditor.id as string,
            assessmentId,
          );
        }
      }
    }

    return {
      assessmentId: updatedAssessment.id,
      auditorId: auditorId,
      auditorName: auditorName,
      auditDate: updatedAssessment.audit_date
        ? new Date(updatedAssessment.audit_date).toISOString()
        : null,
    };
  }

  private async notifyOrganization(
    assessmentId: string,
    auditorName: string | null,
    isInvitation = false,
  ): Promise<void> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) return;

    const certName = await this.auditorRepo
      .getCertificateName(assessment.certificate_id)
      .catch(() => null);

    const userIds = await this.auditorRepo.getOrganizationUserIds(
      assessment.organization_id,
    );
    if (userIds.length === 0) return;

    const auditorLabel = auditorName || 'An auditor';
    const certLabel = certName ? ` your "${certName}"` : ' your';

    const title = isInvitation
      ? 'Auditor Invited to Your Assessment'
      : 'Auditor Assigned to Your Assessment';
    const message = isInvitation
      ? `${auditorLabel} has been invited to audit${certLabel} assessment.`
      : `${auditorLabel} has been assigned to${certLabel} assessment.`;

    await this.notificationService.notifyUsers(userIds, {
      type: NotificationType.INFO,
      priority: NotificationPriority.MEDIUM,
      title,
      message,
      module: 'auditor',
      metadata: { assessmentId, certificateId: assessment.certificate_id },
    });
  }

  async updateAuditDate(
    assessmentId: string,
    auditorUserId: string,
    auditDate: string,
  ): Promise<{
    assessmentId: string;
    auditDate: string;
  }> {
    // Verify assessment exists
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException(
        `Assessment with ID "${assessmentId}" not found`,
      );
    }

    const auditorRecord =
      await this.assessmentRepo.findAuditorByUserId(auditorUserId);
    if (!auditorRecord || assessment.assigned_auditor_id !== auditorUserId) {
      throw new BadRequestException(
        'You are not assigned as the auditor for this assessment',
      );
    }

    const updatedAssessment = await this.assessmentRepo.updateAuditDate(
      assessmentId,
      new Date(auditDate),
    );

    return {
      assessmentId: updatedAssessment.id,
      auditDate: new Date(updatedAssessment.audit_date as Date).toISOString(),
    };
  }

  async getAssignedAssessments(
    auditorUserId: string,
    page: number,
    limit: number,
    status?: string,
    assignedByRole?: AssignedByRole,
  ): Promise<{
    data: AssessmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const auditor = await this.auditorRepo.findByUserId(auditorUserId);
    if (!auditor) throw new NotFoundException('Auditor not found');

    return this.assessmentRepo.findAssessmentsByAuditor(auditorUserId, {
      page,
      limit,
      status,
      assignedByRole,
    });
  }

  async getDashboardStats(auditorUserId: string): Promise<{
    total_assigned: number;
    completed: number;
    in_progress: number;
    submitted: number;
    pending_invitations: number;
  }> {
    const auditor = await this.auditorRepo.findByUserId(auditorUserId);
    if (!auditor) throw new NotFoundException('Auditor not found');

    return this.auditorRepo.getDashboardStats(auditorUserId);
  }

  async getUpcomingAudits(
    auditorUserId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const auditor = await this.auditorRepo.findByUserId(auditorUserId);
    if (!auditor) throw new NotFoundException('Auditor not found');

    const result = await this.auditorRepo.getUpcomingAudits(
      auditorUserId,
      page,
      limit,
    );
    return { ...result, page, limit };
  }
}
