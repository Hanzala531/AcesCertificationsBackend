import { Module, forwardRef } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';
import { DatabaseModule } from '../../database/database.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationModule } from '../notification/notification.module';
import { AiReviewModule } from '../ai-review/ai-review.module';
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [
    DatabaseModule,
    AssessmentModule,
    forwardRef(() => ChatModule),
    NotificationModule,
    AiReviewModule,
    CertificateModule,
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
