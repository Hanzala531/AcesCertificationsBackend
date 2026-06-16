import { Injectable, Logger } from '@nestjs/common';
import { AssessmentRepository } from '../assessment.repository';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../notification/types/notification.types';

@Injectable()
export class AssessmentNotificationService {
  private readonly logger = new Logger(AssessmentNotificationService.name);

  constructor(
    private readonly assessmentRepo: AssessmentRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async sendAssessmentSubmissionNotification(
    assessment: {
      id: string;
      organization_id: string;
      certificate_id: string;
      certificate_name?: string;
    },
    submittedByUserId: string,
  ): Promise<void> {
    try {
      this.logger.log(`Starting notification process for assessment: ${assessment.id}`);
      
      const organizationUsers = await this.getOrganizationUsers(
        assessment.organization_id,
      );

      this.logger.log(`Found ${organizationUsers.length} organization users for notifications`);

      // Send notifications without awaiting to prevent blocking
      const notificationPromises = organizationUsers.map(async (userId) => {
        try {
          await this.notificationService.notifyUser(userId, {
            type: NotificationType.INFO,
            title: 'Assessment Submitted',
            message: `Assessment for ${assessment.certificate_name || 'certificate'} has been submitted and is now under AI review.`,
            module: 'assessment',
            actionUrl: `/assessments/${assessment.id}`,
            metadata: {
              assessment_id: assessment.id,
              organization_id: assessment.organization_id,
              certificate_id: assessment.certificate_id,
              submitted_by: submittedByUserId,
            },
          });
          this.logger.log(`Notification sent successfully to user: ${userId}`);
        } catch (userError) {
          this.logger.warn(
            `Failed to send notification to user ${userId}: ${userError instanceof Error ? userError.message : String(userError)}`,
          );
        }
      });

      // Fire and forget - don't wait for all notifications to complete
      Promise.all(notificationPromises).catch((error) => {
        this.logger.error(
          `Some notifications failed for assessment ${assessment.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    } catch (error) {
      this.logger.error(
        `Failed to send assessment submission notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getOrganizationUsers(organizationId: string): Promise<string[]> {
    try {
      return await this.assessmentRepo.getOrganizationUserIds(organizationId);
    } catch (error) {
      this.logger.error(
        `Failed to get organization users: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
