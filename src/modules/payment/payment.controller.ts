import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Query,
  Req,
  Headers,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaymentService } from './payment.service';
import { ConfirmPaymentDto } from './dto/initiate-payment.dto';
import {
  CreatePaymentIntentDto,
  ConfirmStripePaymentDto,
  StripePaymentIntentResponseDto,
} from './dto/stripe.dto';
import { TestConfirmPaymentDto } from './dto/test-payment.dto';
import { CreatePaymentMethodDto } from './dto/payment-method.dto';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { Logger, Request } from '@nestjs/common';
import {
  SwaggerGetMyPayments,
  SwaggerGetPaymentById,
  SwaggerConfirmPayment,
  SwaggerCreateStripePaymentIntent,
  SwaggerConfirmStripePayment,
  SwaggerGetPaymentIntentStatus,
  SwaggerGetPaymentMethods,
  SwaggerAddPaymentMethod,
} from './swagger/payment.swagger';
import {
  SwaggerGetAdminPaymentMetrics,
  SwaggerGetAdminPayments,
  SwaggerGetAdminPaymentDetails,
} from './swagger/admin-payment.swagger';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { StripeService } from './services/stripe.service';
import Stripe from 'stripe';
import { CertificateService } from '../certificate/services/certificate.service';
import { OrganizationService } from '../organization/organization.service';
import { EmployeeService } from '../employee/employee.service';
import { BadgeRepository } from '../notification/badge.repository';
import { AssessmentRepository } from '../assessment/assessment.repository';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    role: string;
    name?: string;
  };
}

