import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { randomUUID } from 'crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { IndustryModule } from './modules/industry/industry.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { AiReviewModule } from './modules/ai-review/ai-review.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuditModule } from './modules/audit-log/audit-log.module';
import { AuditModule as AuditWorkflowModule } from './modules/audit/audit.module';
import { SupportTicketModule } from './modules/support-ticket/support-ticket.module';
import { AssessmentInvitationModule } from './modules/assessment-invitation/assessment-invitation.module';
import { PublicSearchModule } from './modules/public-search/public-search.module';
import { ActivityModule } from './modules/activity/activity.module';
import { databaseConfig } from './config/database.config';
import { RateLimitInterceptor } from './common/rate-limit/rate-limit.interceptor';
import { CacheService } from './common/services/cache.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: () => randomUUID(),
      },
    }),
    DatabaseModule,
    AuthModule,
    IndustryModule,
    EmployeeModule,
    BranchesModule,
    CertificateModule,
    UploadsModule,
    PaymentModule,
    AssessmentModule,
    AiReviewModule,
    NotificationModule,
    ChatModule,
    AuditModule,
    AuditWorkflowModule,
    SupportTicketModule,
    AssessmentInvitationModule,
    PublicSearchModule,
    ActivityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CacheService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
  exports: [CacheService],
})
export class AppModule {}
