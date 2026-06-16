import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// PaymentType
export enum PaymentType {
  SELF_DISCLOSURE = 'self_disclosure',
  ASSURED = 'assured',
}

// InitiatePaymentDto
export class InitiatePaymentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the certificate to pay for assessment',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'certificate_id must be a valid UUID' })
  @IsNotEmpty({ message: 'certificate_id is required' })
  certificate_id: string;

  @ApiProperty({
    enum: PaymentType,
    enumName: 'PaymentType',
    example: PaymentType.SELF_DISCLOSURE,
    description:
      'Type of assessment payment. self_disclosure costs $500, assured costs $5000',
  })
  @IsEnum(PaymentType, {
    message: 'payment_type must be either self_disclosure or assured',
  })
  @IsNotEmpty({ message: 'payment_type is required' })
  payment_type: PaymentType;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'ISO 4217 currency code for payment',
    default: 'USD',
    maxLength: 10,
  })
  @IsOptional()
  @IsString({ message: 'currency must be a string' })
  @MaxLength(10, { message: 'currency must not exceed 10 characters' })
  currency?: string;
}

// ConfirmPaymentDto
export class ConfirmPaymentDto {
  @ApiProperty({
    example: 'txn_1234567890abcdef',
    description:
      'External transaction ID from payment gateway (e.g., Stripe, PayPal)',
    maxLength: 255,
  })
  @IsString({ message: 'transaction_id must be a string' })
  @IsNotEmpty({ message: 'transaction_id is required' })
  @MaxLength(255, { message: 'transaction_id must not exceed 255 characters' })
  transaction_id: string;

  @ApiPropertyOptional({
    example: 'stripe',
    description:
      'Payment method/gateway used (e.g., stripe, paypal, bank_transfer)',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'payment_method must be a string' })
  @MaxLength(50, { message: 'payment_method must not exceed 50 characters' })
  payment_method?: string;
}
