import { Module, forwardRef } from '@nestjs/common';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './services/assessment.service';
import { AssessmentAdminService } from './services/assessment-admin.service';
import { AssessmentNotificationService } from './services/assessment-notification.service';
import { AdminAssessmentActionsService } from './services/admin-assessment-actions.service';
import { AssessmentRepository } from './assessment.repository';
import { DatabaseModule } from '../../database/database.module';
import { PaymentModule } from '../payment/payment.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeModule } from '../employee/employee.module';
import { AiReviewModule } from '../ai-review/ai-review.module';
import { NotificationModule } from '../notification/notification.module';
import { ChatModule } from '../chat/chat.module';
import { CertificateModule } from '../certificate/certificate.module';


@Module({
  imports: [
    DatabaseModule,
    PaymentModule,
    OrganizationModule,
    EmployeeModule,
    NotificationModule,
    CertificateModule,
    forwardRef(() => AiReviewModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [AssessmentController],
  providers: [
    AssessmentService,
    AssessmentAdminService,
    AssessmentNotificationService,
    AdminAssessmentActionsService,
    AssessmentRepository,
  ],
  exports: [
    AssessmentService,
    AssessmentAdminService,
    AssessmentNotificationService,
    AdminAssessmentActionsService,
    AssessmentRepository,
  ],
})
export class AssessmentModule {}
