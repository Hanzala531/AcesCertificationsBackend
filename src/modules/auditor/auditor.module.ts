import { Module, forwardRef } from '@nestjs/common';
import { AuditorService } from './auditor.service';
import { AuditorRepository } from './auditor.repository';
import { AuditorController } from './auditor.controller';
import { DatabaseModule } from '../../database/database.module';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { ChatModule } from '../chat/chat.module';
import { AssessmentInvitationModule } from '../assessment-invitation/assessment-invitation.module';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    UsersModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AssessmentModule),
    forwardRef(() => ChatModule),
    forwardRef(() => AssessmentInvitationModule),
    NotificationModule,
    AuditModule,
  ],
  controllers: [AuditorController],
  providers: [AuditorService, AuditorRepository],
  exports: [AuditorService, AuditorRepository],
})
export class AuditorModule {}