@ApiTags('💳 Payments')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(AuthGuard('jwt'), RoleGuard)
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly stripeService: StripeService,
    private readonly certificateService: CertificateService,
    private readonly organizationService: OrganizationService,
    private readonly employeeService: EmployeeService,
    private readonly badgeRepository: BadgeRepository,
    private readonly assessmentRepository: AssessmentRepository,
  ) {}

  @Post('payments/stripe/create-intent')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerCreateStripePaymentIntent()
  async createStripePaymentIntent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    const userId = req.user.sub;
    const userEmail = req.user.email;
    const userRole = req.user.role;

    const certificate = await this.certificateService.getCertificateById(
      dto.certificate_id,
    );
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    let organizationId: string | undefined;
    let branchId: string | null = null;

    const org = await this.organizationService.findByUserId(userId);
    if (org) {
      organizationId = org.id;
    } else {
      try {
        const employee = await this.employeeService.getMyProfile(userId);
        if (employee && employee.organization_id) {
          organizationId = employee.organization_id;
          branchId = employee.branch_id ?? null;
        }
      } catch (err) {}
    }

    if (!organizationId) {
      throw new BadRequestException(
        'Organization information not found for user; cannot proceed with payment',
      );
    }

    const existingCompletedAssessmentForType =
      await this.assessmentRepository.findCompletedAssessmentByOrganizationCertificateAndType(
        organizationId,
        dto.certificate_id,
        dto.payment_type as 'self_disclosure' | 'assured',
        branchId,
      );

    if (existingCompletedAssessmentForType) {
      const assessmentLabel =
        dto.payment_type === 'self_disclosure' ? 'self-disclosure' : 'assured';
      throw new BadRequestException(
        `This branch has already completed the ${assessmentLabel} assessment for this certificate; duplicate payment is not allowed`,
      );
    }

    if (dto.payment_type === 'assured') {
      const completedDisclosureAssessment =
        await this.assessmentRepository.findCompletedSelfDisclosureAssessment(
          organizationId,
          dto.certificate_id,
        );

      if (!completedDisclosureAssessment) {
        throw new BadRequestException(
          'You have not completed the self-disclosure assessment for this certificate yet; cannot proceed with assured payment',
        );
      }

      const matchingBadge =
        await this.badgeRepository.findBadgeByOrganizationAndCertificate(
          organizationId,
          dto.certificate_id,
        );

      if (!matchingBadge) {
        throw new BadRequestException(
          'You dont have a badge in self disclosure for this certificate yet; cannot proceed with assured payment',
        );
      }
    }
    this.logger.debug(
      `Creating Stripe payment intent for user ${userId}, certificate ${dto.certificate_id}`,
    );

    const paymentIntent = await this.paymentService.createStripePaymentIntent(
      userId,
      userEmail,
      userRole,
      dto,
    );

    return {
      success: true,
      message: 'Stripe payment intent created successfully',
      data: paymentIntent,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('payments/:paymentId/stripe/confirm')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.OK)
  @SwaggerConfirmStripePayment()
  async confirmStripePayment(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
    @Body() dto: ConfirmStripePaymentDto,
  ) {
    const userId = req.user.sub;

    this.logger.debug(
      `Confirming Stripe payment ${paymentId} for user ${userId}`,
    );

    const userEmail = req.user.email;

    const result = await this.paymentService.confirmStripePayment(
      paymentId,
      userId,
      userEmail,
      dto,
    );

    return {
      success: true,
      message: 'Payment confirmed',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('payments/:paymentId/stripe/test-confirm')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: TestConfirmPaymentDto,
    description:
      'Test payment confirmation using Stripe test tokens (for Swagger testing). Use pm_card_visa for success.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed successfully (test mode)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Payment confirmed successfully (test mode)',
        },
        data: { $ref: '#/components/schemas/StripePaymentIntentResponseDto' },
        statusCode: { type: 'number', example: 200 },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-15T10:00:00.000Z',
        },
      },
      required: ['success', 'message', 'data', 'statusCode', 'timestamp'],
    },
  })
  async testConfirmPayment(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
    @Body() dto: TestConfirmPaymentDto,
  ) {
    const userId = req.user.sub;

    this.logger.debug(
      `Test confirming payment ${paymentId} for user ${userId}`,
    );

    const result = await this.paymentService.testConfirmPayment(
      paymentId,
      userId,
      dto.test_payment_method_token,
    );

    return {
      success: true,
      message: 'Payment confirmed successfully (test mode)',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('payments/:paymentId/stripe/status')
  @Roles('organization', 'organization_member')
  @SwaggerGetPaymentIntentStatus()
  async getPaymentIntentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
  ) {
    const userId = req.user.sub;

    const status = await this.paymentService.getPaymentIntentStatus(
      paymentId,
      userId,
    );

    return {
      success: true,
      message: 'Payment intent status retrieved',
      data: status,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('payments/my-payments')
  @Roles('organization', 'organization_member')
  @SwaggerGetMyPayments()
  async getMyPayments(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user.sub;
    const result = await this.paymentService.getUserPayments(
      userId,
      page || 1,
      limit || 10,
    );

    return {
      success: true,
      message: 'Payments retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('payments/payment-methods')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerAddPaymentMethod()
  async addPaymentMethod(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;

    this.logger.debug(
      `Adding payment method for user ${userId} with role ${userRole}`,
    );

    const userEmail = req.user.email;

    const paymentMethod = await this.paymentService.addPaymentMethod(
      userId,
      userRole,
      userEmail,
      dto,
    );

    return {
      success: true,
      message: 'Payment method added successfully',
      data: paymentMethod,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('payments/payment-methods')
  @Roles('organization', 'organization_member')
  @SwaggerGetPaymentMethods()
  async getPaymentMethods(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const userRole = req.user.role;

    this.logger.debug(
      `Getting payment methods for user ${userId} with role ${userRole}`,
    );

    const paymentMethods =
      await this.paymentService.getPaymentMethodsByOrganization(
        userId,
        userRole,
      );

    return {
      success: true,
      message: 'Payment methods retrieved successfully',
      data: paymentMethods,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('payments/:paymentId')
  @Roles('organization', 'organization_member', 'admin', 'subadmin')
  @SwaggerGetPaymentById()
  async getPaymentById(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
  ) {
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin';
    const result = await this.paymentService.getPaymentById(
      userId,
      paymentId,
      isAdmin,
    );

    return {
      success: true,
      message: 'Payment retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('payments/:paymentId/confirm')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerConfirmPayment()
  async confirmPayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    const result = await this.paymentService.confirmPayment(
      paymentId,
      dto.transaction_id,
      dto.payment_method,
    );

    return {
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        payment_id: result.id,
        status: result.status,
        is_paid: result.is_paid,
        transaction_id: result.transaction_id,
        paid_at: result.paid_at,
      },
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    description: 'Stripe webhook event',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook received',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhook received' },
        statusCode: { type: 'number', example: 200 },
      },
      required: ['success', 'message', 'statusCode'],
    },
  })
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      const rawBody = (req as any).rawBody || Buffer.from('');
      const bodyString =
        typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

      const event = this.stripeService.verifyWebhookSignature(
        bodyString,
        signature,
      );

      this.stripeWebhookService
        .handleWebhookEvent(event as unknown as Stripe.Event)
        .catch((error) => {
          this.logger.error(
            `Error processing webhook ${event.id}: ${error.message}`,
          );
        });

      return {
        success: true,
        message: 'Webhook received',
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      this.logger.error(
        `Webhook processing failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('admin/payments/metrics')
  @Roles('admin', 'subadmin')
  @SwaggerGetAdminPaymentMetrics()
  async getAdminPaymentMetrics(@Req() req: AuthenticatedRequest) {
    const metrics = await this.paymentService.getAdminPaymentMetrics();

    return {
      success: true,
      message: 'Payment metrics retrieved successfully',
      data: metrics,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/payments')
  @Roles('admin', 'subadmin')
  @SwaggerGetAdminPayments()
  async getAdminPayments(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('organizationId') organizationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: 'date' | 'amount',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const startDateObj = startDate ? new Date(startDate) : undefined;
    const endDateObj = endDate ? new Date(endDate) : undefined;

    // Normalize empty strings to undefined to ensure filters are truly optional
    const normalizedStatus =
      status && status.trim() ? status.trim() : undefined;
    const normalizedOrganizationId =
      organizationId && organizationId.trim()
        ? organizationId.trim()
        : undefined;

    const result = await this.paymentService.getAdminPayments({
      page: page || 1,
      limit: limit || 10,
      status: normalizedStatus,
      organizationId: normalizedOrganizationId,
      startDate: startDateObj,
      endDate: endDateObj,
      sortBy: sortBy || 'date',
      sortOrder: sortOrder || 'desc',
    });

    return {
      success: true,
      message: 'Payments retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/payments/:paymentId')
  @Roles('admin', 'subadmin')
  @SwaggerGetAdminPaymentDetails()
  async getAdminPaymentDetails(
    @Req() req: AuthenticatedRequest,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    const details = await this.paymentService.getAdminPaymentDetails(paymentId);

    return {
      success: true,
      message: 'Payment details retrieved successfully',
      data: details,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }
}
