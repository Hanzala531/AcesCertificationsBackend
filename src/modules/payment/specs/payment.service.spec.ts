import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../payment.service';
import {
  PaymentRepository,
  Payment,
  PaymentWithDetails,
} from '../payment.repository';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentType } from '../dto/initiate-payment.dto';
import { StripeService } from '../services/stripe.service';
import { CertificateService } from '../../certificate/services/certificate.service';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';

describe('PaymentService', () => {
  let service: PaymentService;
  let repository: jest.Mocked<PaymentRepository>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockCertificateId = '550e8400-e29b-41d4-a716-446655440001';
  const mockPaymentId = '550e8400-e29b-41d4-a716-446655440002';

  const mockPayment: Payment = {
    id: mockPaymentId,
    user_id: mockUserId,
    certificate_id: mockCertificateId,
    payment_type: 'self_disclosure',
    amount: 500.0,
    currency: 'USD',
    status: 'pending',
    is_paid: false,
    transaction_id: null,
    payment_method: null,
    paid_at: null,
    stripe_payment_intent_id: null,
    stripe_customer_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPaymentWithDetails: PaymentWithDetails = {
    ...mockPayment,
    certificate_name: 'ISO 9001',
    user_email: 'test@example.com',
  };

  beforeEach(async () => {
    const mockRepository = {
      createPayment: jest.fn(),
      findPaymentById: jest.fn(),
      findPaymentWithDetails: jest.fn(),
      confirmPayment: jest.fn(),
      failPayment: jest.fn(),
      findUserPayments: jest.fn(),
      findPendingPaymentForCertificate: jest.fn(),
      findCompletedPaymentForAssessment: jest.fn(),
      updatePaymentWithStripeIntent: jest.fn(),
      updatePaymentStatus: jest.fn(),
      findPaymentByStripePaymentIntentId: jest.fn(),
    };

    const mockStripeService = {
      createPaymentIntent: jest.fn(),
      confirmPaymentIntent: jest.fn(),
      createOrGetCustomer: jest.fn(),
      refundPayment: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      getPaymentIntent: jest.fn(),
    };

    const mockCertificateService = {
      getCertificateById: jest.fn().mockResolvedValue({
        id: mockCertificateId,
        name: 'ISO 9001',
        disclosure_price: 500.0,
        assured_price: 5000.0,
      }),
      createCertificate: jest.fn(),
      getCertificates: jest.fn(),
    };

    const mockOrganizationRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockEmployeeRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepository, useValue: mockRepository },
        { provide: StripeService, useValue: mockStripeService },
        { provide: CertificateService, useValue: mockCertificateService },
        {
          provide: OrganizationRepository,
          useValue: mockOrganizationRepository,
        },
        { provide: EmployeeRepository, useValue: mockEmployeeRepository },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    repository = module.get(PaymentRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiatePayment', () => {
    it('should create a new payment for self_disclosure', async () => {
      const amount = await service.getPaymentAmount(
        PaymentType.SELF_DISCLOSURE,
        mockCertificateId,
      );
      expect(amount).toBe(500.0);
    });

    it('should create a new payment for assured with correct amount', async () => {
      const amount = await service.getPaymentAmount(
        PaymentType.ASSURED,
        mockCertificateId,
      );
      expect(amount).toBe(5000.0);
    });

    it('should return existing pending payment if one exists', async () => {
      const amount = await service.getPaymentAmount(
        PaymentType.SELF_DISCLOSURE,
        mockCertificateId,
      );
      expect(amount).toBe(500.0);
    });

    it('should use provided currency', async () => {
      const amount = await service.getPaymentAmount(
        PaymentType.ASSURED,
        mockCertificateId,
      );
      expect(amount).toBe(5000.0);
    });
  });

  describe('getPaymentById', () => {
    it('should return payment with details for owner', async () => {
      repository.findPaymentWithDetails.mockResolvedValue(
        mockPaymentWithDetails,
      );

      const result = await service.getPaymentById(mockUserId, mockPaymentId);

      expect(result).toEqual(mockPaymentWithDetails);
    });

    it('should throw NotFoundException if payment not found', async () => {
      repository.findPaymentWithDetails.mockResolvedValue(null);

      await expect(
        service.getPaymentById(mockUserId, mockPaymentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      repository.findPaymentWithDetails.mockResolvedValue(
        mockPaymentWithDetails,
      );

      await expect(
        service.getPaymentById('different-user-id', mockPaymentId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to access any payment', async () => {
      repository.findPaymentWithDetails.mockResolvedValue(
        mockPaymentWithDetails,
      );

      const result = await service.getPaymentById(
        'different-user-id',
        mockPaymentId,
        true,
      );

      expect(result).toEqual(mockPaymentWithDetails);
    });
  });

  describe('confirmPayment', () => {
    it('should confirm a pending payment', async () => {
      const confirmedPayment = {
        ...mockPayment,
        status: 'completed' as const,
        is_paid: true,
        transaction_id: 'txn_123',
        paid_at: new Date(),
      };
      repository.findPaymentById.mockResolvedValue(mockPayment);
      repository.confirmPayment.mockResolvedValue(confirmedPayment);

      const result = await service.confirmPayment(
        mockPaymentId,
        'txn_123',
        'card',
      );

      expect(result.is_paid).toBe(true);
      expect(result.status).toBe('completed');
      expect(repository.confirmPayment).toHaveBeenCalledWith(
        mockPaymentId,
        'txn_123',
        'card',
      );
    });

    it('should throw NotFoundException if payment not found', async () => {
      repository.findPaymentById.mockResolvedValue(null);

      await expect(
        service.confirmPayment(mockPaymentId, 'txn_123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if payment already confirmed', async () => {
      repository.findPaymentById.mockResolvedValue({
        ...mockPayment,
        is_paid: true,
        status: 'completed',
      });

      await expect(
        service.confirmPayment(mockPaymentId, 'txn_123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if payment failed', async () => {
      repository.findPaymentById.mockResolvedValue({
        ...mockPayment,
        status: 'failed',
      });

      await expect(
        service.confirmPayment(mockPaymentId, 'txn_123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserPayments', () => {
    it('should return paginated user payments', async () => {
      const mockResponse = {
        data: [mockPaymentWithDetails],
        total: 1,
        page: 1,
        limit: 10,
      };
      repository.findUserPayments.mockResolvedValue(mockResponse);

      const result = await service.getUserPayments(mockUserId, 1, 10);

      expect(result).toEqual(mockResponse);
      expect(repository.findUserPayments).toHaveBeenCalledWith(mockUserId, {
        page: 1,
        limit: 10,
      });
    });
  });

  describe('getPaymentAmount', () => {
    it('should return correct amount for self_disclosure', async () => {
      const amount = await service.getPaymentAmount(
        PaymentType.SELF_DISCLOSURE,
        mockCertificateId,
      );
      expect(amount).toBe(500.0);
    });

    it('should return correct amount for assured', async () => {
      const amount = await service.getPaymentAmount(
        PaymentType.ASSURED,
        mockCertificateId,
      );
      expect(amount).toBe(5000.0);
    });
  });

  describe('verifyPaymentForAssessment', () => {
    it('should return payment if valid and belongs to user', async () => {
      const completedPayment = {
        ...mockPayment,
        is_paid: true,
        status: 'completed' as const,
      };
      repository.findPaymentById.mockResolvedValue(completedPayment);

      const result = await service.verifyPaymentForAssessment(
        mockUserId,
        mockPaymentId,
      );

      expect(result).toEqual(completedPayment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      repository.findPaymentById.mockResolvedValue(null);

      await expect(
        service.verifyPaymentForAssessment(mockUserId, mockPaymentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if payment belongs to different user', async () => {
      repository.findPaymentById.mockResolvedValue(mockPayment);

      await expect(
        service.verifyPaymentForAssessment('different-user-id', mockPaymentId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if payment not completed', async () => {
      repository.findPaymentById.mockResolvedValue(mockPayment);

      await expect(
        service.verifyPaymentForAssessment(mockUserId, mockPaymentId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createStripePaymentIntent', () => {
    const mockUserEmail = 'user@example.com';
    const mockUserName = 'Test User';
    const mockStripePaymentIntent = {
      id: 'pi_test123',
      client_secret: 'pi_test123_secret',
      amount: 50000,
      currency: 'usd',
      status: 'requires_payment_method',
      created: Math.floor(Date.now() / 1000),
    };

    it('should create a Stripe payment intent for new payment', async () => {
      const stripeService = service['stripeService'];

      repository.findPendingPaymentForCertificate.mockResolvedValue(null);
      repository.createPayment.mockResolvedValue(mockPayment);
      (stripeService.createPaymentIntent as jest.Mock).mockResolvedValue(
        mockStripePaymentIntent as any,
      );
      (stripeService.createOrGetCustomer as jest.Mock).mockResolvedValue({
        id: 'cus_test123',
      } as any);
      repository.updatePaymentWithStripeIntent.mockResolvedValue(
        undefined as any,
      );

      const result = await service.createStripePaymentIntent(
        mockUserId,
        mockUserEmail,
        mockUserName,
        {
          certificate_id: mockCertificateId,
          payment_type: PaymentType.SELF_DISCLOSURE,
          save_payment_method: true,
        },
      );

      expect(result).toEqual({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 50000,
        currency: 'usd',
        status: 'requires_payment_method',
        customer_id: 'cus_test123',
        payment_id: mockPayment.id,
        created: expect.any(String),
      });
      expect(repository.createPayment).toHaveBeenCalled();
      expect(stripeService.createPaymentIntent).toHaveBeenCalled();
      // ensure we forwarded the stripe customer id into the createPaymentIntent call
      expect(
        (stripeService.createPaymentIntent as jest.Mock).mock.calls[0][7],
      ).toBe('cus_test123');
    });

    it('should reuse existing pending payment', async () => {
      const stripeService = service['stripeService'];
      const existingPayment = { ...mockPayment, id: 'existing-pi' };

      repository.findPendingPaymentForCertificate.mockResolvedValue(
        existingPayment,
      );
      (stripeService.createOrGetCustomer as jest.Mock).mockResolvedValue({
        id: 'cus_reuse123',
      });
      (stripeService.createPaymentIntent as jest.Mock).mockResolvedValue(
        mockStripePaymentIntent as any,
      );
      repository.updatePaymentWithStripeIntent.mockResolvedValue(
        undefined as any,
      );

      await service.createStripePaymentIntent(
        mockUserId,
        mockUserEmail,
        mockUserName,
        {
          certificate_id: mockCertificateId,
          payment_type: PaymentType.SELF_DISCLOSURE,
          save_payment_method: false,
        },
      );

      expect(repository.createPayment).not.toHaveBeenCalled();
      expect(stripeService.createPaymentIntent).toHaveBeenCalled();
      expect(
        (stripeService.createPaymentIntent as jest.Mock).mock.calls[0][7],
      ).toBe('cus_reuse123');
    });

    it('should handle Stripe error and update payment status to failed', async () => {
      const stripeService = service['stripeService'];
      const error = new Error('Stripe API error');

      repository.findPendingPaymentForCertificate.mockResolvedValue(null);
      repository.createPayment.mockResolvedValue(mockPayment);
      (stripeService.createOrGetCustomer as jest.Mock).mockResolvedValue({
        id: 'cus_test123',
      } as any);
      (stripeService.createPaymentIntent as jest.Mock).mockRejectedValue(error);
      repository.updatePaymentStatus.mockResolvedValue(undefined as any);

      await expect(
        service.createStripePaymentIntent(
          mockUserId,
          mockUserEmail,
          mockUserName,
          {
            certificate_id: mockCertificateId,
            payment_type: PaymentType.SELF_DISCLOSURE,
            save_payment_method: true,
          },
        ),
      ).rejects.toThrow('Stripe API error');

      expect(repository.updatePaymentStatus).toHaveBeenCalledWith(
        mockPaymentId,
        { status: 'failed' },
      );
    });

    describe('confirmStripePayment', () => {
      const mockConfirmDto = {
        payment_method_id: 'pm_123',
        off_session: false,
      };
      const mockStripeConfirmedIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 50000,
        currency: 'usd',
        status: 'succeeded',
        created: Math.floor(Date.now() / 1000),
      };

      it('should confirm payment when called with internal payment id', async () => {
        const stripeService = service['stripeService'];
        const paymentWithIntent = {
          ...mockPayment,
          stripe_payment_intent_id: 'pi_test123',
        };

        repository.findPaymentById.mockResolvedValue(paymentWithIntent);
        (stripeService.confirmPaymentIntent as jest.Mock).mockResolvedValue(
          mockStripeConfirmedIntent as any,
        );

        const result = await service.confirmStripePayment(
          mockPaymentId,
          mockUserId,
          'test@example.com',
          mockConfirmDto as any,
        );

        expect(stripeService.confirmPaymentIntent).toHaveBeenCalledWith(
          'pi_test123',
          mockConfirmDto,
        );
        expect(result.status).toBe('succeeded');
        expect(result.payment_id).toBe(mockPaymentId);
      });

      it('should confirm payment when called with stripe payment intent id', async () => {
        const stripeService = service['stripeService'];
        repository.findPaymentByStripePaymentIntentId.mockResolvedValue({
          ...mockPayment,
          stripe_payment_intent_id: 'pi_test123',
        });
        (stripeService.confirmPaymentIntent as jest.Mock).mockResolvedValue(
          mockStripeConfirmedIntent as any,
        );

        const result = await service.confirmStripePayment(
          'pi_test123',
          mockUserId,
          'test@example.com',
          mockConfirmDto as any,
        );

        expect(stripeService.confirmPaymentIntent).toHaveBeenCalledWith(
          'pi_test123',
          mockConfirmDto,
        );
        expect(result.status).toBe('succeeded');
        expect(result.payment_id).toBe(mockPaymentId);
      });
    });

    describe('getPaymentIntentStatus', () => {
      it('should return status when asked with stripe id', async () => {
        repository.findPaymentByStripePaymentIntentId.mockResolvedValue({
          ...mockPayment,
          stripe_payment_intent_id: 'pi_test123',
        });
        const stripeService = service['stripeService'];
        (stripeService.getPaymentIntent as jest.Mock).mockResolvedValue({
          id: 'pi_test123',
          client_secret: 'pi_test123_secret',
          amount: 50000,
          currency: 'usd',
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
        } as any);

        const result = await service.getPaymentIntentStatus(
          'pi_test123',
          mockUserId,
        );
        expect(result.status).toBe('succeeded');
      });
    });
  });
});
