import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  InitiatePaymentDto,
  ConfirmPaymentDto,
} from '../dto/initiate-payment.dto';
import {
  InitiatePaymentApiResponse,
  GetPaymentApiResponse,
  GetMyPaymentsApiResponse,
  ConfirmPaymentApiResponse,
  BadRequestErrorDto,
  NotFoundErrorDto,
  ForbiddenErrorDto,
  UnauthorizedErrorDto,
} from '../dto/payment-response.dto';
import {
  GetPaymentMethodsApiResponse,
  CreatePaymentMethodApiResponse,
  CreatePaymentMethodDto,
} from '../dto/payment-method.dto';
import {
  CreatePaymentIntentDto,
  ConfirmStripePaymentDto,
  StripePaymentIntentResponseDto,
  CreateStripePaymentIntentApiResponse,
  ConfirmStripePaymentApiResponse,
  GetPaymentIntentStatusApiResponse,
} from '../dto/stripe.dto';

// Swagger decorator for POST /payments/initiate
export function SwaggerInitiatePayment() {
  return applyDecorators(
    ApiExtraModels(
      InitiatePaymentApiResponse,
      BadRequestErrorDto,
      UnauthorizedErrorDto,
      ForbiddenErrorDto,
    ),
    ApiOperation({
      summary: 'Initiate a payment for certificate assessment',
      description: `
Creates a new payment record for a certificate assessment.

**Assessment Types & Pricing:**
- \`self_disclosure\`: **$500** - Organization self-reports compliance
- \`assured\`: **$5000** - Third-party verification included

**Behavior:**
- If a pending payment already exists for the same certificate and type, returns the existing payment
- Payment must be confirmed before creating an assessment

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiBody({
      type: InitiatePaymentDto,
      description: 'Payment initiation details',
      examples: {
        self_disclosure: {
          summary: 'Self-Disclosure Assessment ($500)',
          value: {
            certificate_id: '550e8400-e29b-41d4-a716-446655440000',
            payment_type: 'self_disclosure',
            currency: 'USD',
          },
        },
        assured: {
          summary: 'Assured Assessment ($5000)',
          value: {
            certificate_id: '550e8400-e29b-41d4-a716-446655440000',
            payment_type: 'assured',
            currency: 'USD',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Payment initiated successfully',
      type: InitiatePaymentApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation error - Invalid request data',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden - User does not have required role',
      type: ForbiddenErrorDto,
    }),
  );
}

// Swagger decorator for GET /payments/my-payments
export function SwaggerGetMyPayments() {
  return applyDecorators(
    ApiExtraModels(GetMyPaymentsApiResponse, UnauthorizedErrorDto),
    ApiOperation({
      summary: 'Get all payments for the current user',
      description: `
Retrieves a paginated list of all payments made by the authenticated user.

**Response includes:**
- Payment details with status
- Certificate name for each payment
- Pagination metadata

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      example: 1,
      description: 'Page number (default: 1)',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 10,
      description: 'Items per page (default: 10, max: 100)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payments retrieved successfully',
      type: GetMyPaymentsApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
  );
}

// Swagger decorator for POST /payments/payment-methods
export function SwaggerAddPaymentMethod() {
  return applyDecorators(
    ApiExtraModels(
      CreatePaymentMethodApiResponse,
      CreatePaymentMethodDto,
      BadRequestErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Add Payment Method',
      description: `
Saves a payment method for the authenticated organization.

**Access Control:**
- Only accessible to \`organization\` and \`organization_member\` roles
- Payment methods are shared across the organization
- Organization members can add payment methods on behalf of the organization

**How to Get Stripe Payment Method ID:**
1. **Frontend Integration (Stripe.js):**
   - Use Stripe.js to collect card details securely
   - Call \`stripe.createPaymentMethod()\` with card element
   - This returns a payment method object with ID (\`pm_xxx\`)
   - Send this ID to this endpoint

2. **After Payment Intent:**
   - When a payment intent succeeds, the \`payment_method\` field contains the ID
   - You can extract it from the payment intent response
   - Or from the webhook event \`payment_intent.succeeded\`

**Payment Method Details:**
- Requires Stripe payment method ID (\`pm_xxx\`) - **REQUIRED**
- Automatically retrieves card details (brand, last4, exp) from Stripe if not provided
- Can be set as default payment method
- Type (card, bank_account, etc.) is required

**Behavior:**
- If setting as default, automatically unsets other default payment methods
- Prevents duplicate payment methods (same Stripe payment method ID)
- Retrieves missing card details from Stripe automatically

**Use Cases:**
- Save payment method after successful payment
- Add payment method manually for future use
- Set up recurring payment methods
      `,
    }),
    ApiBody({
      type: CreatePaymentMethodDto,
      description: 'Payment method details',
      examples: {
        card: {
          summary: 'Add Card Payment Method',
          value: {
            stripe_payment_method_id: 'pm_1234567890abcdef',
            type: 'card',
            card_brand: 'visa',
            card_last4: '4242',
            card_exp_month: 12,
            card_exp_year: 2025,
            is_default: false,
          },
        },
        minimal: {
          summary: 'Minimal (Auto-fetch from Stripe)',
          value: {
            stripe_payment_method_id: 'pm_1234567890abcdef',
            type: 'card',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Payment method added successfully',
      type: CreatePaymentMethodApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation error or payment method already exists',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description:
        'Forbidden - User does not have required role or organization not found',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
  );
}

// Swagger decorator for GET /payments/payment-methods
export function SwaggerGetPaymentMethods() {
  return applyDecorators(
    ApiExtraModels(
      GetPaymentMethodsApiResponse,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get Payment Methods',
      description: `
Retrieves all saved payment methods for the authenticated organization.

**Access Control:**
- Only accessible to \`organization\` and \`organization_member\` roles
- Returns payment methods added by the organization
- Organization members see the same payment methods as the organization owner

**Payment Method Details:**
- Includes card information (last 4 digits, brand, expiration)
- Includes billing details if available
- Shows which payment method is set as default
- Sorted by default status (default first) and creation date

**Use Cases:**
- Display saved payment methods for quick checkout
- Allow users to select a previously saved payment method
- Manage organization payment methods
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment methods retrieved successfully',
      type: GetPaymentMethodsApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description:
        'Forbidden - User does not have required role or organization not found',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
  );
}

// Swagger decorator for GET /payments/:paymentId
export function SwaggerGetPaymentById() {
  return applyDecorators(
    ApiExtraModels(
      GetPaymentApiResponse,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get payment details by ID',
      description: `
Retrieves detailed information about a specific payment.

**Access Control:**
- Users can only access their own payments
- Admins can access any payment

**Response includes:**
- Complete payment details
- Certificate name
- User email (for admin view)

**Required Role**: \`organization\`, \`organization_member\`, or \`admin\`
      `,
    }),
    ApiParam({
      name: 'paymentId',
      description: 'Payment UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment retrieved successfully',
      type: GetPaymentApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Payment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Access denied - Cannot access another user's payment",
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
  );
}

// Swagger decorator for PATCH /payments/:paymentId/confirm
export function SwaggerConfirmPayment() {
  return applyDecorators(
    ApiExtraModels(
      ConfirmPaymentApiResponse,
      NotFoundErrorDto,
      BadRequestErrorDto,
      UnauthorizedErrorDto,
      ForbiddenErrorDto,
    ),
    ApiOperation({
      summary: 'Confirm a payment (Admin/System only)',
      description: `
Marks a pending payment as completed.

**Use Cases:**
- Payment gateway webhook callback
- Admin manual confirmation for bank transfers

**After Confirmation:**
- Payment status changes to \`completed\`
- User can now create an assessment using this payment

**Required Role**: \`admin\`
      `,
    }),
    ApiParam({
      name: 'paymentId',
      description: 'Payment UUID to confirm',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      type: ConfirmPaymentDto,
      description: 'Payment confirmation details',
      examples: {
        stripe: {
          summary: 'Stripe Payment',
          value: {
            transaction_id: 'pi_3L2ABC123456789',
            payment_method: 'stripe',
          },
        },
        paypal: {
          summary: 'PayPal Payment',
          value: {
            transaction_id: 'PAY-1AB23456CD789012EF',
            payment_method: 'paypal',
          },
        },
        manual: {
          summary: 'Manual/Bank Transfer',
          value: {
            transaction_id: 'BANK-REF-2024-001',
            payment_method: 'bank_transfer',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment confirmed successfully',
      type: ConfirmPaymentApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Payment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Payment already confirmed or failed',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden - Admin role required',
      type: ForbiddenErrorDto,
    }),
  );
}

// Swagger decorator for POST /payments/stripe/create-intent
export function SwaggerCreateStripePaymentIntent() {
  return applyDecorators(
    ApiExtraModels(
      CreateStripePaymentIntentApiResponse,
      StripePaymentIntentResponseDto,
      BadRequestErrorDto,
      UnauthorizedErrorDto,
      ForbiddenErrorDto,
      NotFoundErrorDto,
    ),
    ApiOperation({
      summary: 'Create Stripe Payment Intent',
      description: `
Creates a Stripe Payment Intent for secure card processing.

**Recommended Flow:**
1. Call this endpoint to create payment intent
2. Use \`client_secret\` with Stripe.js on frontend
3. Confirm payment client-side with Stripe.js
4. Call confirm endpoint (optional - webhook handles it)
5. Webhook confirms final payment status

**Pricing:**
- \`self_disclosure\`: **$500** (50000 cents)
- \`assured\`: **$5000** (500000 cents)

**Payment ID:**
- Returns both \`id\` (Stripe Payment Intent ID) and \`payment_id\` (internal UUID)
- Use either ID for subsequent operations

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiBody({
      type: CreatePaymentIntentDto,
      description: 'Payment intent creation details',
      examples: {
        self_disclosure: {
          summary: 'Self-Disclosure Payment ($500)',
          value: {
            certificate_id: '550e8400-e29b-41d4-a716-446655440000',
            payment_type: 'self_disclosure',
            save_payment_method: false,
          },
        },
        assured: {
          summary: 'Assured Payment ($5000)',
          value: {
            certificate_id: '550e8400-e29b-41d4-a716-446655440000',
            payment_type: 'assured',
            save_payment_method: true,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Payment intent created successfully',
      type: CreateStripePaymentIntentApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation error or certificate not found',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Certificate not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden - User does not have required role',
      type: ForbiddenErrorDto,
    }),
  );
}

// Swagger decorator for POST /payments/:paymentId/stripe/confirm
export function SwaggerConfirmStripePayment() {
  return applyDecorators(
    ApiExtraModels(
      ConfirmStripePaymentApiResponse,
      StripePaymentIntentResponseDto,
      BadRequestErrorDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Confirm Stripe Payment',
      description: `
Confirms a Stripe payment after client-side Stripe.js confirmation.

**Payment ID:**
- Accepts either internal payment UUID or Stripe Payment Intent ID (\`pi_xxx\`)
- Use the \`payment_id\` from create-intent response, or the Stripe \`id\`

**Note:** Webhook will also process payment confirmation automatically.
This endpoint is optional but useful for immediate confirmation.

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiParam({
      name: 'paymentId',
      description: 'Payment UUID or Stripe Payment Intent ID (pi_xxx)',
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiBody({
      type: ConfirmStripePaymentDto,
      description: 'Payment confirmation details',
      examples: {
        standard: {
          summary: 'Standard Payment Confirmation',
          value: {
            payment_method_id: 'pm_1234567890abcdef',
            off_session: false,
          },
        },
        recurring: {
          summary: 'Recurring/Off-Session Payment',
          value: {
            payment_method_id: 'pm_1234567890abcdef',
            off_session: true,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment confirmed successfully',
      type: ConfirmStripePaymentApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Payment does not have a Stripe payment intent',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Payment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Access denied - Payment doesn't belong to user",
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
  );
}

// Swagger decorator for GET /payments/:paymentId/stripe/status
export function SwaggerGetPaymentIntentStatus() {
  return applyDecorators(
    ApiExtraModels(
      GetPaymentIntentStatusApiResponse,
      StripePaymentIntentResponseDto,
      BadRequestErrorDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get Payment Intent Status',
      description: `
Retrieves the current status of a Stripe payment intent.

**Payment ID:**
- Accepts either internal payment UUID or Stripe Payment Intent ID (\`pi_xxx\`)

**Status Values:**
- \`requires_payment_method\`: Payment method needed
- \`requires_confirmation\`: Awaiting confirmation
- \`requires_action\`: 3D Secure authentication required
- \`processing\`: Payment is being processed
- \`succeeded\`: Payment completed successfully
- \`canceled\`: Payment was canceled

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiParam({
      name: 'paymentId',
      description: 'Payment UUID or Stripe Payment Intent ID (pi_xxx)',
      type: 'string',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment intent status retrieved',
      type: GetPaymentIntentStatusApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Payment does not have a Stripe payment intent',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Payment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Access denied - Payment doesn't belong to user",
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: UnauthorizedErrorDto,
    }),
  );
}
