import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiReviewController } from './ai-review.controller';
import { AiReviewService } from './services/ai-review.service';
import { AiReviewAnalysisService } from './services/ai-review-analysis.service';
import { AiReviewNotificationService } from './services/ai-review-notification.service';
import { AiReviewRetryService } from './services/ai-review-retry.service';
import { AiReviewRepository } from './ai-review.repository';
import { DatabaseModule } from '../../database/database.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeModule } from '../employee/employee.module';
import { CertificateModule } from '../certificate/certificate.module';
import { CommonModule } from '../../common/common.module';
import { NotificationModule } from '../notification/notification.module';
import { AiConfigService } from '../../config/ai.config';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AiProviderFactory } from './providers/ai-provider.factory';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CommonModule,
    NotificationModule,
    forwardRef(() => AssessmentModule),
    OrganizationModule,
    EmployeeModule,
    CertificateModule,
  ],
  controllers: [AiReviewController],
  providers: [
    AiReviewService,
    AiReviewAnalysisService,
    AiReviewNotificationService,
    AiReviewRetryService,
    AiReviewRepository,
    AiConfigService,
    GeminiProvider,
    OpenAIProvider,
    AiProviderFactory,
  ],
  exports: [
    AiReviewService,
    AiReviewAnalysisService,
    AiReviewNotificationService,
    AiReviewRetryService,
    AiReviewRepository,
    AiProviderFactory,
    AiConfigService,
  ],
})
export class AiReviewModule {}
