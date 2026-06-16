import { Module, forwardRef } from '@nestjs/common';
import { ReviewerService } from './reviewer.service';
import { ReviewerRepository } from './reviewer.repository';
import { ReviewerController } from './reviewer.controller';
import { DatabaseModule } from '../../database/database.module';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { ChatModule } from '../chat/chat.module';
import { AiReviewModule } from '../ai-review/ai-review.module';
import { AuditModule } from '../audit/audit.module';
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    UsersModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AssessmentModule),
    forwardRef(() => ChatModule),
    AiReviewModule,
    AuditModule,
    CertificateModule,
  ],
  controllers: [ReviewerController],
  providers: [ReviewerService, ReviewerRepository],
  exports: [ReviewerService, ReviewerRepository],
})
export class ReviewerModule {}
