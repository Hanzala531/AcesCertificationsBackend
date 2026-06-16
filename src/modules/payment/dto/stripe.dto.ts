import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

// Billing Details DTO
export class BillingDetailsDto {
  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Billing address name',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'john.doe@company.com',
    description: 'Billing email address',
    maxLength: 255,
  })
  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email !== null)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    example: '123 Main St',
    description: 'Street address',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line1?: string;

  @ApiPropertyOptional({
    example: 'Apt 4B',
    description: 'Street address line 2',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({
    example: 'New York',
    description: 'City',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    example: 'NY',
    description: 'State/Province',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    example: '10001',
    description: 'Postal code',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  @ApiPropertyOptional({
    example: 'US',
    description: 'Country code (ISO 3166-1 alpha-2)',
    maxLength: 2,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}

// Create Payment Intent DTO
export class CreatePaymentIntentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the certificate to pay for',
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsString()
  certificate_id: string;

  @ApiProperty({
    enum: ['self_disclosure', 'assured'],
    description: 'Type of assessment',
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(['self_disclosure', 'assured'])
  payment_type: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether to save this payment method for future use (recurring payments)',
    default: false,
  })
  @IsOptional()
  @IsNotEmpty()
  save_payment_method?: boolean;

  @ApiPropertyOptional({
    type: BillingDetailsDto,
    description: 'Billing details for the payment',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingDetailsDto)
  billing_details?: BillingDetailsDto;
}

// Confirm Stripe Payment DTO
export class ConfirmStripePaymentDto {
  @ApiProperty({
    example: 'pm_1234567890abcdef',
    description: 'Stripe payment method ID from client-side Stripe.js',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  payment_method_id: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this is an off-session payment (recurring)',
    default: false,
  })
  @IsOptional()
  @IsNotEmpty()
  off_session?: boolean;
}

// Stripe error response DTO
export class StripeErrorDto {
  code: string;
  message: string;
  param?: string;
  payment_intent?: {
    id: string;
    client_secret: string;
    status: string;
  };
}

// Stripe Payment Intent Response DTO
export class StripePaymentIntentResponseDto {
  @ApiProperty({
    example: 'pi_1234567890abcdef',
    description: 'Stripe Payment Intent ID',
  })
  id: string;

  @ApiProperty({
    example: 'pi_1234567890abcdef_secret_1234567890',
    description: 'Client secret for client-side Stripe.js confirmation',
  })
  client_secret: string;

  @ApiProperty({
    example: 50000,
    description: 'Amount in smallest currency unit (cents for USD)',
  })
  amount: number;

  @ApiProperty({
    example: 'USD',
    description: 'Currency code',
  })
  currency: string;

  @ApiProperty({
    enum: [
      'requires_action',
      'requires_capture',
      'requires_confirmation',
      'requires_payment_method',
      'succeeded',
    ],
    description: 'Current status of the payment intent',
  })
  status: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Internal payment ID (database) for confirming the payment',
  })
  payment_id?: string;

  @ApiPropertyOptional({
    example: 'cus_1234567890abcdef',
    description: 'Stripe Customer ID if saved for future use',
  })
  customer_id?: string;

  @ApiProperty({
    example: new Date().toISOString(),
    description: 'Timestamp when payment intent was created',
  })
  created: string;
}

//Create Stripe Payment Intent
export class CreateStripePaymentIntentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Stripe payment intent created successfully' })
  message: string;

  @ApiProperty({ type: StripePaymentIntentResponseDto })
  data: StripePaymentIntentResponseDto;

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

//Confirm Stripe Payment
export class ConfirmStripePaymentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment confirmed' })
  message: string;

  @ApiProperty({ type: StripePaymentIntentResponseDto })
  data: StripePaymentIntentResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

//Get Payment Intent Status
export class GetPaymentIntentStatusApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment intent status retrieved' })
  message: string;

  @ApiProperty({ type: StripePaymentIntentResponseDto })
  data: StripePaymentIntentResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

//Test Confirm Payment
export class TestConfirmPaymentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment confirmed successfully (test mode)' })
  message: string;

  @ApiProperty({ type: StripePaymentIntentResponseDto })
  data: StripePaymentIntentResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

// Webhook event handler DTO
export class StripeWebhookEventDto {
  id: string;
  object: string;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
}
