import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AssessmentInvitationRepository } from './assessment-invitation.repository';
import { AssessmentRepository } from '../assessment/assessment.repository';
import { AuditorRepository } from '../auditor/auditor.repository';
import { AuditorService } from '../auditor/auditor.service';
import { NotificationService } from '../notification/services/notification.service';
import { NotificationRepository } from '../notification/notification.repository';
import {
  NotificationType,
  NotificationPriority,
} from '../notification/types/notification.types';
import { AssessmentInvitationWithDetails } from './types/assessment-invitation.types';

@Injectable()
export class AssessmentInvitationService {
  constructor(
    private readonly invitationRepo: AssessmentInvitationRepository,
    @Inject(forwardRef(() => AssessmentRepository))
    private readonly assessmentRepo: AssessmentRepository,
    @Inject(forwardRef(() => AuditorRepository))
    private readonly auditorRepo: AuditorRepository,
    @Inject(forwardRef(() => AuditorService))
    private readonly auditorService: AuditorService,
    private readonly notificationService: NotificationService,
    private readonly notificationRepo: NotificationRepository,
  ) {}

  async createInvitation(
    assessmentId: string,
    auditorProfileId: string,
    invitedByUserId: string,
    invitedByRole?: string,
  ): Promise<{
    assessmentId: string;
    auditorId: string;
    auditorName: string | null;
    auditDate: string | null;
    invited: boolean;
  }> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException(
        `Assessment with ID "${assessmentId}" not found`,
      );
    }

    if (assessment.assigned_auditor_id) {
      // Allow reassignment for completed self-disclosure assessments
      if (
        assessment.assessment_type === 'self_disclosure' &&
        assessment.status === 'completed'
      ) {
        // Cancel any pending invitations — the old auditor will be replaced on accept
      } else {
        throw new BadRequestException(
          'This assessment is already assigned to an auditor. Unassign the current auditor before reassigning.',
        );
      }
    }

    const auditor = await this.auditorRepo.findById(auditorProfileId);
    if (!auditor) {
      throw new NotFoundException(
        `Auditor with ID "${auditorProfileId}" not found`,
      );
    }

    const auditorUserId = auditor.user_id as string;
    const firstName = auditor.first_name as string;
    const lastName = auditor.last_name as string;
    const auditorName = `${firstName} ${lastName}`.trim();

    // Cancel any existing pending invitation for this assessment
    await this.invitationRepo.cancelPendingByAssessment(assessmentId);

    const invitation = await this.invitationRepo.create({
      assessmentId,
      certificateId: assessment.certificate_id,
      invitedUserId: auditorUserId,
      invitedBy: invitedByUserId,
    });

    // Notify the auditor
    try {
      const inviterRoleLabel =
        invitedByRole === 'admin' || invitedByRole === 'subadmin'
          ? 'An admin'
          : invitedByRole === 'reviewer'
            ? 'A reviewer'
            : 'Someone';

      await this.notificationService.notifyUser(auditorUserId, {
        type: NotificationType.ACTION_REQUIRED,
        priority: NotificationPriority.HIGH,
        title: 'Assessment Invitation',
        message: `${inviterRoleLabel} has invited you to audit an assessment. Please accept or decline the invitation.`,
        module: 'assessment-invitation',
        metadata: {
          invitationId: invitation.id,
          assessmentId,
          certificateId: assessment.certificate_id,
          invitedByRole: invitedByRole || null,
        },
      });
    } catch {
      // Fire-and-forget: don't block the invitation flow if notification fails
    }

    return {
      assessmentId,
      auditorId: auditorProfileId,
      auditorName,
      auditDate: null,
      invited: true,
    };
  }

  async acceptInvitation(
    invitationId: string,
    auditorUserId: string,
  ): Promise<{
    assessmentId: string;
    auditorId: string | null;
    auditorName: string | null;
    auditDate: string | null;
  }> {
    const invitation = await this.invitationRepo.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException(
        `Invitation with ID "${invitationId}" not found`,
      );
    }

    if (invitation.invited_user_id !== auditorUserId) {
      throw new ForbiddenException('This invitation does not belong to you');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        `Invitation has already been ${invitation.status}`,
      );
    }

    await this.invitationRepo.updateStatus(invitationId, 'accepted');

    // Mark the original invitation notification as actioned so frontend hides the button
    try {
      await this.notificationRepo.setActionStatus(auditorUserId, invitationId, 'accepted');
    } catch {
      // Fire-and-forget
    }

    // Look up auditor profile to get the profile ID
    const auditor = await this.auditorRepo.findByUserId(auditorUserId);
    if (!auditor) {
      throw new NotFoundException('Auditor profile not found');
    }

    // Perform the actual assignment using the existing logic and bypass invitation recursion.
    const result = await this.auditorService.assignToAssessment(
      invitation.assessment_id,
      auditor.id as string,
      undefined,
      invitation.invited_by,
      undefined,
      true,
    );

    // Notify the reviewer who sent the invitation
    try {
      const firstName = auditor.first_name as string;
      const lastName = auditor.last_name as string;
      const auditorName = `${firstName} ${lastName}`.trim();

      await this.notificationService.notifyUser(invitation.invited_by, {
        type: NotificationType.SUCCESS,
        priority: NotificationPriority.MEDIUM,
        title: 'Invitation Accepted',
        message: `Auditor "${auditorName}" has accepted the assessment invitation.`,
        module: 'assessment-invitation',
        metadata: {
          invitationId: invitation.id,
          assessmentId: invitation.assessment_id,
          auditorUserId,
        },
      });
    } catch {
      // Fire-and-forget
    }

    return result;
  }

  async declineInvitation(
    invitationId: string,
    auditorUserId: string,
  ): Promise<{ id: string; status: string }> {
    const invitation = await this.invitationRepo.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException(
        `Invitation with ID "${invitationId}" not found`,
      );
    }

    if (invitation.invited_user_id !== auditorUserId) {
      throw new ForbiddenException('This invitation does not belong to you');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        `Invitation has already been ${invitation.status}`,
      );
    }

    const updated = await this.invitationRepo.updateStatus(
      invitationId,
      'declined',
    );

    // Mark the original invitation notification as declined so frontend hides the button
    try {
      await this.notificationRepo.setActionStatus(auditorUserId, invitationId, 'declined');
    } catch {
      // Fire-and-forget
    }

    // Notify the reviewer who sent the invitation
    try {
      const auditor = await this.auditorRepo.findByUserId(auditorUserId);
      const auditorName = auditor
        ? `${auditor.first_name as string} ${auditor.last_name as string}`.trim()
        : 'An auditor';

      await this.notificationService.notifyUser(invitation.invited_by, {
        type: NotificationType.WARNING,
        priority: NotificationPriority.HIGH,
        title: 'Invitation Declined',
        message: `Auditor "${auditorName}" has declined the assessment invitation. The assessment is available for reassignment.`,
        module: 'assessment-invitation',
        metadata: {
          invitationId: invitation.id,
          assessmentId: invitation.assessment_id,
          auditorUserId,
        },
      });
    } catch {
      // Fire-and-forget
    }

    return { id: updated.id, status: updated.status };
  }

  async getMyInvitations(
    auditorUserId: string,
    status?: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: AssessmentInvitationWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.invitationRepo.findByInvitedUser(
      auditorUserId,
      status,
      page,
      limit,
    );

    return {
      data: result.data,
      total: result.total,
      page,
      limit,
    };
  }
}
