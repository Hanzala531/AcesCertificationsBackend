import { Module, forwardRef } from '@nestjs/common';
import { AssessmentInvitationController } from './assessment-invitation.controller';
import { AssessmentInvitationService } from './assessment-invitation.service';
import { AssessmentInvitationRepository } from './assessment-invitation.repository';
import { DatabaseModule } from '../../database/database.module';
import { AuditorModule } from '../auditor/auditor.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => AuditorModule),
    forwardRef(() => AssessmentModule),
    NotificationModule,
  ],
  controllers: [AssessmentInvitationController],
  providers: [AssessmentInvitationService, AssessmentInvitationRepository],
  exports: [AssessmentInvitationService],
})
export class AssessmentInvitationModule {}
