import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CreateChatThreadDto,
  CreateAuditorReviewerThreadDto,
  SendMessageDto,
  AddParticipantDto,
} from '../dto/chat.dto';

// ── Shared schemas ──────────────────────────────────────────────────────────

const errorResponseSchema = (statusCode: number, message: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-27T12:00:00.000Z' },
    path: { type: 'string', example: '/api/chat' },
  },
});

const threadDataSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    assessmentId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000', nullable: true },
    supportTicketId: { type: 'string', format: 'uuid', nullable: true, example: null },
    questionId: { type: 'string', format: 'uuid', nullable: true, example: null },
    threadType: {
      type: 'string',
      enum: ['auditor_applicant', 'auditor_reviewer', 'reviewer_applicant', 'support_ticket'],
      example: 'auditor_applicant',
    },
    status: { type: 'string', enum: ['active', 'locked', 'archived'], example: 'active' },
    certificateName: { type: 'string', example: 'ISO 27001:2022', nullable: true },
    organizationName: { type: 'string', example: 'ACME Corp', nullable: true },
    supportTicketSubject: { type: 'string', nullable: true, example: null },
    supportTicketCategory: { type: 'string', nullable: true, example: null },
    questionText: { type: 'string', nullable: true, example: null },
    assessmentType: { type: 'string', example: 'assured', nullable: true },
    participantCount: { type: 'number', example: 3 },
    unreadCount: { type: 'number', example: 0 },
    createdAt: { type: 'string', format: 'date-time', example: '2026-03-27T10:00:00.000Z' },
    updatedAt: { type: 'string', format: 'date-time', example: '2026-03-27T10:00:00.000Z' },
    lockedAt: { type: 'string', format: 'date-time', nullable: true, example: null },
    lockedReason: { type: 'string', nullable: true, example: null },
  },
};

const messageDataSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: 'f1e2d3c4-b5a6-7890-abcd-ef1234567890' },
    threadId: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    senderId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    senderName: { type: 'string', example: 'John Doe' },
    senderRole: { type: 'string', enum: ['applicant', 'auditor', 'reviewer', 'admin'], example: 'auditor' },
    content: { type: 'string', example: 'Hello, I have a question about the assessment.' },
    isSystemMessage: { type: 'boolean', example: false },
    createdAt: { type: 'string', format: 'date-time', example: '2026-03-27T10:05:00.000Z' },
  },
};

const participantDataSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
    userId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    firstName: { type: 'string', example: 'John' },
    lastName: { type: 'string', example: 'Doe' },
    role: { type: 'string', enum: ['applicant', 'auditor', 'reviewer', 'admin'], example: 'auditor' },
    joinedAt: { type: 'string', format: 'date-time', example: '2026-03-27T10:00:00.000Z' },
    lastReadAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-03-27T10:05:00.000Z' },
  },
};

// ── Thread endpoints ────────────────────────────────────────────────────────

export const SwaggerCreateThread = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create or get chat thread for assessment',
      description: `
Creates a new \`auditor_applicant\` chat thread for the assessment, or returns the existing one.

**Access:** admin, subadmin, organization, organization_member, auditor, reviewer.

**Rules:**
- Only active assessments can have chat threads (exception: \`assured\` assessments that are completed).
- If a thread already exists for the assessment, the caller is added as a participant and the existing thread is returned.
      `,
    }),
    ApiBody({ type: CreateChatThreadDto }),
    ApiCreatedResponse({
      description: 'Chat thread created or retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Chat thread created successfully' },
          data: threadDataSchema,
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Assessment is completed or expired',
      schema: errorResponseSchema(400, 'Cannot create chat for completed or expired assessment'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User does not have access to this assessment',
      schema: errorResponseSchema(403, 'You do not have access to this assessment'),
    }),
  );

