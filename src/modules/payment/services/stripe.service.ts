import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeConfigService } from '../../../config/stripe.config';
import {
  CreatePaymentIntentDto,
  ConfirmStripePaymentDto,
  BillingDetailsDto,
} from '../dto/stripe.dto';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly maxRetries = 3;

  constructor(private readonly stripeConfig: StripeConfigService) {
    this.stripe = stripeConfig.getClient();
  }

  async createPaymentIntent(
    userId: string,
    paymentId: string,
    amount: number,
    currency: string,
    dto: CreatePaymentIntentDto,
    email?: string,
    organizationName?: string,
    stripeCustomerId?: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const idempotencyKey = `${userId}-${paymentId}`;

      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount,
        currency: currency.toLowerCase(),
        payment_method_types: ['card'],
        description: `Payment for ${dto.payment_type} assessment - Certificate ID: ${dto.certificate_id}`,
        receipt_email: email,
        ...(stripeCustomerId && { customer: stripeCustomerId }),
        metadata: {
          userId,
          paymentId,
          certificateId: dto.certificate_id,
          paymentType: dto.payment_type,
          appName: 'ACES Certification Platform',
          ...(organizationName && { organizationName }),
          ...(email && { customerEmail: email }),
        },
        setup_future_usage: dto.save_payment_method ? 'on_session' : undefined,
      };

      this.logger.debug(
        `Creating payment intent for user ${userId}, amount: ${amount} ${currency}`,
      );

      const paymentIntent = await this.stripe.paymentIntents.create(
        paymentIntentData,
        {
          idempotencyKey,
        },
      );

      this.logger.log(
        `Payment intent created: ${paymentIntent.id} for payment ${paymentId}`,
      );

      return paymentIntent;
    } catch (error) {
      this.logger.error(
        `Failed to create payment intent: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async confirmPaymentIntentWithTestToken(
    paymentIntentId: string,
    testPaymentMethodToken: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.debug(
        `Confirming payment intent: ${paymentIntentId} with test token`,
      );

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: testPaymentMethodToken,
          return_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment-success`,
        },
      );

      this.logger.log(
        `Payment intent confirmed with test token: ${paymentIntentId}, status: ${paymentIntent.status}`,
      );

      return paymentIntent;
    } catch (error) {
      this.logger.error(
        `Failed to confirm payment intent with test token: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    dto: ConfirmStripePaymentDto,
  ): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.debug(
        `Confirming payment intent: ${paymentIntentId} with payment method: ${dto.payment_method_id}`,
      );

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: dto.payment_method_id,
          off_session: dto.off_session,
          return_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment-success`,
        },
      );

      this.logger.log(
        `Payment intent confirmed: ${paymentIntentId}, status: ${paymentIntent.status}`,
      );

      return paymentIntent;
    } catch (error) {
      this.logger.error(
        `Failed to confirm payment intent: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve payment intent: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async createOrGetCustomer(
    userId: string,
    email: string,
    name?: string,
  ): Promise<Stripe.Customer> {
    try {
      const customers = await this.stripe.customers.list({
        email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        return customers.data[0];
      }
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
          appName: 'ACES Certification Platform',
        },
        description: `Customer for ACES Certification Platform - User ID: ${userId}`,
      });

      this.logger.log(
        `Created new Stripe customer: ${customer.id} for user ${userId}`,
      );

      return customer;
    } catch (error) {
      this.logger.error(
        `Failed to create or get customer: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string,
  ): Promise<Stripe.Refund> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason: (reason as any) || 'requested_by_customer',
        metadata: {
          refundedAt: new Date().toISOString(),
        },
      };

      if (amount) {
        refundData.amount = amount;
      }

      const refund = await this.stripe.refunds.create(refundData);

      this.logger.log(
        `Refund created: ${refund.id} for payment intent ${paymentIntentId}`,
      );

      return refund;
    } catch (error) {
      this.logger.error(
        `Failed to refund payment: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async updatePaymentIntentCustomer(
    paymentIntentId: string,
    customerId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.update(paymentIntentId, {
        customer: customerId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update payment intent customer: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      this.logger.error(
        `Failed to retrieve customer: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async getPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      return await this.stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      this.logger.error(
        `Failed to retrieve payment method: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: customerId },
      );
      this.logger.log(
        `Payment method ${paymentMethodId} attached to customer ${customerId}`,
      );
      return paymentMethod;
    } catch (error) {
      // If already attached to this customer, that's fine
      if (
        error?.code === 'resource_already_exists' ||
        error?.message?.includes('already been attached')
      ) {
        this.logger.debug(
          `Payment method ${paymentMethodId} already attached to customer ${customerId}`,
        );
        return this.stripe.paymentMethods.retrieve(paymentMethodId);
      }
      this.logger.error(
        `Failed to attach payment method: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId);
      this.logger.log(`Payment method detached: ${paymentMethodId}`);
    } catch (error) {
      this.logger.error(
        `Failed to detach payment method: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  async listCustomerPaymentMethods(
    customerId: string,
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      return paymentMethods.data;
    } catch (error) {
      this.logger.error(
        `Failed to list payment methods: ${error.message}`,
        error.stack,
      );
      throw this.handleStripeError(error);
    }
  }

  verifyWebhookSignature(body: string, signature: string): Stripe.Event {
    try {
      const webhookSecret = this.stripeConfig.getWebhookSecret();
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret,
      );
      return event;
    } catch (error) {
      this.logger.error(
        `Webhook signature verification failed: ${error.message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  private formatBillingDetails(
    details: BillingDetailsDto,
  ): Stripe.AddressParam {
    return {
      line1: details.address_line1 || undefined,
      line2: details.address_line2 || undefined,
      city: details.city || undefined,
      state: details.state || undefined,
      postal_code: details.postal_code || undefined,
      country: details.country || undefined,
    };
  }

  private handleStripeError(error: any): Error {
    const errorType = error?.type;
    const errorMessage = error?.message || 'Unknown error';
    const errorCode = error?.code;

    if (errorType === 'card_error') {
      return new BadRequestException(
        `Card declined: ${errorMessage} (code: ${errorCode})`,
      );
    } else if (errorType === 'rate_limit_error') {
      return new BadRequestException(
        'Too many requests. Please try again later.',
      );
    } else if (errorType === 'authentication_error') {
      this.logger.error('Stripe authentication failed - check credentials');
      return new BadRequestException('Payment gateway authentication failed');
    } else if (errorType === 'invalid_request_error') {
      return new BadRequestException(
        `Invalid payment request: ${errorMessage}`,
      );
    } else if (errorType === 'api_connection_error') {
      return new BadRequestException(
        'Payment gateway connection failed. Please try again.',
      );
    } else {
      return new BadRequestException(
        `Payment processing failed: ${errorMessage}`,
      );
    }
  }

  async getPaymentIntentStatus(paymentIntentId: string): Promise<string> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return intent.status;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve payment intent ${paymentIntentId}: ${error.message}`,
      );
      throw this.handleStripeError(error);
    }
  }
}
