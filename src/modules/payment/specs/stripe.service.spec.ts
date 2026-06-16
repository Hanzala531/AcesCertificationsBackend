import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { StripeService } from '../services/stripe.service';
import { StripeConfigService } from '../../../config/stripe.config';
import {
  CreatePaymentIntentDto,
  ConfirmStripePaymentDto,
  BillingDetailsDto,
} from '../dto/stripe.dto';
import Stripe from 'stripe';

describe('StripeService', () => {
  let service: StripeService;
  let configService: jest.Mocked<StripeConfigService>;
  let mockStripeClient: jest.Mocked<Stripe>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockPaymentId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCertificateId = '550e8400-e29b-41d4-a716-446655440002';

  beforeEach(async () => {
    mockStripeClient = {
      paymentIntents: {
        create: jest.fn(),
        confirm: jest.fn(),
        retrieve: jest.fn(),
      },
      customers: {
        create: jest.fn(),
        list: jest.fn(),
        update: jest.fn(),
      },
      refunds: {
        create: jest.fn(),
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as any;

    const mockConfigService = {
      getClient: jest.fn().mockReturnValue(mockStripeClient),
      getWebhookSecret: jest.fn().mockReturnValue('whsec_test123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: StripeConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    configService = module.get(StripeConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent with idempotency key', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 50000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: Math.floor(Date.now() / 1000),
      } as any;

      (mockStripeClient.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );

      const dto: CreatePaymentIntentDto = {
        certificate_id: mockCertificateId,
        payment_type: 'self_disclosure',
        save_payment_method: true,
      };

      const result = await service.createPaymentIntent(
        mockUserId,
        mockPaymentId,
        50000,
        'usd',
        dto,
      );

      expect(result).toEqual(mockPaymentIntent);
      expect(mockStripeClient.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          currency: 'usd',
          payment_method_types: ['card'],
          setup_future_usage: 'on_session',
          metadata: expect.objectContaining({
            userId: mockUserId,
            paymentId: mockPaymentId,
            certificateId: mockCertificateId,
          }),
        }),
        expect.any(Object),
      );
    });

    it('should handle billing details even if not sent to Stripe API', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 500000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: Math.floor(Date.now() / 1000),
      } as any;

      (mockStripeClient.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );

      const billingDetails: BillingDetailsDto = {
        name: 'John Doe',
        email: 'john@example.com',
        address_line1: '123 Main St',
        address_line2: 'Apt 4',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US',
      };

      const dto: CreatePaymentIntentDto = {
        certificate_id: mockCertificateId,
        payment_type: 'assured',
        billing_details: billingDetails,
        save_payment_method: false,
      };

      const result = await service.createPaymentIntent(
        mockUserId,
        mockPaymentId,
        500000,
        'usd',
        dto,
      );

      expect(result).toEqual(mockPaymentIntent);
      expect(mockStripeClient.paymentIntents.create).toHaveBeenCalled();
    });

    it('should create payment intent without saving payment method', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 50000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: Math.floor(Date.now() / 1000),
      } as any;

      (mockStripeClient.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );

      const dto: CreatePaymentIntentDto = {
        certificate_id: mockCertificateId,
        payment_type: 'self_disclosure',
        save_payment_method: false,
      };

      await service.createPaymentIntent(
        mockUserId,
        mockPaymentId,
        50000,
        'usd',
        dto,
      );

      expect(mockStripeClient.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
        }),
        expect.any(Object),
      );
    });

    it('should include customer when stripeCustomerId is provided', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent = {
        id: 'pi_test456',
        client_secret: 'pi_test456_secret',
        amount: 50000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: Math.floor(Date.now() / 1000),
      } as any;

      (mockStripeClient.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockPaymentIntent,
      );

      const dto: CreatePaymentIntentDto = {
        certificate_id: mockCertificateId,
        payment_type: 'self_disclosure',
        save_payment_method: true,
      };

      await service.createPaymentIntent(
        mockUserId,
        mockPaymentId,
        50000,
        'usd',
        dto,
        'john@example.com',
        'Test Org',
        'cus_test123',
      );

      expect(mockStripeClient.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_test123',
        }),
        expect.any(Object),
      );
    });
  });

  describe('confirmPaymentIntent', () => {
    it('should confirm a payment intent with payment method', async () => {
      const mockConfirmedIntent: Stripe.PaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 50000,
        currency: 'usd',
        status: 'succeeded',
        created: Math.floor(Date.now() / 1000),
      } as any;

      (mockStripeClient.paymentIntents.confirm as jest.Mock).mockResolvedValue(
        mockConfirmedIntent,
      );

      const dto: ConfirmStripePaymentDto = {
        payment_method_id: 'pm_test123',
        off_session: false,
      };

      const result = await service.confirmPaymentIntent('pi_test123', dto);

      expect(result).toEqual(mockConfirmedIntent);
      expect(mockStripeClient.paymentIntents.confirm).toHaveBeenCalledWith(
        'pi_test123',
        expect.objectContaining({
          payment_method: 'pm_test123',
          off_session: false,
        }),
      );
    });
  });

  describe('createOrGetCustomer', () => {
    it('should create a new customer if none exists', async () => {
      const mockCustomer: Stripe.Customer = {
        id: 'cus_test123',
        email: 'test@example.com',
        name: 'Test User',
      } as any;

      (mockStripeClient.customers.list as jest.Mock).mockResolvedValue({
        data: [],
      } as any);
      (mockStripeClient.customers.create as jest.Mock).mockResolvedValue(
        mockCustomer,
      );

      const result = await service.createOrGetCustomer(
        mockUserId,
        'test@example.com',
        'Test User',
      );

      expect(result).toEqual(mockCustomer);
      expect(mockStripeClient.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          metadata: expect.objectContaining({
            userId: mockUserId,
          }),
        }),
      );
    });

    it('should return existing customer if found', async () => {
      const mockCustomer: Stripe.Customer = {
        id: 'cus_test123',
        email: 'test@example.com',
        name: 'Test User',
      } as any;

      (mockStripeClient.customers.list as jest.Mock).mockResolvedValue({
        data: [mockCustomer],
      } as any);

      const result = await service.createOrGetCustomer(
        mockUserId,
        'test@example.com',
        'Test User',
      );

      expect(result).toEqual(mockCustomer);
      expect(mockStripeClient.customers.create).not.toHaveBeenCalled();
    });
  });

  describe('refundPayment', () => {
    it('should create a full refund for a payment', async () => {
      const mockRefund: Stripe.Refund = {
        id: 're_test123',
        amount: 50000,
        status: 'succeeded',
        reason: 'requested_by_customer',
      } as any;

      (mockStripeClient.refunds.create as jest.Mock).mockResolvedValue(
        mockRefund,
      );

      const result = await service.refundPayment('pi_test123');

      expect(result).toEqual(mockRefund);
      expect(mockStripeClient.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_test123',
        }),
      );
    });

    it('should create a partial refund', async () => {
      const mockRefund: Stripe.Refund = {
        id: 're_test123',
        amount: 25000,
        status: 'succeeded',
        reason: 'requested_by_customer',
      } as any;

      (mockStripeClient.refunds.create as jest.Mock).mockResolvedValue(
        mockRefund,
      );

      const result = await service.refundPayment('pi_test123', 25000);

      expect(result).toEqual(mockRefund);
      expect(mockStripeClient.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_test123',
          amount: 25000,
        }),
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify a valid webhook signature', () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            status: 'succeeded',
          },
        },
      } as any;

      (mockStripeClient.webhooks.constructEvent as jest.Mock).mockReturnValue(
        mockEvent,
      );

      const result = service.verifyWebhookSignature(
        '{"id":"evt_test123"}',
        'sig_test123',
      );

      expect(result).toEqual(mockEvent);
      expect(mockStripeClient.webhooks.constructEvent).toHaveBeenCalledWith(
        '{"id":"evt_test123"}',
        'sig_test123',
        'whsec_test123',
      );
    });

    it('should throw BadRequestException for invalid signature', () => {
      (
        mockStripeClient.webhooks.constructEvent as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => {
        service.verifyWebhookSignature('{"id":"evt_test123"}', 'invalid_sig');
      }).toThrow(BadRequestException);
    });
  });

  describe('getPaymentIntentStatus', () => {
    it('should retrieve the status of a payment intent', async () => {
      const mockIntent: Stripe.PaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 50000,
        currency: 'usd',
      } as any;

      (mockStripeClient.paymentIntents.retrieve as jest.Mock).mockResolvedValue(
        mockIntent,
      );

      const result = await service.getPaymentIntentStatus('pi_test123');

      expect(result).toEqual('succeeded');
      expect(mockStripeClient.paymentIntents.retrieve).toHaveBeenCalledWith(
        'pi_test123',
      );
    });
  });
});
