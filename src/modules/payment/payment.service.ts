import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  PaymentRepository,
  Payment,
  PaymentWithDetails,
  PaymentMethod,
} from './payment.repository';
import { CreatePaymentMethodDto } from './dto/payment-method.dto';
import { PaymentType } from './dto/initiate-payment.dto';
import {
  CreatePaymentIntentDto,
  ConfirmStripePaymentDto,
  StripePaymentIntentResponseDto,
} from './dto/stripe.dto';
import { StripeService } from './services/stripe.service';
import { CertificateService } from '../certificate/services/certificate.service';
import { OrganizationRepository } from '../organization/organization.repository';
import { EmployeeRepository } from '../employee/employee.repository';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly stripeService: StripeService,
    private readonly certificateService: CertificateService,
    private readonly organizationRepo: OrganizationRepository,
    private readonly employeeRepo: EmployeeRepository,
  ) {}

  async createStripePaymentIntent(
    userId: string,
    userEmail: string,
    userRole: string,
    dto: CreatePaymentIntentDto,
  ): Promise<StripePaymentIntentResponseDto> {
    const certificate = await this.certificateService.getCertificateById(
      dto.certificate_id,
    );
    if (!certificate) {
      throw new NotFoundException(
        `Certificate with ID "${dto.certificate_id}" not found`,
      );
    }

    const existingPending =
      await this.paymentRepo.findPendingPaymentForCertificate(
        userId,
        dto.certificate_id,
        dto.payment_type,
      );

    const paymentTypeValue = dto.payment_type.toLowerCase() as
      | 'self_disclosure'
      | 'assured';

    let correctAmount: number;
    if (paymentTypeValue === 'self_disclosure') {
      correctAmount = Number(certificate.disclosure_price);
    } else {
      if (certificate.assured_price == null) {
        throw new BadRequestException(
          'This certificate does not have an assured price configured',
        );
      }
      correctAmount = Number(certificate.assured_price);
    }

    if (!correctAmount || correctAmount <= 0) {
      throw new BadRequestException(
        `Invalid price configured for ${paymentTypeValue} on this certificate`,
      );
    }

    let payment: Payment;

    if (existingPending) {
      if (Number(existingPending.amount) !== correctAmount) {
        await this.paymentRepo.updatePaymentStatus(existingPending.id, {
          status: 'failed',
        });
        payment = await this.paymentRepo.createPayment({
          user_id: userId,
          certificate_id: dto.certificate_id,
          payment_type: paymentTypeValue,
          amount: correctAmount,
          currency: 'USD',
        });
      } else {
        payment = existingPending;
      }
    } else {
      payment = await this.paymentRepo.createPayment({
        user_id: userId,
        certificate_id: dto.certificate_id,
        payment_type: paymentTypeValue,
        amount: correctAmount,
        currency: 'USD',
      });
    }

    try {
      let organizationName: string | undefined;
      let organizationId: string | undefined;

      if (userRole === 'organization') {
        const org = await this.organizationRepo.findByUserId(userId);
        if (org) {
          organizationName = org.name;
          organizationId = org.id;
        }
      } else if (userRole === 'organization_member') {
        const employee = await this.employeeRepo.findByUserId(userId);
        if (employee) {
          organizationId = employee.organization_id;
          const org = await this.organizationRepo.findById(organizationId);
          if (org) {
            organizationName = org.name;
          }
        }
      }

      // Use the organization's existing Stripe customer so that saved payment methods
      // (added by any org member) can be used by any other org member.
      let stripeCustomerId: string | undefined;

      if (organizationId) {
        const existingOrgCustomerId =
          await this.paymentRepo.findOrganizationStripeCustomerId(
            organizationId,
          );
        if (existingOrgCustomerId) {
          stripeCustomerId = existingOrgCustomerId;
        }
      }

      if (!stripeCustomerId) {
        const stripeCustomer = await this.stripeService.createOrGetCustomer(
          userId,
          userEmail,
          organizationName,
        );
        stripeCustomerId = stripeCustomer.id;
      }

      const stripePaymentIntent = await this.stripeService.createPaymentIntent(
        userId,
        payment.id,
        Math.round(payment.amount * 100),
        payment.currency,
        dto,
        userEmail,
        organizationName,
        stripeCustomerId,
      );

      await this.paymentRepo.updatePaymentWithStripeIntent(
        payment.id,
        stripePaymentIntent.id,
        stripeCustomerId,
      );

      return {
        id: stripePaymentIntent.id,
        client_secret: stripePaymentIntent.client_secret!,
        amount: stripePaymentIntent.amount,
        currency: stripePaymentIntent.currency,
        status: stripePaymentIntent.status as string,
        customer_id: stripeCustomerId,
        payment_id: payment.id,
        created: new Date(stripePaymentIntent.created * 1000).toISOString(),
      };
    } catch (error) {
      await this.paymentRepo.updatePaymentStatus(payment.id, {
        status: 'failed',
      });

      this.logger.error(
        `Failed to create Stripe payment intent for payment ${payment.id}: ${error.message}`,
      );
      throw error;
    }
  }

  async testConfirmPayment(
    paymentId: string,
    userId: string,
    testPaymentMethodToken: string,
  ): Promise<StripePaymentIntentResponseDto> {
    let payment: Payment | null = null;

    if (paymentId.startsWith('pi_')) {
      payment =
        await this.paymentRepo.findPaymentByStripePaymentIntentId(paymentId);
    } else {
      payment = await this.paymentRepo.findPaymentById(paymentId);
      if (!payment) {
        payment =
          await this.paymentRepo.findPaymentByStripePaymentIntentId(paymentId);
      }
    }

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.user_id !== userId) {
      throw new ForbiddenException('This payment does not belong to you');
    }

    if (!payment.stripe_payment_intent_id) {
      throw new BadRequestException(
        'This payment does not have a Stripe payment intent',
      );
    }

    try {
      const stripePaymentIntent =
        await this.stripeService.confirmPaymentIntentWithTestToken(
          payment.stripe_payment_intent_id,
          testPaymentMethodToken,
        );

      this.logger.log(
        `Test payment confirmed: ${stripePaymentIntent.id} for payment ${payment.id}, status: ${stripePaymentIntent.status}`,
      );

      if (
        stripePaymentIntent.status === 'succeeded' &&
        (!payment.is_paid || payment.status !== 'completed')
      ) {
        const charge = stripePaymentIntent.latest_charge
          ? typeof stripePaymentIntent.latest_charge === 'string'
            ? stripePaymentIntent.latest_charge
            : stripePaymentIntent.latest_charge.id
          : null;

        await this.paymentRepo.updatePaymentStatus(payment.id, {
          status: 'completed',
          is_paid: true,
          transaction_id: charge || stripePaymentIntent.id,
          payment_method:
            typeof stripePaymentIntent.payment_method === 'string'
              ? stripePaymentIntent.payment_method
              : stripePaymentIntent.payment_method?.id || null,
          paid_at: new Date(stripePaymentIntent.created * 1000),
        });

        this.logger.log(
          `Test payment ${payment.id} marked as completed after confirmation`,
        );
      }

      return {
        id: stripePaymentIntent.id,
        client_secret: stripePaymentIntent.client_secret!,
        amount: stripePaymentIntent.amount,
        currency: stripePaymentIntent.currency,
        status: stripePaymentIntent.status as string,
        customer_id: stripePaymentIntent.customer as string | undefined,
        payment_id: payment.id,
        created: new Date(stripePaymentIntent.created * 1000).toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to confirm test payment for payment ${payment.id}: ${error.message}`,
      );
      throw error;
    }
  }

  async confirmStripePayment(
    paymentId: string,
    userId: string,
    userEmail: string,
    dto: ConfirmStripePaymentDto,
  ): Promise<StripePaymentIntentResponseDto> {
    let payment: Payment | null = null;

    if (paymentId.startsWith('pi_')) {
      payment =
        await this.paymentRepo.findPaymentByStripePaymentIntentId(paymentId);
    } else {
      payment = await this.paymentRepo.findPaymentById(paymentId);
      if (!payment) {
        payment =
          await this.paymentRepo.findPaymentByStripePaymentIntentId(paymentId);
      }
    }

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.user_id !== userId) {
      throw new ForbiddenException('This payment does not belong to you');
    }

    if (!payment.stripe_payment_intent_id) {
      throw new BadRequestException(
        'This payment does not have a Stripe payment intent',
      );
    }

    try {
      // Ensure PaymentMethod is attached to the correct Customer before confirming.
      // If the payment method is saved in our DB for an organization, use that org's
      // Stripe customer so any org member can use any org payment method.
      if (dto.payment_method_id) {
        try {
          const pm = await this.stripeService.getPaymentMethod(
            dto.payment_method_id,
          );

          // Determine the correct customer: prefer the org's shared customer
          let targetCustomerId: string | undefined;
          const savedMethod = await this.paymentRepo.findPaymentMethodByStripeId(
            dto.payment_method_id,
          );
          if (savedMethod?.stripe_customer_id) {
            targetCustomerId = savedMethod.stripe_customer_id;
          }

          if (!pm.customer && !targetCustomerId) {
            const customer = await this.stripeService.createOrGetCustomer(
              userId,
              userEmail,
            );
            targetCustomerId = customer.id;
          }

          if (!pm.customer && targetCustomerId) {
            await this.stripeService.attachPaymentMethod(
              dto.payment_method_id,
              targetCustomerId,
            );
            this.logger.log(
              `Attached unattached payment method ${dto.payment_method_id} to customer ${targetCustomerId} before confirm`,
            );
          }

          // If the payment intent's customer doesn't match the payment method's customer,
          // update the payment intent to use the correct customer
          if (
            pm.customer &&
            payment.stripe_customer_id &&
            typeof pm.customer === 'string' &&
            pm.customer !== payment.stripe_customer_id
          ) {
            await this.stripeService.updatePaymentIntentCustomer(
              payment.stripe_payment_intent_id,
              pm.customer,
            );
            this.logger.log(
              `Updated payment intent ${payment.stripe_payment_intent_id} customer from ${payment.stripe_customer_id} to ${pm.customer}`,
            );
          }
        } catch (attachError) {
          this.logger.warn(
            `Could not verify/attach payment method before confirm: ${attachError.message}`,
          );
        }
      }

      const stripePaymentIntent = await this.stripeService.confirmPaymentIntent(
        payment.stripe_payment_intent_id,
        dto,
      );

      this.logger.log(
        `Confirmed Stripe payment intent: ${stripePaymentIntent.id} for payment ${payment.id}, status: ${stripePaymentIntent.status}`,
      );

      if (
        stripePaymentIntent.status === 'succeeded' &&
        (!payment.is_paid || payment.status !== 'completed')
      ) {
        const charge = stripePaymentIntent.latest_charge
          ? typeof stripePaymentIntent.latest_charge === 'string'
            ? stripePaymentIntent.latest_charge
            : stripePaymentIntent.latest_charge.id
          : null;

        await this.paymentRepo.updatePaymentStatus(payment.id, {
          status: 'completed',
          is_paid: true,
          transaction_id: charge || stripePaymentIntent.id,
          payment_method:
            typeof stripePaymentIntent.payment_method === 'string'
              ? stripePaymentIntent.payment_method
              : stripePaymentIntent.payment_method?.id || null,
          paid_at: new Date(stripePaymentIntent.created * 1000),
        });

        this.logger.log(
          `Payment ${payment.id} marked as completed after confirmation`,
        );
      }

      return {
        id: stripePaymentIntent.id,
        client_secret: stripePaymentIntent.client_secret!,
        amount: stripePaymentIntent.amount,
        currency: stripePaymentIntent.currency,
        status: stripePaymentIntent.status as string,
        customer_id: stripePaymentIntent.customer as string | undefined,
        payment_id: payment.id,
        created: new Date(stripePaymentIntent.created * 1000).toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to confirm Stripe payment intent for payment ${payment.id}: ${error.message}`,
      );
      throw error;
    }
  }

  async getPaymentIntentStatus(
    paymentId: string,
    userId: string,
  ): Promise<StripePaymentIntentResponseDto> {
    let payment: Payment | null = null;

    if (paymentId.startsWith('pi_')) {
      payment =
        await this.paymentRepo.findPaymentByStripePaymentIntentId(paymentId);
    } else {
      payment = await this.paymentRepo.findPaymentById(paymentId);
      if (!payment) {
        payment =
          await this.paymentRepo.findPaymentByStripePaymentIntentId(paymentId);
      }
    }

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.user_id !== userId) {
      throw new ForbiddenException('This payment does not belong to you');
    }

    if (!payment.stripe_payment_intent_id) {
      throw new BadRequestException(
        'This payment does not have a Stripe payment intent',
      );
    }

    const stripePaymentIntent = await this.stripeService.getPaymentIntent(
      payment.stripe_payment_intent_id,
    );

    return {
      id: stripePaymentIntent.id,
      client_secret: stripePaymentIntent.client_secret!,
      amount: stripePaymentIntent.amount,
      currency: stripePaymentIntent.currency,
      status: stripePaymentIntent.status as string,
      customer_id: stripePaymentIntent.customer as string | undefined,
      payment_id: payment.id,
      created: new Date(stripePaymentIntent.created * 1000).toISOString(),
    };
  }

  async getPaymentById(
    userId: string,
    paymentId: string,
    isAdmin = false,
  ): Promise<PaymentWithDetails> {
    let payment: PaymentWithDetails | null = null;

    if (paymentId.startsWith('pi_')) {
      const paymentRecord =
        await this.paymentRepo.findPaymentByStripePaymentIntentId(paymentId);
      if (paymentRecord) {
        payment = await this.paymentRepo.findPaymentWithDetails(
          paymentRecord.id,
        );
      }
    } else {
      payment = await this.paymentRepo.findPaymentWithDetails(paymentId);
    }

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!isAdmin && payment.user_id !== userId) {
      throw new ForbiddenException('Access denied to this payment');
    }

    return payment;
  }

  async confirmPayment(
    paymentId: string,
    transactionId: string,
    paymentMethod?: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.is_paid) {
      throw new BadRequestException('Payment is already confirmed');
    }

    if (payment.status === 'failed') {
      throw new BadRequestException('Cannot confirm a failed payment');
    }

    return this.paymentRepo.confirmPayment(
      paymentId,
      transactionId,
      paymentMethod,
    );
  }

  async refundPayment(
    paymentId: string,
    userId: string,
    amount?: number,
  ): Promise<{ success: boolean; message: string }> {
    const payment = await this.paymentRepo.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.user_id !== userId) {
      throw new ForbiddenException('This payment does not belong to you');
    }

    if (!payment.is_paid) {
      throw new BadRequestException(
        'Cannot refund an unpaid or already refunded payment',
      );
    }

    try {
      if (payment.stripe_payment_intent_id) {
        const refundAmount = amount ? Math.round(amount * 100) : undefined;
        await this.stripeService.refundPayment(
          payment.stripe_payment_intent_id,
          refundAmount,
          'requested_by_customer',
        );
      }

      await this.paymentRepo.updatePaymentStatus(paymentId, {
        status: 'refunded',
        is_paid: false,
      });

      this.logger.log(`Payment ${paymentId} refunded for user ${userId}`);

      return {
        success: true,
        message: 'Refund processed successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to refund payment ${paymentId}: ${error.message}`,
      );
      throw error;
    }
  }

  async getUserPayments(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: PaymentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.paymentRepo.findUserPayments(userId, { page, limit });
  }

  async getPaymentAmount(
    paymentType: PaymentType,
    certificateId: string,
  ): Promise<number> {
    const certificate =
      await this.certificateService.getCertificateById(certificateId);
    if (!certificate) {
      throw new NotFoundException(
        `Certificate with ID "${certificateId}" not found`,
      );
    }

    if (paymentType === PaymentType.SELF_DISCLOSURE) {
      return Number(certificate.disclosure_price);
    }

    if (certificate.assured_price == null) {
      throw new BadRequestException(
        'This certificate does not have an assured price configured',
      );
    }
    return Number(certificate.assured_price);
  }

  async verifyPaymentForAssessment(
    userId: string,
    paymentId: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.user_id !== userId) {
      throw new ForbiddenException('This payment does not belong to you');
    }

    if (!payment.is_paid || payment.status !== 'completed') {
      throw new BadRequestException('Payment has not been completed');
    }

    return payment;
  }

  /**
   * Get payment methods for an organization
   * Accessible to organization and organization_member roles
   */
  async getPaymentMethodsByOrganization(
    userId: string,
    userRole: string,
  ): Promise<PaymentMethod[]> {
    let organizationId: string;

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new ForbiddenException('Organization not found');
      }
      organizationId = org.id;
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new ForbiddenException('Employee not found');
      }
      organizationId = employee.organization_id;
    } else {
      throw new ForbiddenException('Invalid role');
    }

    return this.paymentRepo.findPaymentMethodsByOrganizationId(organizationId);
  }

  /**
   * Add a payment method for an organization
   * Accessible to organization and organization_member roles
   */
  async addPaymentMethod(
    userId: string,
    userRole: string,
    userEmail: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    let organizationId: string;
    let organizationName: string | undefined;

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new ForbiddenException('Organization not found');
      }
      organizationId = org.id;
      organizationName = org.name;
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new ForbiddenException('Employee not found');
      }
      organizationId = employee.organization_id;
    } else {
      throw new ForbiddenException('Invalid role');
    }

    // Check if payment method already exists
    const existing = await this.paymentRepo.findPaymentMethodByStripeId(
      dto.stripe_payment_method_id,
    );
    if (existing && existing.organization_id === organizationId) {
      throw new BadRequestException(
        'This payment method is already saved for your organization',
      );
    }

    // Reuse the organization's existing Stripe Customer if one exists,
    // so all payment methods share a single customer and can be used by any org member.
    let stripeCustomer: Stripe.Customer;
    const existingOrgCustomerId =
      await this.paymentRepo.findOrganizationStripeCustomerId(organizationId);

    if (existingOrgCustomerId) {
      try {
        const retrieved = await this.stripeService.getCustomer(
          existingOrgCustomerId,
        );
        if ('deleted' in retrieved && retrieved.deleted) {
          // Customer was deleted in Stripe — create a new one
          stripeCustomer = await this.stripeService.createOrGetCustomer(
            userId,
            userEmail,
            organizationName,
          );
        } else {
          stripeCustomer = retrieved as Stripe.Customer;
        }
      } catch {
        // Customer retrieval failed — create a new one
        stripeCustomer = await this.stripeService.createOrGetCustomer(
          userId,
          userEmail,
          organizationName,
        );
      }
    } else {
      stripeCustomer = await this.stripeService.createOrGetCustomer(
        userId,
        userEmail,
        organizationName,
      );
    }

    try {
      await this.stripeService.attachPaymentMethod(
        dto.stripe_payment_method_id,
        stripeCustomer.id,
      );
      this.logger.log(
        `Attached payment method ${dto.stripe_payment_method_id} to customer ${stripeCustomer.id}`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not attach payment method to customer: ${error.message}`,
      );
    }

    // Retrieve payment method details from Stripe if not fully provided
    const paymentMethodData = { ...dto };
    paymentMethodData.stripe_customer_id = stripeCustomer.id;

    try {
      const stripePaymentMethod = await this.stripeService.getPaymentMethod(
        dto.stripe_payment_method_id,
      );

      // Fill in missing card details from Stripe
      if (stripePaymentMethod.type === 'card' && stripePaymentMethod.card) {
        if (!paymentMethodData.card_brand) {
          paymentMethodData.card_brand = stripePaymentMethod.card.brand;
        }
        if (!paymentMethodData.card_last4) {
          paymentMethodData.card_last4 = stripePaymentMethod.card.last4;
        }
        if (!paymentMethodData.card_exp_month) {
          paymentMethodData.card_exp_month = stripePaymentMethod.card.exp_month;
        }
        if (!paymentMethodData.card_exp_year) {
          paymentMethodData.card_exp_year = stripePaymentMethod.card.exp_year;
        }
      }

      if (!paymentMethodData.type) {
        paymentMethodData.type = stripePaymentMethod.type;
      }
    } catch (error) {
      this.logger.warn(
        `Could not retrieve payment method details from Stripe: ${error.message}`,
      );
      // Continue with provided data if Stripe retrieval fails
    }

    return this.paymentRepo.createPaymentMethod({
      organization_id: organizationId,
      stripe_payment_method_id: paymentMethodData.stripe_payment_method_id,
      stripe_customer_id: paymentMethodData.stripe_customer_id,
      type: paymentMethodData.type,
      card_brand: paymentMethodData.card_brand,
      card_last4: paymentMethodData.card_last4,
      card_exp_month: paymentMethodData.card_exp_month,
      card_exp_year: paymentMethodData.card_exp_year,
      is_default: paymentMethodData.is_default || false,
      billing_details: undefined, // Not storing billing details
      metadata: paymentMethodData.metadata,
    });
  }

  async getAdminPaymentMetrics() {
    return this.paymentRepo.getPaymentMetrics();
  }

  async getAdminPayments(params: {
    page: number;
    limit: number;
    status?: string;
    organizationId?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: 'date' | 'amount';
    sortOrder?: 'asc' | 'desc';
  }) {
    return this.paymentRepo.findAdminPayments(params);
  }

  async getAdminPaymentDetails(paymentId: string) {
    const details = await this.paymentRepo.findAdminPaymentDetails(paymentId);
    if (!details) {
      throw new NotFoundException(`Payment with ID "${paymentId}" not found`);
    }
    return details;
  }
}
