import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  GetPaymentMetricsApiResponse,
  GetAdminPaymentListApiResponse,
  GetAdminPaymentDetailsApiResponse,
  AdminPaymentErrorDto,
} from '../dto/admin-payment-response.dto';

export function SwaggerGetAdminPaymentMetrics() {
  return applyDecorators(
    ApiExtraModels(GetPaymentMetricsApiResponse),
    ApiOperation({
      summary: 'Get payment metrics for admin dashboard',
      description: `
Returns aggregated payment statistics for the admin dashboard.

**Metrics included:**
- Total revenue (lifetime successful payments)
- Monthly revenue (current month successful payments)
- Pending payments (count and total amount)
- Failed payments (count and total amount)

**Required Role**: \`admin\`
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment metrics retrieved successfully',
      type: GetPaymentMetricsApiResponse,
    }),
  );
}

export function SwaggerGetAdminPayments() {
  return applyDecorators(
    ApiExtraModels(GetAdminPaymentListApiResponse),
    ApiOperation({
      summary: 'Get paginated list of all payments (admin)',
      description: `
Returns a paginated list of all payments with organization and certificate details.

**Query Parameters:**
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 10)
- \`status\`: Filter by payment status (pending, completed, failed, refunded, disputed, partially_refunded)
- \`organizationId\`: Filter by organization UUID
- \`startDate\`: Filter payments from this date (ISO 8601)
- \`endDate\`: Filter payments until this date (ISO 8601)
- \`sortBy\`: Sort by 'date' or 'amount' (default: 'date')
- \`sortOrder\`: Sort order 'asc' or 'desc' (default: 'desc')

**Required Role**: \`admin\`
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
      description: 'Items per page (default: 10)',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      type: String,
      enum: [
        'pending',
        'completed',
        'failed',
        'refunded',
        'disputed',
        'partially_refunded',
      ],
      description: 'Filter by payment status',
    }),
    ApiQuery({
      name: 'organizationId',
      required: false,
      type: String,
      description:
        'Filter by organization UUID (optional - leave empty to get payments from all organizations)',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'startDate',
      required: false,
      type: String,
      description: 'Filter payments from this date (ISO 8601 format)',
      example: '2024-01-01T00:00:00.000Z',
    }),
    ApiQuery({
      name: 'endDate',
      required: false,
      type: String,
      description: 'Filter payments until this date (ISO 8601 format)',
      example: '2024-12-31T23:59:59.999Z',
    }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      enum: ['date', 'amount'],
      description: 'Sort by date or amount (default: date)',
    }),
    ApiQuery({
      name: 'sortOrder',
      required: false,
      type: String,
      enum: ['asc', 'desc'],
      description: 'Sort order (default: desc)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payments retrieved successfully',
      type: GetAdminPaymentListApiResponse,
    }),
  );
}

export function SwaggerGetAdminPaymentDetails() {
  return applyDecorators(
    ApiExtraModels(GetAdminPaymentDetailsApiResponse, AdminPaymentErrorDto),
    ApiOperation({
      summary: 'Get detailed payment information (admin)',
      description: `
Returns complete payment details including organization, certificate, payment method, and provider-specific information.

**Required Role**: \`admin\`
      `,
    }),
    ApiParam({
      name: 'paymentId',
      description: 'Payment UUID',
      type: 'string',
      format: 'uuid',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment details retrieved successfully',
      type: GetAdminPaymentDetailsApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Payment not found',
      type: AdminPaymentErrorDto,
    }),
  );
}