export const SwaggerCreateAuditorReviewerThread = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create or get auditor-reviewer chat thread for an assessment',
      description: `
Creates a general auditor-reviewer chat thread for an assessment, or returns the existing one if already created.
This is used for direct communication between the assigned auditor and reviewer on an assessment —
including discussions about AI flags, assessment questions, or flagged assessments.

**Who can call this:**
- **Reviewer** — must be the assigned reviewer for the assessment
- **Auditor** — must be the assigned auditor for the assessment

**Prerequisites:**
- Both an auditor and a reviewer must be assigned to the assessment.

**Note:** This creates an assessment-level thread (not per-question).
Per-question threads are created automatically via the compliance action API.
      `,
    }),
    ApiBody({ type: CreateAuditorReviewerThreadDto }),
    ApiOkResponse({
      description: 'Auditor-reviewer chat thread created or retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Auditor-reviewer chat thread created successfully' },
          data: {
            ...threadDataSchema,
            properties: {
              ...threadDataSchema.properties,
              threadType: { type: 'string', example: 'auditor_reviewer' },
              participantCount: { type: 'number', example: 2 },
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'No auditor or reviewer assigned to this assessment',
      schema: errorResponseSchema(400, 'No auditor assigned to this assessment'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User is not the assigned auditor or reviewer for this assessment',
      schema: errorResponseSchema(403, 'You are not the assigned reviewer for this assessment'),
    }),
    ApiNotFoundResponse({
      description: 'Assessment not found',
      schema: errorResponseSchema(404, 'Assessment not found'),
    }),
  );

export const SwaggerGetThread = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get chat thread details',
      description: `
Retrieves chat thread details including assessment info, participant count, and unread count.

**Access:** Only participants can access. Admins and subadmins can access any thread.
      `,
    }),
    ApiParam({ name: 'threadId', type: 'string', format: 'uuid', description: 'The chat thread ID' }),
    ApiOkResponse({
      description: 'Chat thread retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: threadDataSchema,
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User is not a participant in this thread',
      schema: errorResponseSchema(403, 'You are not a participant in this chat'),
    }),
    ApiNotFoundResponse({
      description: 'Chat thread not found',
      schema: errorResponseSchema(404, 'Chat thread not found'),
    }),
  );

export const SwaggerGetThreadByAssessment = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get chat thread for assessment',
      description: `
Retrieves the chat thread for a specific assessment.
Returns \`data: null\` if no thread exists yet.

**Access:** Only participants can access. Admins and subadmins can access any thread.
      `,
    }),
    ApiParam({ name: 'assessmentId', type: 'string', format: 'uuid', description: 'The assessment ID' }),
    ApiOkResponse({
      description: 'Chat thread retrieved successfully (or null if none exists)',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { ...threadDataSchema, nullable: true },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User is not a participant in this thread',
      schema: errorResponseSchema(403, 'You are not a participant in this chat'),
    }),
  );

export const SwaggerGetThreadBySupportTicket = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get chat thread for support ticket',
      description: `
Retrieves the chat thread for a specific support ticket.
Returns \`data: null\` if no thread exists yet.

**Access:** Only participants can access. Admins and subadmins are auto-added as participants when they view the thread.
      `,
    }),
    ApiParam({ name: 'supportTicketId', type: 'string', format: 'uuid', description: 'The support ticket ID' }),
    ApiOkResponse({
      description: 'Chat thread retrieved successfully (or null if none exists)',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            ...threadDataSchema,
            nullable: true,
            properties: {
              ...threadDataSchema.properties,
              threadType: { type: 'string', example: 'support_ticket' },
              supportTicketSubject: { type: 'string', example: 'Issue with document upload' },
              supportTicketCategory: { type: 'string', example: 'technical' },
              assessmentId: { type: 'string', nullable: true, example: null },
            },
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User is not a participant in this thread',
      schema: errorResponseSchema(403, 'You are not a participant in this chat'),
    }),
  );

