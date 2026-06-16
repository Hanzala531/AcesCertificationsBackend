import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentTypeEnum {
  SELF_DISCLOSURE = 'self_disclosure',
  ASSURED = 'assured',
}

export enum PaymentStatusEnum {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// Payment Response DTO
export class PaymentResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique payment ID',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'User ID who made the payment',
    format: 'uuid',
  })
  user_id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Certificate ID for assessment',
    format: 'uuid',
  })
  certificate_id: string;

  @ApiProperty({
    enum: PaymentTypeEnum,
    example: PaymentTypeEnum.SELF_DISCLOSURE,
    description: 'Type of assessment payment',
  })
  payment_type: PaymentTypeEnum;

  @ApiProperty({
    example: 500.0,
    description: 'Payment amount (500 for self_disclosure, 5000 for assured)',
    type: 'number',
  })
  amount: number;

  @ApiProperty({
    example: 'USD',
    description: 'Currency code',
    default: 'USD',
  })
  currency: string;

  @ApiProperty({
    enum: PaymentStatusEnum,
    example: PaymentStatusEnum.PENDING,
    description: 'Current payment status',
  })
  status: PaymentStatusEnum;

  @ApiProperty({
    example: false,
    description: 'Whether payment has been completed',
  })
  is_paid: boolean;

  @ApiPropertyOptional({
    example: 'txn_1234567890',
    description: 'External transaction ID from payment gateway',
    nullable: true,
  })
  transaction_id: string | null;

  @ApiPropertyOptional({
    example: 'stripe',
    description: 'Payment method used (stripe, paypal, bank_transfer)',
    nullable: true,
  })
  payment_method: string | null;

  @ApiPropertyOptional({
    example: '2024-01-15T10:30:00.000Z',
    description: 'When payment was completed',
    format: 'date-time',
    nullable: true,
  })
  paid_at: string | null;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'When payment was created',
    format: 'date-time',
  })
  created_at: string;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'When payment was last updated',
    format: 'date-time',
  })
  updated_at: string;
}

// Payment with additional details (certificate name, user email)
export class PaymentWithDetailsResponseDto extends PaymentResponseDto {
  @ApiPropertyOptional({
    example: 'Safety Compliance Certificate',
    description: 'Name of the certificate',
  })
  certificate_name?: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'Email of the user',
  })
  user_email?: string;
}

// Payment initiate data
export class PaymentInitiateDataDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Payment ID',
    format: 'uuid',
  })
  payment_id: string;

  @ApiProperty({
    example: 500.0,
    description: 'Amount to pay',
    type: 'number',
  })
  amount: number;

  @ApiProperty({
    example: 'USD',
    description: 'Currency',
  })
  currency: string;

  @ApiProperty({
    enum: PaymentTypeEnum,
    example: PaymentTypeEnum.SELF_DISCLOSURE,
    description: 'Payment type',
  })
  payment_type: PaymentTypeEnum;

  @ApiProperty({
    enum: PaymentStatusEnum,
    example: PaymentStatusEnum.PENDING,
    description: 'Payment status',
  })
  status: PaymentStatusEnum;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Certificate ID',
    format: 'uuid',
  })
  certificate_id: string;
}

// Payment confirm data
export class PaymentConfirmDataDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Payment ID',
    format: 'uuid',
  })
  payment_id: string;

  @ApiProperty({
    enum: PaymentStatusEnum,
    example: PaymentStatusEnum.COMPLETED,
    description: 'Payment status',
  })
  status: PaymentStatusEnum;

  @ApiProperty({
    example: true,
    description: 'Payment completion flag',
  })
  is_paid: boolean;

  @ApiProperty({
    example: 'txn_1234567890',
    description: 'Transaction ID',
  })
  transaction_id: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'When payment was completed',
    format: 'date-time',
  })
  paid_at: string;
}

// Paginated payment list data
export class PaymentListDataDto {
  @ApiProperty({
    type: [PaymentWithDetailsResponseDto],
    description: 'Array of payments',
  })
  data: PaymentWithDetailsResponseDto[];

  @ApiProperty({
    example: 25,
    description: 'Total number of payments',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Items per page',
  })
  limit: number;
}

// ============ API Response Wrappers ============

export class InitiatePaymentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment initiated successfully' })
  message: string;

  @ApiProperty({ type: PaymentInitiateDataDto })
  data: PaymentInitiateDataDto;

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class GetPaymentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment retrieved successfully' })
  message: string;

  @ApiProperty({ type: PaymentWithDetailsResponseDto })
  data: PaymentWithDetailsResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class GetMyPaymentsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payments retrieved successfully' })
  message: string;

  @ApiProperty({ type: PaymentListDataDto })
  data: PaymentListDataDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class ConfirmPaymentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Payment confirmed successfully' })
  message: string;

  @ApiProperty({ type: PaymentConfirmDataDto })
  data: PaymentConfirmDataDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

// ============ Error Response DTOs ============
export class BadRequestErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: [
      'certificate_id must be a valid UUID',
      'payment_type must be either self_disclosure or assured',
    ],
    description: 'Array of validation error messages',
    type: [String],
  })
  message: string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}

export class NotFoundErrorDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Payment not found' })
  message: string;

  @ApiProperty({ example: 'Not Found' })
  error: string;
}

export class ForbiddenErrorDto {
  @ApiProperty({ example: 403 })
  statusCode: number;

  @ApiProperty({ example: 'Access denied to this payment' })
  message: string;

  @ApiProperty({ example: 'Forbidden' })
  error: string;
}

export class UnauthorizedErrorDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'Unauthorized' })
  message: string;
}
