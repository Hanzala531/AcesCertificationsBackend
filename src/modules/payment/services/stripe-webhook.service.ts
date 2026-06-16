import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentRepository, Payment } from '../payment.repository';
import { StripeService } from './stripe.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentRepo: PaymentRepository,
  ) {}

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.debug(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentIntentCanceled(event.data.object);
        break;

      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object);
        break;

      case 'charge.dispute.created':
        await this.handleChargeDisputeCreated(event.data.object);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      let payment: Payment | null = null;

      if (paymentIntent.metadata?.paymentId) {
        payment = await this.paymentRepo.findPaymentById(
          paymentIntent.metadata.paymentId,
        );
      }

      if (!payment) {
        payment = await this.paymentRepo.findPaymentByStripePaymentIntentId(
          paymentIntent.id,
        );
      }

      if (!payment) {
        this.logger.warn(
          `Payment record not found for payment intent: ${paymentIntent.id}`,
        );
        return;
      }

      if (payment.is_paid && payment.status === 'completed') {
        this.logger.debug(
          `Payment ${payment.id} already completed, skipping webhook update`,
        );
        return;
      }

      const charge = paymentIntent.latest_charge
        ? typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge.id
        : null;

      await this.paymentRepo.updatePaymentStatus(payment.id, {
        status: 'completed',
        is_paid: true,
        transaction_id: charge || paymentIntent.id,
        payment_method:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id || null,
        paid_at: new Date(paymentIntent.created * 1000),
      });

      this.logger.log(
        `Payment ${payment.id} marked as completed via webhook. Stripe ID: ${paymentIntent.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling payment_intent.succeeded: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      let payment: Payment | null = null;

      if (paymentIntent.metadata?.paymentId) {
        payment = await this.paymentRepo.findPaymentById(
          paymentIntent.metadata.paymentId,
        );
      }

      if (!payment) {
        payment = await this.paymentRepo.findPaymentByStripePaymentIntentId(
          paymentIntent.id,
        );
      }

      if (!payment) {
        this.logger.warn(
          `Payment record not found for payment intent: ${paymentIntent.id}`,
        );
        return;
      }

      const errorMessage =
        paymentIntent.last_payment_error?.message || 'Payment failed';

      await this.paymentRepo.updatePaymentStatus(payment.id, {
        status: 'failed',
        is_paid: false,
      });

      this.logger.warn(
        `Payment ${payment.id} failed: ${errorMessage}. Stripe ID: ${paymentIntent.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling payment_intent.payment_failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handlePaymentIntentCanceled(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      let payment: Payment | null = null;

      if (paymentIntent.metadata?.paymentId) {
        payment = await this.paymentRepo.findPaymentById(
          paymentIntent.metadata.paymentId,
        );
      }

      if (!payment) {
        payment = await this.paymentRepo.findPaymentByStripePaymentIntentId(
          paymentIntent.id,
        );
      }

      if (!payment) {
        this.logger.warn(
          `Payment record not found for payment intent: ${paymentIntent.id}`,
        );
        return;
      }

      await this.paymentRepo.updatePaymentStatus(payment.id, {
        status: 'failed',
        is_paid: false,
      });

      this.logger.log(
        `Payment ${payment.id} was canceled. Stripe ID: ${paymentIntent.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling payment_intent.canceled: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    try {
      const payment = await this.paymentRepo.findPaymentByTransactionId(
        charge.id,
      );
      if (!payment) {
        this.logger.warn(`Payment record not found for charge: ${charge.id}`);
        return;
      }

      const refundAmount = charge.refunded ? charge.amount_refunded : 0;

      await this.paymentRepo.updatePaymentStatus(payment.id, {
        status:
          refundAmount === charge.amount ? 'refunded' : 'partially_refunded',
        is_paid: false,
      });

      this.logger.log(
        `Payment ${payment.id} refunded. Refund amount: ${refundAmount / 100} ${charge.currency.toUpperCase()}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling charge.refunded: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleChargeDisputeCreated(
    dispute: Stripe.Dispute,
  ): Promise<void> {
    try {
      if (!dispute.charge) {
        this.logger.warn(`Dispute ${dispute.id} missing charge reference`);
        return;
      }

      const payment = await this.paymentRepo.findPaymentByTransactionId(
        dispute.charge as string,
      );
      if (!payment) {
        this.logger.warn(
          `Payment record not found for dispute charge: ${dispute.charge}`,
        );
        return;
      }

      await this.paymentRepo.updatePaymentStatus(payment.id, {
        status: 'disputed',
      });

      this.logger.error(
        `DISPUTE CREATED: Payment ${payment.id} has a chargeback. Dispute ID: ${dispute.id}. Reason: ${dispute.reason}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling charge.dispute.created: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
