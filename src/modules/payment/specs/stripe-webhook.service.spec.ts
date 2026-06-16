import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { StripeWebhookService } from '../services/stripe-webhook.service';
import { StripeService } from '../services/stripe.service';
import { PaymentRepository } from '../payment.repository';
import Stripe from 'stripe';

describe('StripeWebhookService', () => {
  let service: StripeWebhookService;
  let stripeService: jest.Mocked<StripeService>;
  let paymentRepository: jest.Mocked<PaymentRepository>;

  const mockPaymentId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    const mockStripeService = {
      handleStripeError: jest.fn(),
    };

    const mockPaymentRepo = {
      findPaymentByStripePaymentIntentId: jest.fn(),
      findPaymentByTransactionId: jest.fn(),
      findPaymentById: jest.fn(),
      updatePaymentStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: StripeService, useValue: mockStripeService },
        { provide: PaymentRepository, useValue: mockPaymentRepo },
      ],
    }).compile();

    service = module.get<StripeWebhookService>(StripeWebhookService);
    stripeService = module.get(StripeService);
    paymentRepository = module.get(PaymentRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleWebhookEvent', () => {
    it('should mark payment as completed on payment_intent.succeeded', async () => {
      const mockPaymentId = '550e8400-e29b-41d4-a716-446655440000';
      const mockPayment = { id: mockPaymentId, status: 'pending' };
      const event: Stripe.Event = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            payment_method: 'pm_test123',
            metadata: { paymentId: mockPaymentId },
          },
        },
      } as any;

      paymentRepository.findPaymentById.mockResolvedValue(mockPayment as any);
      paymentRepository.updatePaymentStatus.mockResolvedValue(undefined as any);

      await service.handleWebhookEvent(event);

      expect(paymentRepository.updatePaymentStatus).toHaveBeenCalledWith(
        mockPaymentId,
        expect.objectContaining({
          status: 'completed',
        }),
      );
    });

    it('should mark payment as failed on payment_intent.payment_failed', async () => {
      const mockPaymentId = '550e8400-e29b-41d4-a716-446655440001';
      const mockPayment = { id: mockPaymentId, status: 'pending' };
      const event: Stripe.Event = {
        id: 'evt_test123',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test123',
            status: 'requires_payment_method',
            created: Math.floor(Date.now() / 1000),
            metadata: { paymentId: mockPaymentId },
          },
        },
      } as any;

      paymentRepository.findPaymentById.mockResolvedValue(mockPayment as any);
      paymentRepository.updatePaymentStatus.mockResolvedValue(undefined as any);

      await service.handleWebhookEvent(event);

      expect(paymentRepository.updatePaymentStatus).toHaveBeenCalledWith(
        mockPaymentId,
        expect.objectContaining({
          status: 'failed',
        }),
      );
    });

    it('should handle payment_intent.canceled event', async () => {
      const mockPaymentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockPayment = { id: mockPaymentId, status: 'pending' };
      const event: Stripe.Event = {
        id: 'evt_test123',
        type: 'payment_intent.canceled',
        data: {
          object: {
            id: 'pi_test123',
            status: 'canceled',
            created: Math.floor(Date.now() / 1000),
            metadata: { paymentId: mockPaymentId },
          },
        },
      } as any;

      paymentRepository.findPaymentById.mockResolvedValue(mockPayment as any);
      paymentRepository.updatePaymentStatus.mockResolvedValue(undefined as any);

      await service.handleWebhookEvent(event);

      expect(paymentRepository.updatePaymentStatus).toHaveBeenCalledWith(
        mockPaymentId,
        expect.objectContaining({
          status: 'failed',
          is_paid: false,
        }),
      );
    });

    it('should handle charge.refunded event', async () => {
      const mockPaymentId = '550e8400-e29b-41d4-a716-446655440003';
      const mockPayment = { id: mockPaymentId, status: 'completed' };
      const event: Stripe.Event = {
        id: 'evt_test123',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_test123',
            payment_intent: 'pi_test123',
            refunded: true,
            amount_refunded: 50000,
            amount: 50000,
            currency: 'usd',
          },
        },
      } as any;

      paymentRepository.findPaymentByTransactionId.mockResolvedValue(
        mockPayment as any,
      );
      paymentRepository.updatePaymentStatus.mockResolvedValue(undefined as any);

      await service.handleWebhookEvent(event);

      expect(paymentRepository.findPaymentByTransactionId).toHaveBeenCalledWith(
        'ch_test123',
      );
      expect(paymentRepository.updatePaymentStatus).toHaveBeenCalledWith(
        mockPaymentId,
        {
          status: 'refunded',
          is_paid: false,
        },
      );
    });

    it('should handle charge.dispute.created event by marking as disputed', async () => {
      const mockPaymentId = '550e8400-e29b-41d4-a716-446655440004';
      const mockPayment = { id: mockPaymentId, status: 'completed' };
      const event: Stripe.Event = {
        id: 'evt_test123',
        type: 'charge.dispute.created',
        data: {
          object: {
            charge: 'ch_test123',
            payment_intent: 'pi_test123',
            id: 'dp_test123',
            status: 'warning_under_review',
          },
        },
      } as any;

      paymentRepository.findPaymentByTransactionId.mockResolvedValue(
        mockPayment as any,
      );
      paymentRepository.updatePaymentStatus.mockResolvedValue(undefined as any);

      await service.handleWebhookEvent(event);

      expect(paymentRepository.findPaymentByTransactionId).toHaveBeenCalledWith(
        'ch_test123',
      );
      expect(paymentRepository.updatePaymentStatus).toHaveBeenCalledWith(
        mockPaymentId,
        {
          status: 'disputed',
        },
      );
    });

    it('should skip unknown event types silently', async () => {
      const event: Stripe.Event = {
        id: 'evt_test123',
        type: 'unknown.event',
        data: {
          object: {},
        },
      } as any;

      await expect(service.handleWebhookEvent(event)).resolves.not.toThrow();
      expect(paymentRepository.updatePaymentStatus).not.toHaveBeenCalled();
    });
  });
});
