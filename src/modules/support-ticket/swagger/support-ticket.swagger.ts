import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CreateSupportTicketDto } from '../dto/create-support-ticket.dto';

const TICKET_EXAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: '660e8400-e29b-41d4-a716-446655440001',
  subject: 'Certificate renewal issue',
  category: 'renewal',
  certificate_id: '770e8400-e29b-41d4-a716-446655440002',
  description: 'I need help with my certificate renewal process.',
  supporting_document: 'https://example.com/document.pdf',
  status: 'pending',
  ticket_type: 'support',
  target_type: 'certificate',
  target_id: '770e8400-e29b-41d4-a716-446655440002',
  metadata: {},
  resolved_by: null,
  resolved_at: null,
  certificate_name: 'ISO 27001',
  product_id: 'CERT-001',
  created_at: '2026-01-15T12:00:00.000Z',
  updated_at: '2026-01-15T12:00:00.000Z',
};

export function SwaggerCreateTicket() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a support ticket' }),
    ApiBody({
      type: CreateSupportTicketDto,
      description:
        'Create ticket payload. Use the examples dropdown to switch between ticket-type payloads.',
      examples: {
        certificateSupport: {
          summary: 'Certificate Support Ticket',
          description:
            'General certificate support issue (legacy/default flow).',
          value: {
            subject: 'Certificate renewal issue',
            category: 'renewal',
            certificate_id: '770e8400-e29b-41d4-a716-446655440002',
            description: 'I need help with my certificate renewal process.',
            supporting_document: 'https://example.com/document.pdf',
            ticket_type: 'support',
            target_type: 'certificate',
            target_id: '770e8400-e29b-41d4-a716-446655440002',
            metadata: {},
          },
        },
        assessmentDispute: {
          summary: 'Assessment Dispute Ticket',
          description:
            'Dispute flow linked to an assessment (for manual reviewer/admin investigation).',
          value: {
            subject: 'Assessment score dispute',
            category: 'assessment-review',
            description:
              'I disagree with the final assessment outcome and request manual review.',
            supporting_document: 'https://example.com/dispute-evidence.zip',
            ticket_type: 'dispute',
            target_type: 'assessment',
            target_id: '880e8400-e29b-41d4-a716-446655440003',
            metadata: {
              assessment_id: '880e8400-e29b-41d4-a716-446655440003',
              ai_review_id: '990e8400-e29b-41d4-a716-446655440004',
              source: 'notification',
            },
          },
        },
        billingIssue: {
          summary: 'Billing Ticket',
          description: 'Payment/billing related issue.',
          value: {
            subject: 'Payment charged twice',
            category: 'payment',
            description:
              'I was charged twice for the same certificate payment.',
            supporting_document: 'https://example.com/invoice-screenshot.png',
            ticket_type: 'billing',
            target_type: 'payment',
            target_id: 'a10e8400-e29b-41d4-a716-446655440005',
            metadata: {
              payment_reference: 'PAY-2026-0001',
            },
          },
        },
        genericOther: {
          summary: 'Generic / Other Ticket',
          description:
            'No strict target entity. Use target_type=other with metadata context.',
          value: {
            subject: 'General platform question',
            category: 'general',
            description:
              'I need help understanding where to find previous submissions.',
            supporting_document: 'https://example.com/account-issue-notes.txt',
            ticket_type: 'other',
            target_type: 'other',
            metadata: {
              context: 'dashboard-help',
            },
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Ticket created successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: 'Support ticket created successfully',
          },
          data: {
            type: 'object',
            example: TICKET_EXAMPLE,
          },
          statusCode: { type: 'number', example: 201 },
          timestamp: { type: 'string', example: '2026-01-15T12:00:00.000Z' },
        },
      },
    }),
    ApiBadRequestResponse({ description: 'Validation error' }),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiNotFoundResponse({
      description: 'Target entity or certificate not found',
    }),
  );
}

export function SwaggerGetTickets() {
  return applyDecorators(
    ApiOperation({ summary: 'List support tickets with optional filters' }),
    ApiOkResponse({
      description: 'Tickets retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: 'Support tickets retrieved successfully',
          },
          data: {
            type: 'array',
            items: { type: 'object', example: TICKET_EXAMPLE },
          },
          total: { type: 'number', example: 1 },
          page: { type: 'number', example: 1 },
          limit: { type: 'number', example: 10 },
          statusCode: { type: 'number', example: 200 },
          timestamp: { type: 'string', example: '2026-01-15T12:00:00.000Z' },
        },
      },
    }),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}

export function SwaggerGetTicketById() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a support ticket by ID' }),
    ApiOkResponse({
      description: 'Ticket retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: 'Support ticket retrieved successfully',
          },
          data: { type: 'object', example: TICKET_EXAMPLE },
          statusCode: { type: 'number', example: 200 },
          timestamp: { type: 'string', example: '2026-01-15T12:00:00.000Z' },
        },
      },
    }),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiNotFoundResponse({ description: 'Support ticket not found' }),
  );
}

export function SwaggerUpdateTicketStatus() {
  return applyDecorators(
    ApiOperation({ summary: 'Update support ticket status' }),
    ApiOkResponse({
      description: 'Ticket status updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: 'Ticket status updated successfully',
          },
          data: {
            type: 'object',
            example: { ...TICKET_EXAMPLE, status: 'in-progress' },
          },
          statusCode: { type: 'number', example: 200 },
          timestamp: { type: 'string', example: '2026-01-15T12:00:00.000Z' },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid status or already in that status',
    }),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiNotFoundResponse({ description: 'Support ticket not found' }),
  );
}

export function SwaggerDeleteTicket() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a support ticket' }),
    ApiOkResponse({
      description: 'Ticket deleted successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: 'Support ticket deleted successfully',
          },
          statusCode: { type: 'number', example: 200 },
          timestamp: { type: 'string', example: '2026-01-15T12:00:00.000Z' },
        },
      },
    }),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiNotFoundResponse({ description: 'Support ticket not found' }),
  );
}