export const SwaggerGetUserThreads = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get all chat threads for current user',
      description: `
Retrieves all chat threads where the current user is a participant.
Includes assessment details, unread counts, and last message info for each thread.

**Access:** admin, subadmin, organization, organization_member, auditor, reviewer.
      `,
    }),
    ApiOkResponse({
      description: 'Chat threads retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: threadDataSchema,
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

// ── Message endpoints ───────────────────────────────────────────────────────

export const SwaggerSendMessage = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Send message to chat thread',
      description: `
Sends a new message to the chat thread. The message is also broadcast via WebSocket to all thread participants in real time.

**Rules:**
- Thread must be active (not locked).
- Only participants can send messages.
- Admins are auto-added as participants when they send a message.
- Maximum message length: 5000 characters.
      `,
    }),
    ApiParam({ name: 'threadId', type: 'string', format: 'uuid', description: 'The chat thread ID' }),
    ApiBody({ type: SendMessageDto }),
    ApiCreatedResponse({
      description: 'Message sent successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Message sent successfully' },
          data: messageDataSchema,
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Chat thread is locked',
      schema: errorResponseSchema(400, 'Cannot send messages to a locked chat'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User is not a participant in this thread',
      schema: errorResponseSchema(403, 'You are not a participant in this chat'),
    }),
    ApiNotFoundResponse({
      description: 'Chat thread not found',
      schema: errorResponseSchema(404, 'Chat thread not found'),
    }),
  );

export const SwaggerGetMessages = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get messages from chat thread',
      description: `
Retrieves paginated messages from the chat thread. Automatically updates the caller's \`lastReadAt\` timestamp.

**Pagination:** Use \`page\` and \`limit\` for offset-based pagination, or \`before\`/\`after\` ISO date strings for cursor-based filtering.

**Access:** Only participants can view messages. Admins and subadmins can view any thread.
      `,
    }),
    ApiParam({ name: 'threadId', type: 'string', format: 'uuid', description: 'The chat thread ID' }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (default: 1)' }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 50, description: 'Messages per page (default: 50, max: 100)' }),
    ApiQuery({ name: 'before', required: false, type: String, description: 'ISO date string — only return messages before this timestamp', example: '2026-03-27T10:00:00.000Z' }),
    ApiQuery({ name: 'after', required: false, type: String, description: 'ISO date string — only return messages after this timestamp', example: '2026-03-26T00:00:00.000Z' }),
    ApiOkResponse({
      description: 'Messages retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              messages: { type: 'array', items: messageDataSchema },
              total: { type: 'number', example: 42 },
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 50 },
              totalPages: { type: 'number', example: 1 },
              hasMore: { type: 'boolean', example: false },
            },
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User is not a participant in this thread',
      schema: errorResponseSchema(403, 'You are not a participant in this chat'),
    }),
  );

// ── Participant endpoints ───────────────────────────────────────────────────

export const SwaggerGetParticipants = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get chat thread participants',
      description: `
Retrieves all participants in the chat thread with their user details, roles, and read timestamps.

**Access:** Only participants can view. Admins and subadmins can view any thread.
      `,
    }),
    ApiParam({ name: 'threadId', type: 'string', format: 'uuid', description: 'The chat thread ID' }),
    ApiOkResponse({
      description: 'Participants retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: participantDataSchema },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User is not a participant in this thread',
      schema: errorResponseSchema(403, 'You are not a participant in this chat'),
    }),
  );

export const SwaggerAddParticipant = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Add participant to chat thread',
      description: `
Adds a new participant to the chat thread.

**Access:** Only existing participants can add others. Admins and subadmins can add to any thread.

**Rules:**
- Thread must be active (not locked).
- If the user is already a participant, their role is updated.
      `,
    }),
    ApiParam({ name: 'threadId', type: 'string', format: 'uuid', description: 'The chat thread ID' }),
    ApiBody({ type: AddParticipantDto }),
    ApiOkResponse({
      description: 'Participant added successfully — returns updated participant list',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Participant added successfully' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
                userId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                firstName: { type: 'string', example: 'John' },
                lastName: { type: 'string', example: 'Doe' },
                role: { type: 'string', enum: ['applicant', 'auditor', 'reviewer', 'admin'], example: 'reviewer' },
                joinedAt: { type: 'string', format: 'date-time', example: '2026-03-27T10:00:00.000Z' },
              },
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Chat thread is locked',
      schema: errorResponseSchema(400, 'Cannot add participants to a locked chat'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'User is not a participant in this thread',
      schema: errorResponseSchema(403, 'You are not a participant in this chat'),
    }),
    ApiNotFoundResponse({
      description: 'Chat thread not found',
      schema: errorResponseSchema(404, 'Chat thread not found'),
    }),
  );

