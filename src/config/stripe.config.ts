import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Stripe Configuration Service
 * Handles initialization and configuration of Stripe client
 * Follows industry best practices for payment gateway integration
 */
@Injectable()
export class StripeConfigService {
  private stripeClient: Stripe;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    const stripeApiVersion = this.configService.get<string>(
      'STRIPE_API_VERSION',
      '2024-04-10',
    );

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not defined');
    }

    this.stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: stripeApiVersion as any,
      appInfo: {
        name: 'ACES Certification Platform',
        version: '1.0.0',
        url: 'https://aces-certification.com',
      },
    });
  }

  /**
   * Get the initialized Stripe client
   * @returns Stripe client instance
   */
  getClient(): Stripe {
    return this.stripeClient;
  }

  /**
   * Get Stripe publishable key for client-side integration
   * @returns Stripe publishable key
   */
  getPublishableKey(): string {
    const key = this.configService.get<string>('STRIPE_PUBLISHABLE_KEY');
    if (!key) {
      throw new Error(
        'STRIPE_PUBLISHABLE_KEY environment variable is not defined',
      );
    }
    return key;
  }

  /**
   * Get Stripe webhook secret for verifying webhook signatures
   * @returns Webhook signing secret
   */
  getWebhookSecret(): string {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET environment variable is not defined',
      );
    }
    return secret;
  }
}
