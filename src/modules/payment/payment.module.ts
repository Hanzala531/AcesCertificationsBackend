import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './payment.repository';
import { DatabaseModule } from '../../database/database.module';
import { StripeService } from './services/stripe.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { StripeConfigService } from '../../config/stripe.config';
import { CertificateModule } from '../certificate/certificate.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeModule } from '../employee/employee.module';
import { NotificationModule } from '../notification/notification.module';
import { AssessmentModule } from '../assessment/assessment.module';

@Module({
  imports: [
    DatabaseModule,
    CertificateModule,
    OrganizationModule,
    EmployeeModule,
    NotificationModule,
    forwardRef(() => AssessmentModule),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentRepository,
    StripeService,
    StripeWebhookService,
    StripeConfigService,
  ],
  exports: [PaymentService, PaymentRepository, StripeService],
})
export class PaymentModule {}