export const SwaggerAddApplicantToThread = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Add applicant(s) to chat thread',
      description: `
Adds the assessment's organization users (applicants) to an existing chat thread.
This is used when a reviewer wants to bring the applicant into a clarification thread
that was initially created between auditor and reviewer.

**Access:** reviewer (must be a participant), admin, subadmin.

**Rules:**
- Thread must be active (not locked).
- Thread must be linked to an assessment.
- All organization users from the assessment's organization/branch are added as applicants.
      `,
    }),
    ApiParam({ name: 'threadId', type: 'string', format: 'uuid', description: 'The chat thread ID' }),
    ApiOkResponse({
      description: 'Applicant(s) added to thread successfully — returns updated participant list',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Applicant(s) added to thread successfully' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
                userId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                firstName: { type: 'string', example: 'Jane' },
                lastName: { type: 'string', example: 'Smith' },
                role: { type: 'string', example: 'applicant' },
                joinedAt: { type: 'string', format: 'date-time', example: '2026-03-27T10:00:00.000Z' },
              },
            },
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Chat is locked or thread not linked to assessment',
      schema: errorResponseSchema(400, 'Cannot add participants to a locked chat'),
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiForbiddenResponse({
      description: 'Only reviewers or admins can add applicants',
      schema: errorResponseSchema(403, 'Only reviewers or admins can add applicants to a thread'),
    }),
    ApiNotFoundResponse({
      description: 'Thread or assessment not found',
      schema: errorResponseSchema(404, 'Chat thread not found'),
    }),
  );

// ── Admin endpoints ─────────────────────────────────────────────────────────

export const SwaggerGetAssessmentThreadsAdmin = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get all chat threads for an assessment (Admin only)',
      description: `
Returns all chat threads for a given assessment grouped under the certificate name.

**Thread types:**
- \`auditor_applicant\` — Auditor & Applicant chat
- \`auditor_reviewer\` — Auditor & Reviewer chat (created for direct communication or via compliance action)
- \`reviewer_applicant\` — Reviewer & Applicant chat
- \`support_ticket\` — Support ticket chat thread

Use \`GET /chat/threads/:threadId/messages\` to view full message history for any thread (admin has access).

**Access:** admin, subadmin only.
      `,
    }),
    ApiParam({ name: 'assessmentId', type: 'string', format: 'uuid', description: 'The assessment ID' }),
    ApiOkResponse({
      description: 'Assessment threads retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              assessmentId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
              certificateName: { type: 'string', example: 'ISO 9001:2015' },
              organizationName: { type: 'string', example: 'ACME Corp' },
              assessmentType: { type: 'string', example: 'assured' },
              threads: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    threadId: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
                    questionId: { type: 'string', format: 'uuid', nullable: true, example: null },
                    threadType: {
                      type: 'string',
                      enum: ['auditor_applicant', 'auditor_reviewer', 'reviewer_applicant', 'support_ticket'],
                      example: 'auditor_reviewer',
                    },
                    status: { type: 'string', enum: ['active', 'locked', 'archived'], example: 'active' },
                    participantCount: { type: 'number', example: 3 },
                    messageCount: { type: 'number', example: 12 },
                    lastMessagePreview: { type: 'string', nullable: true, example: 'Please provide the updated documentation.' },
                    createdAt: { type: 'string', format: 'date-time', example: '2026-03-27T10:00:00.000Z' },
                    updatedAt: { type: 'string', format: 'date-time', example: '2026-03-27T12:30:00.000Z' },
                    lockedAt: { type: 'string', format: 'date-time', nullable: true, example: null },
                    lockedReason: { type: 'string', nullable: true, example: null },
                  },
                },
              },
            },
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Assessment not found',
      schema: errorResponseSchema(404, 'Assessment not found'),
    }),
  );

