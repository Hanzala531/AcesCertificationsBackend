import { Injectable, Logger } from '@nestjs/common';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';
import { CertificateRepository } from '../../certificate/certificate.repository';
import { AssessmentRepository } from '../../assessment/assessment.repository';
import { NotificationService } from '../../notification/services/notification.service';
import { BadgeService } from '../../notification/badge.service';
import { NotificationType } from '../../notification/types/notification.types';

@Injectable()
export class AiReviewNotificationService {
  private readonly logger = new Logger(AiReviewNotificationService.name);

  constructor(
    private readonly organizationRepo: OrganizationRepository,
    private readonly employeeRepo: EmployeeRepository,
    private readonly certificateRepo: CertificateRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly notificationService: NotificationService,
    private readonly badgeService: BadgeService,
  ) {}

  async getOrganizationUsers(organizationId: string): Promise<string[]> {
    try {
      const org = await this.organizationRepo.findById(organizationId);
      if (!org) {
        return [];
      }

      const employeesResult = await this.employeeRepo.findByOrganizationId(
        organizationId,
        1000,
        0,
      );
      const userIds: string[] = [];

      if (org.user_id) {
        userIds.push(org.user_id);
      }

      employeesResult.data.forEach((emp) => {
        if (emp.user_id) {
          userIds.push(emp.user_id);
        }
      });

      return [...new Set(userIds)];
    } catch (error) {
      this.logger.error(
        `Failed to get organization users: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async allocateOrganizationBadge(
    assessment: {
      id: string;
      organization_id: string;
      branch_id: string | null;
      certificate_id: string;
    },
    score: number,
    organizationUsers: string[],
  ): Promise<void> {
    try {
      if (organizationUsers.length === 0) {
        this.logger.warn(
          `No users found for organization ${assessment.organization_id}, skipping badge allocation`,
        );
        return;
      }

      const assessedByUserId = organizationUsers[0];

      const badgeResult = await this.badgeService.allocateBadge({
        organizationId: assessment.organization_id,
        branchId: assessment.branch_id,
        certificateId: assessment.certificate_id,
        score,
        assessedByUserId,
        assessmentId: assessment.id,
      });

      if (badgeResult.badge) {
        this.logger.log(
          `Badge allocated: ${badgeResult.tier} for organization ${assessment.organization_id} with score ${score}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to allocate organization badge: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendAssessmentCompletionNotifications(
    assessment: {
      id: string;
      organization_id: string;
      branch_id: string | null;
      certificate_id: string;
    },
    score: number,
    totalFlags: number,
    organizationUsers: string[],
  ): Promise<void> {
    try {
      const certificate = await this.certificateRepo.findCertificateById(
        assessment.certificate_id,
      );

      for (const userId of organizationUsers) {
        await this.notificationService.notifyUser(userId, {
          type:
            totalFlags > 0
              ? NotificationType.WARNING
              : NotificationType.SUCCESS,
          title: 'Assessment Review Completed',
          message:
            totalFlags > 0
              ? `Your assessment for ${certificate?.name || 'certificate'} has been reviewed. Score: ${score}%. ${totalFlags} issue(s) flagged for attention.`
              : `Your assessment for ${certificate?.name || 'certificate'} has been reviewed successfully. Score: ${score}%.`,
          module: 'assessment',
          actionUrl: `/assessments/${assessment.id}`,
          metadata: {
            assessment_id: assessment.id,
            organization_id: assessment.organization_id,
            branch_id: assessment.branch_id,
            certificate_id: assessment.certificate_id,
            score,
            total_flags: totalFlags,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send assessment completion notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendAssessmentFailureNotifications(
    assessmentId: string,
    failureType: 'document_upload_failed' | 'review_failed',
    errorMessage: string,
  ): Promise<void> {
    try {
      const assessment =
        await this.assessmentRepo.findAssessmentById(assessmentId);
      if (!assessment) {
        return;
      }

      const certificate = await this.certificateRepo.findCertificateById(
        assessment.certificate_id,
      );
      const organizationUsers = await this.getOrganizationUsers(
        assessment.organization_id,
      );

      if (organizationUsers.length === 0) {
        return;
      }

      const title = 'Assessment Review Failed';
      const message =
        failureType === 'document_upload_failed'
          ? `AI review could not complete due to document processing error for ${certificate?.name || 'this certificate'}. Please review uploads and submit again.`
          : `AI review could not complete for ${certificate?.name || 'this certificate'}. Please retry shortly or contact support if the issue persists.`;

      for (const userId of organizationUsers) {
        await this.notificationService.notifyUser(userId, {
          type: NotificationType.WARNING,
          title,
          message,
          module: 'assessment',
          actionUrl: `/assessments/${assessmentId}`,
          metadata: {
            assessment_id: assessmentId,
            organization_id: assessment.organization_id,
            certificate_id: assessment.certificate_id,
            failure_type: failureType,
            error: errorMessage,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send assessment failure notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
