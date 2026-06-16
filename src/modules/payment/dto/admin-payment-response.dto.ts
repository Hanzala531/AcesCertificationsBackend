import { ApiProperty } from '@nestjs/swagger';

export class PaymentMetricsDto {
  @ApiProperty({
    example: 39400.0,
    description: 'Total revenue from all successful payments (lifetime)',
  })
  totalRevenue: number;

  @ApiProperty({
    example: 39400.0,
    description: 'Total revenue from successful payments in current month',
  })
  monthlyRevenue: number;

  @ApiProperty({ example: 3, description: 'Count of pending payments' })
  pendingPaymentsCount: number;

  @ApiProperty({
    example: 8500.0,
    description: 'Total amount of pending payments',
  })
  pendingPaymentsAmount: number;

  @ApiProperty({ example: 2, description: 'Count of failed payments' })
  failedPaymentsCount: number;

  @ApiProperty({
    example: 4500.0,
    description: 'Total amount of failed payments',
  })
  failedPaymentsAmount: number;
}

export class GetPaymentMetricsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: PaymentMetricsDto })
  data: PaymentMetricsDto;
}

export class AdminPaymentRecordDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  paymentId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  organizationId: string;

  @ApiProperty({ example: 'Acme Corporation' })
  organizationName: string;

  @ApiProperty({
    example: 'ISO 9001',
    description: 'Certificate name or assessment type',
  })
  assessmentOrCertificationType: string;

  @ApiProperty({
    example: 'ISO-9001-2024',
    description: 'Certificate product ID',
    nullable: true,
  })
  certificateProductId: string | null;

  @ApiProperty({ example: 4500.0 })
  amount: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({
    example: 'completed',
    enum: [
      'pending',
      'completed',
      'failed',
      'refunded',
      'disputed',
      'partially_refunded',
    ],
  })
  status: string;

  @ApiProperty({ example: 'Card', nullable: true })
  paymentMethod: string | null;

  @ApiProperty({ example: '2024-12-20T10:00:00.000Z' })
  createdAt: Date;
}

export class AdminPaymentListResponse {
  @ApiProperty({ type: [AdminPaymentRecordDto] })
  data: AdminPaymentRecordDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class GetAdminPaymentListApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AdminPaymentListResponse })
  data: AdminPaymentListResponse;
}

export class AdminPaymentDetailsDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  paymentId: string;

  @ApiProperty({ example: 'TXN-001-2024' })
  transactionId: string | null;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  organizationId: string;

  @ApiProperty({ example: 'Acme Corporation' })
  organizationName: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174002' })
  certificateId: string;

  @ApiProperty({ example: 'ISO 9001' })
  certificateName: string;

  @ApiProperty({
    example: 'self_disclosure',
    enum: ['self_disclosure', 'assured'],
  })
  paymentType: string;

  @ApiProperty({ example: 'ISO 9001 - Assessment Fee' })
  assessmentOrCertificationType: string;

  @ApiProperty({ example: 4500.0 })
  amount: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({
    example: 'completed',
    enum: [
      'pending',
      'completed',
      'failed',
      'refunded',
      'disputed',
      'partially_refunded',
    ],
  })
  status: string;

  @ApiProperty({ example: 'Credit/Debit Card', nullable: true })
  paymentMethod: string | null;

  @ApiProperty({
    example: 'pi_1234567890',
    nullable: true,
    description: 'Stripe Payment Intent ID',
  })
  stripePaymentIntentId: string | null;

  @ApiProperty({
    example: 'cus_1234567890',
    nullable: true,
    description: 'Stripe Customer ID',
  })
  stripeCustomerId: string | null;

  @ApiProperty({
    example: 'Payment was successful',
    nullable: true,
    description: 'Failure reason if status is failed',
  })
  failureReason: string | null;

  @ApiProperty({ example: '2024-12-20T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-12-20T10:05:00.000Z', nullable: true })
  paidAt: Date | null;

  @ApiProperty({ example: '2024-12-20T10:05:00.000Z' })
  updatedAt: Date;
}

export class GetAdminPaymentDetailsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AdminPaymentDetailsDto })
  data: AdminPaymentDetailsDto;
}

export class AdminPaymentErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Payment not found' })
  message: string;
}
