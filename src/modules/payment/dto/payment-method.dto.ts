import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Payment Method Response DTO
export class PaymentMethodResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique payment method ID',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Organization ID that owns this payment method',
    format: 'uuid',
  })
  organization_id: string;

  @ApiProperty({
    example: 'pm_1234567890abcdef',
    description: 'Stripe payment method ID',
  })
  stripe_payment_method_id: string;

  @ApiPropertyOptional({
    example: 'cus_1234567890abcdef',
    description: 'Stripe customer ID',
    nullable: true,
  })
  stripe_customer_id: string | null;

  @ApiProperty({
    example: 'card',
    description: 'Payment method type (card, bank_account, etc.)',
  })
  type: string;

  @ApiPropertyOptional({
    example: 'visa',
    description: 'Card brand (visa, mastercard, amex, etc.)',
    nullable: true,
  })
  card_brand: string | null;

  @ApiPropertyOptional({
    example: '4242',
    description: 'Last 4 digits of the card',
    nullable: true,
  })
  card_last4: string | null;

  @ApiPropertyOptional({
    example: 12,
    description: 'Card expiration month',
    nullable: true,
  })
  card_exp_month: number | null;

  @ApiPropertyOptional({
    example: 2025,
    description: 'Card expiration year',
    nullable: true,
  })
  card_exp_year: number | null;

  @ApiProperty({
    example: false,
    description: 'Whether this is the default payment method',
    default: false,
  })
  is_default: boolean;

  @ApiPropertyOptional({
    example: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      address: {
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US',
      },
    },
    description: 'Billing details',
    nullable: true,
  })
  billing_details: Record<string, any> | null;

  @ApiPropertyOptional({
    example: {},
    description: 'Additional metadata',
    nullable: true,
  })
  metadata: Record<string, any> | null;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'When payment method was created',
    format: 'date-time',
  })
  created_at: string;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'When payment method was last updated',
    format: 'date-time',
  })
  updated_at: string;
}

// Payment Method Request DTO
export class CreatePaymentMethodDto {
  @ApiProperty({
    example: 'pm_1234567890abcdef',
    description: 'Stripe payment method ID',
  })
  @IsNotEmpty()
  @IsString()
  stripe_payment_method_id: string;

  @ApiPropertyOptional({
    example: 'cus_1234567890abcdef',
    description:
      'Stripe customer ID (optional, will be retrieved if not provided)',
  })
  @IsOptional()
  @IsString()
  stripe_customer_id?: string;

  @ApiProperty({
    example: 'card',
    description: 'Payment method type (card, bank_account, etc.)',
  })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiPropertyOptional({
    example: 'visa',
    description: 'Card brand (visa, mastercard, amex, etc.)',
  })
  @IsOptional()
  @IsString()
  card_brand?: string;

  @ApiPropertyOptional({
    example: '4242',
    description: 'Last 4 digits of the card',
  })
  @IsOptional()
  @IsString()
  card_last4?: string;

  @ApiPropertyOptional({
    example: 12,
    description: 'Card expiration month',
  })
  @IsOptional()
  @IsNumber()
  card_exp_month?: number;

  @ApiPropertyOptional({
    example: 2025,
    description: 'Card expiration year',
  })
  @IsOptional()
  @IsNumber()
  card_exp_year?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this should be set as the default payment method',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({
    example: {},
    description: 'Additional metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Create Payment Method
export class CreatePaymentMethodApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment method added successfully' })
  message: string;

  @ApiProperty({ type: PaymentMethodResponseDto })
  data: PaymentMethodResponseDto;

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

// Get Payment Methods
export class GetPaymentMethodsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment methods retrieved successfully' })
  message: string;

  @ApiProperty({
    type: [PaymentMethodResponseDto],
    description: 'Array of payment methods',
  })
  data: PaymentMethodResponseDto[];

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}