export const SwaggerGetAllAssessmentThreadsAdmin = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get all assessment threads grouped by assessment (Admin only)',
      description: `
Returns all chat threads across all assessments, grouped by assessment.
Paginated by number of assessments. Each assessment group includes certificate name,
organization name, and all its threads with message counts.

**Access:** admin, subadmin only.
      `,
    }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (default: 1)' }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Assessments per page (default: 20)' }),
    ApiOkResponse({
      description: 'Assessment threads retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              assessments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    assessmentId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                    certificateName: { type: 'string', example: 'ISO 9001:2015' },
                    organizationName: { type: 'string', example: 'ACME Corp' },
                    assessmentType: { type: 'string', example: 'assured' },
                    threads: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          threadId: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
                          questionId: { type: 'string', format: 'uuid', nullable: true, example: null },
                          threadType: {
                            type: 'string',
                            enum: ['auditor_applicant', 'auditor_reviewer', 'reviewer_applicant', 'support_ticket'],
                            example: 'auditor_applicant',
                          },
                          status: { type: 'string', enum: ['active', 'locked', 'archived'], example: 'active' },
                          participantCount: { type: 'number', example: 3 },
                          messageCount: { type: 'number', example: 12 },
                          lastMessagePreview: { type: 'string', nullable: true, example: 'Thank you for the clarification.' },
                          createdAt: { type: 'string', format: 'date-time', example: '2026-03-27T10:00:00.000Z' },
                          updatedAt: { type: 'string', format: 'date-time', example: '2026-03-27T12:30:00.000Z' },
                          lockedAt: { type: 'string', format: 'date-time', nullable: true, example: null },
                          lockedReason: { type: 'string', nullable: true, example: null },
                        },
                      },
                    },
                  },
                },
              },
              total: { type: 'number', example: 15 },
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 20 },
              totalPages: { type: 'number', example: 1 },
            },
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
  );

// ── Thread management endpoints ─────────────────────────────────────────────

export const SwaggerLockThread = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Lock chat thread (Admin only)',
      description: `
Locks the chat thread, preventing new messages and new participants.
A system message is posted to the thread indicating the lock.
Typically done when a certificate is issued or an assessment is finalized.

**Access:** admin, subadmin only.
      `,
    }),
    ApiParam({ name: 'threadId', type: 'string', format: 'uuid', description: 'The chat thread ID' }),
    ApiOkResponse({
      description: 'Thread locked successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Chat thread locked successfully' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
              status: { type: 'string', example: 'locked' },
              lockedAt: { type: 'string', format: 'date-time', example: '2026-03-27T14:00:00.000Z' },
              lockedReason: { type: 'string', example: 'Certificate issued', nullable: true },
            },
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid or missing JWT token',
      schema: errorResponseSchema(401, 'Unauthorized'),
    }),
    ApiNotFoundResponse({
      description: 'Chat thread not found',
      schema: errorResponseSchema(404, 'Chat thread not found'),
    }),
  );

export const SwaggerGetWebSocketStatus = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get WebSocket status for chat',
      description: `
Returns the WebSocket availability status for the chat module.

**Note:** In serverless environments (Vercel, AWS Lambda), WebSocket connections are not supported.
Use REST APIs for messaging in those environments.

**WebSocket Namespace:** \`/chat\`

**Events:**
- \`join_thread\` — Join a chat thread room
- \`leave_thread\` — Leave a chat thread room
- \`send_message\` — Send a message via WebSocket
- \`typing\` — Broadcast typing indicator
- \`mark_read\` — Mark messages as read
      `,
    }),
    ApiOkResponse({
      description: 'WebSocket status retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              websocketSupported: { type: 'boolean', example: true },
              realtimeEnabled: { type: 'boolean', example: true },
              message: { type: 'string', example: 'WebSocket connections are available. Connect to /chat namespace for real-time messaging.' },
              namespace: { type: 'string', example: '/chat' },
              events: {
                type: 'object',
                properties: {
                  join_thread: { type: 'string', example: 'Join a chat thread room' },
                  leave_thread: { type: 'string', example: 'Leave a chat thread room' },
                  send_message: { type: 'string', example: 'Send a message (via WebSocket)' },
                  typing: { type: 'string', example: 'Broadcast typing indicator' },
                  mark_read: { type: 'string', example: 'Mark messages as read' },
                },
              },
            },
          },
        },
      },
    }),
  );
