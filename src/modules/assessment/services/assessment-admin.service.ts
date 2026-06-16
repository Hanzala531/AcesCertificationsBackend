import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  AssessmentRepository,
  CertificateAssessment,
  AssessmentWithDetails,
} from '../assessment.repository';
import { AssessmentNotificationService } from './assessment-notification.service';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../notification/types/notification.types';

@Injectable()
export class AssessmentAdminService {
  private readonly logger = new Logger(AssessmentAdminService.name);

  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly assessmentNotificationService: AssessmentNotificationService,
    private readonly notificationService: NotificationService,
  ) {}

  async getAdminAssessmentMetrics() {
    return this.assessmentRepo.getAdminAssessmentMetrics();
  }

  async getAdminDashboardStats() {
    return this.assessmentRepo.getAdminDashboardStats();
  }

  async getAdminDashboardChartStats() {
    return this.assessmentRepo.getAdminDashboardChartStats();
  }

  async getAdminAssessments(params: {
    page: number;
    limit: number;
    organizationId?: string;
    status?: string;
    assessmentType?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: 'date' | 'score';
    sortOrder?: 'asc' | 'desc';
  }) {
    return this.assessmentRepo.findAdminAssessments(params);
  }

  async getAdminAssessmentDetails(assessmentId: string) {
    const details =
      await this.assessmentRepo.findAdminAssessmentDetails(assessmentId);
    if (!details) {
      throw new NotFoundException(
        `Assessment with ID "${assessmentId}" not found`,
      );
    }
    return details;
  }

  async setCertificateBlockStatus(
    assessmentId: string,
    isBlocked: boolean,
    reason?: string,
    blockedByUserId?: string,
    blockedByRole?: string,
  ): Promise<{
    assessmentId: string;
    isBlocked: boolean;
    reason: string | null;
  }> {
    const assessment =
      await this.assessmentRepo.findAssessmentWithDetails(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const normalizedReason = reason?.trim() || null;
    if (isBlocked && !normalizedReason) {
      throw new BadRequestException(
        'Blocking reason is required when isBlocked is true',
      );
    }

    let blockedByProfileId: string | null = null;
    if (blockedByUserId && blockedByRole === 'subadmin') {
      const subadmin =
        await this.assessmentRepo.findSubadminByUserId(blockedByUserId);
      blockedByProfileId = subadmin?.id || null;
    }

    await this.assessmentRepo.setCertificateBlockStatus(
      assessmentId,
      isBlocked,
      isBlocked ? normalizedReason : null,
    );

    try {
      await this.sendCertificateBlockStatusNotification(
        assessment.id,
        assessment.organization_id,
        assessment.certificate_name || 'certificate',
        isBlocked,
        isBlocked ? normalizedReason : null,
        blockedByUserId || null,
        blockedByProfileId,
        blockedByRole || null,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send certificate block status notification for assessment ${assessmentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      assessmentId,
      isBlocked,
      reason: isBlocked ? normalizedReason : null,
    };
  }

  private async sendCertificateBlockStatusNotification(
    assessmentId: string,
    organizationId: string,
    certificateName: string,
    isBlocked: boolean,
    reason: string | null,
    blockedByUserId: string | null,
    blockedByProfileId: string | null,
    blockedByRole: string | null,
  ): Promise<void> {
    const organizationUsers =
      await this.assessmentNotificationService.getOrganizationUsers(
        organizationId,
      );
    if (organizationUsers.length === 0) {
      return;
    }

    const title = isBlocked ? 'Certificate Blocked' : 'Certificate Unblocked';
    const message = isBlocked
      ? `Certificate allocation has been blocked by admin for ${certificateName}. Reason: ${reason || 'Not provided'}. You cannot continue this assessment until it is unblocked.`
      : `Certificate allocation has been unblocked by admin for ${certificateName}. You can continue this assessment now.`;

    for (const userId of organizationUsers) {
      await this.notificationService.notifyUser(userId, {
        type: NotificationType.WARNING,
        title,
        message,
        module: 'assessment',
        actionUrl: `/assessments/${assessmentId}`,
        metadata: {
          assessment_id: assessmentId,
          organization_id: organizationId,
          certificate_name: certificateName,
          is_blocked: isBlocked,
          block_reason: reason,
          reason: reason,
          blocked_by_user_id: blockedByUserId,
          blocked_by_profile_id: blockedByProfileId,
          blocked_by_role: blockedByRole,
        },
      });
    }
  }
}
