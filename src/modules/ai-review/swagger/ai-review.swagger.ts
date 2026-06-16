import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  GetAiReviewApiResponseDto,
  GetFlaggedResponsesApiResponseDto,
} from '../dto/ai-review-response.dto';

// ── Shared error response helper ──

const errorResponse = (
  statusCode: number,
  message: string,
  error?: string,
) => ({
  schema: {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const, example: false },
      message: { type: 'string' as const },
      timestamp: { type: 'string' as const },
      path: { type: 'string' as const },
    },
    example: {
      statusCode,
      message,
      ...(error ? { error } : {}),
    },
  },
});

const unauthorizedResponse = () =>
  ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or missing JWT token',
    ...errorResponse(401, 'Unauthorized'),
  });

const forbiddenResponse = (message = 'Access denied to this assessment') =>
  ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: message,
    ...errorResponse(403, message, 'Forbidden'),
  });

// ── GET /ai-reviews/:assessmentId ──

export function SwaggerGetAiReview() {
  return applyDecorators(
    ApiExtraModels(GetAiReviewApiResponseDto),
    ApiOperation({
      summary: 'Get AI review results for an assessment',
      description: `Retrieves the complete AI review for a submitted assessment, including:
- Overall review status and description
- Individual AI responses for each answer
- Flag information for non-compliant answers

**Review Status Values:**
- \`pending\`: Review not yet started
- \`in_progress\`: AI is analyzing the assessment
- \`completed\`: Review finished successfully
- \`failed\`: Review encountered an error

**Required Role**: \`organization\`, \`organization_member\`, \`admin\`, or \`subadmin\``,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'AI review retrieved successfully',
      type: GetAiReviewApiResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'AI review not found for this assessment',
      ...errorResponse(404, 'AI review not found for this assessment', 'Not Found'),
    }),
    forbiddenResponse(),
    unauthorizedResponse(),
  );
}

// ── GET /ai-reviews/:assessmentId/flags ──

export function SwaggerGetFlaggedResponses() {
  return applyDecorators(
    ApiExtraModels(GetFlaggedResponsesApiResponseDto),
    ApiOperation({
      summary: 'Get flagged responses for an assessment',
      description: `Retrieves only the flagged (non-compliant) responses from the AI review.

**Common Flag Reasons:**
- \`Missing response\`: No answer provided
- \`Negative compliance response\`: Boolean answer was "no"
- \`Response too brief\`: Text response lacks sufficient detail
- \`Document verification pending\`: PDF needs manual verification

Use this endpoint to focus on areas that need attention or improvement.

**Required Role**: \`organization\`, \`organization_member\`, \`admin\`, or \`subadmin\``,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Flagged responses retrieved successfully',
      type: GetFlaggedResponsesApiResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      ...errorResponse(404, 'Assessment not found', 'Not Found'),
    }),
    forbiddenResponse(),
    unauthorizedResponse(),
  );
}

// ── GET /questions/:questionId/guidance ──

export function SwaggerGetQuestionGuidance() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get AI-generated guidance suggestions for a question',
      description: `Retrieves exactly 3 neutral, reusable guidance suggestions for answering a specific question.

**Key Features:**
- **Assessment-independent**: No assessment_id required
- **Neutral guidance**: Suggestions are generic and not personalized
- **Reusable**: Can be used across the system for any question

**What you get:**
- Exactly 3 concise guidance suggestions (50-100 words each)
- Suggestions help users think about aspects to consider

**Required Role**: \`organization\` or \`organization_member\``,
    }),
    ApiParam({
      name: 'questionId',
      description: 'Question UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Question guidance retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'Question guidance retrieved successfully',
          data: {
            question_id: '550e8400-e29b-41d4-a716-446655440001',
            question_text: 'Does your organization have fire safety procedures?',
            question_type: 'boolean',
            suggestions: [
              'Consider the specific requirements and criteria that determine a yes or no answer.',
              'Think about any edge cases or exceptions that might apply to your situation.',
              'Review relevant documentation or evidence that supports your response.',
            ],
          },
          statusCode: 200,
          timestamp: '2026-01-15T10:30:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Question not found',
      ...errorResponse(404, 'Question not found', 'Not Found'),
    }),
    unauthorizedResponse(),
  );
}

// ── GET /ai-flags ──

export function SwaggerGetAllAiFlags() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all AI flags (admin)',
      description: `Returns a paginated list of all AI-flagged reviews across the system.

**Filterable by flag status:**
- \`open\`: Flags awaiting review
- \`pending\`: Flags under review
- \`escalated\`: Flags escalated to senior staff
- \`resolved\`: Flags that have been addressed

**Required Role**: \`admin\` or \`subadmin\``,
    }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: ['open', 'pending', 'escalated', 'resolved'],
      description: 'Filter by flag status',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of results per page (default: 25)',
      example: 25,
    }),
    ApiQuery({
      name: 'pageNumber',
      required: false,
      type: Number,
      description: 'Page number for pagination (default: 1)',
      example: 1,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'AI flags retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'AI flags retrieved successfully',
          data: {
            items: [
              {
                review_id: '550e8400-e29b-41d4-a716-446655440000',
                assessment_id: '660e8400-e29b-41d4-a716-446655440001',
                certificate_name: 'ISO 9001:2015',
                organization_name: 'TechCorp Inc',
                branch_name: 'Head Office',
                assessment_type: 'self_disclosure',
                total_flags: 3,
                flag_status: 'open',
                score: 72.5,
                is_reviewer_assigned: false,
                created_at: '2026-01-15T10:30:00.000Z',
                updated_at: '2026-01-15T10:30:00.000Z',
              },
            ],
            total: 1,
          },
          statusCode: 200,
          timestamp: '2026-01-15T10:30:00.000Z',
        },
      },
    }),
    unauthorizedResponse(),
  );
}

// ── GET /ai-flags/:reviewId ──

export function SwaggerGetAiFlagDetails() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get AI flag details (admin)',
      description: `Retrieves detailed information about a specific AI review, including the review summary and all flagged responses with question context.

**Required Role**: \`admin\` or \`subadmin\``,
    }),
    ApiParam({
      name: 'reviewId',
      description: 'AI Review UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'AI flag details retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'AI flag details retrieved successfully',
          data: {
            review: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              certificate_assessment_id: '660e8400-e29b-41d4-a716-446655440001',
              review_description: '45 of 50 responses passed (90%). 5 response(s) flagged for review.',
              review_status: 'completed',
              total_flags: 5,
              score: 72.5,
              flag_status: 'open',
              is_reviewer_assigned: false,
              started_at: '2026-01-15T10:30:00.000Z',
              completed_at: '2026-01-15T10:35:00.000Z',
            },
            flaggedResponses: [
              {
                id: '770e8400-e29b-41d4-a716-446655440002',
                ai_review_id: '550e8400-e29b-41d4-a716-446655440000',
                response: 'Response too brief to determine compliance.',
                is_flagged: true,
                flag_reason: 'Response too brief',
                confidence_score: 40,
                is_question_approved: false,
                question_text: 'Describe your safety procedures',
                question_type: 'text',
                response_type: 'text',
                response_value: 'We have some procedures',
              },
            ],
            isReviewerAssigned: true,
          },
          statusCode: 200,
          timestamp: '2026-01-15T10:30:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'AI review not found',
      ...errorResponse(404, 'AI review not found', 'Not Found'),
    }),
    unauthorizedResponse(),
  );
}

// ── PATCH /ai-flags/:reviewId/status ──

export function SwaggerUpdateFlagStatus() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update AI flag status (admin)',
      description: `Updates the flag status of an AI review.

**Valid statuses:**
- \`open\`: Flag is awaiting review
- \`pending\`: Flag is under review
- \`escalated\`: Flag has been escalated
- \`resolved\`: Flag has been addressed

**Required Role**: \`admin\` or \`subadmin\``,
    }),
    ApiParam({
      name: 'reviewId',
      description: 'AI Review UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'pending', 'escalated', 'resolved'],
            example: 'resolved',
            description: 'New flag status',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Flag status updated successfully',
      schema: {
        example: {
          success: true,
          message: 'Flag status updated successfully',
          data: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            flag_status: 'resolved',
            updated_at: '2026-01-15T10:35:00.000Z',
          },
          statusCode: 200,
          timestamp: '2026-01-15T10:35:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'AI review not found',
      ...errorResponse(404, 'AI review not found', 'Not Found'),
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid status value',
      ...errorResponse(400, 'Invalid flag status', 'Bad Request'),
    }),
    unauthorizedResponse(),
  );
}

// ── PATCH /ai-flags/:reviewId/responses/:responseId/approve ──

export function SwaggerApproveQuestion() {
  return applyDecorators(
    ApiOperation({
      summary: 'Approve a flagged question response (admin)',
      description: `Marks a specific flagged AI response as approved by an admin.

When **all** flagged responses in the review are approved, the review's \`flag_status\` is automatically set to \`resolved\`.

**Response fields:**
- \`response\` — the updated AI response with \`is_question_approved: true\`
- \`reviewClosed\` — \`true\` if this was the last unapproved flagged response (all flags resolved)
- \`review\` — the current state of the AI review (including updated \`flag_status\` if closed)

**Required Role**: \`admin\` or \`subadmin\``,
    }),
    ApiParam({
      name: 'reviewId',
      description: 'AI Review UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiParam({
      name: 'responseId',
      description: 'AI Response UUID (the specific flagged question to approve)',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Question approved successfully',
      schema: {
        example: {
          success: true,
          message: 'Question approved successfully',
          data: {
            response: {
              id: '550e8400-e29b-41d4-a716-446655440001',
              ai_review_id: '550e8400-e29b-41d4-a716-446655440000',
              is_flagged: true,
              is_question_approved: true,
              flag_reason: 'Response too brief',
            },
            reviewClosed: false,
            review: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              flag_status: 'open',
            },
          },
          statusCode: 200,
          timestamp: '2026-01-15T10:30:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Review or response not found',
      ...errorResponse(404, 'AI response not found or does not belong to this review', 'Not Found'),
    }),
    forbiddenResponse('Forbidden — admin or subadmin role required'),
    unauthorizedResponse(),
  );
}

// ── GET /ai-models ──

export function SwaggerListAvailableModels() {
  return applyDecorators(
    ApiOperation({
      summary: 'List available AI models (admin)',
      description: `Returns a list of AI models available for review analysis.

**Required Role**: \`admin\` or \`subadmin\``,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Available AI models retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'Available AI models retrieved successfully',
          data: {
            models: [
              {
                id: 'gpt-4o',
                name: 'GPT-4o',
                provider: 'openai',
              },
              {
                id: 'gemini-2.0-flash',
                name: 'Gemini 2.0 Flash',
                provider: 'google',
              },
            ],
          },
          statusCode: 200,
          timestamp: '2026-01-15T10:30:00.000Z',
        },
      },
    }),
    unauthorizedResponse(),
  );
}

// ── POST /ai-reviews/:assessmentId/debug-retry ──

export function SwaggerDebugRetryAiReview() {
  return applyDecorators(
    ApiOperation({
      summary: 'Debug retry AI review for an assessment (admin)',
      description: `Manually triggers a new AI review for a given assessment. Useful for debugging or retrying failed reviews.

**Required Role**: \`admin\` or \`subadmin\``,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'AI review debug retry initiated successfully',
      schema: {
        example: {
          success: true,
          message: 'AI review debug retry initiated successfully',
          data: {
            reviewId: '770e8400-e29b-41d4-a716-446655440002',
            assessmentId: '550e8400-e29b-41d4-a716-446655440000',
            status: 'completed',
            triggeredAt: '2026-01-15T10:30:00.000Z',
          },
          statusCode: 200,
          timestamp: '2026-01-15T10:30:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'AI review retry failed',
      ...errorResponse(500, 'AI review debug retry failed', 'Internal Server Error'),
    }),
    unauthorizedResponse(),
  );
}

// NOTE: SwaggerGetAiSuggestion is defined but not currently used in the controller.
// Kept for future use if the suggestion endpoint is re-added.
export function SwaggerGetAiSuggestion() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get AI suggestion for a specific question',
      description: `Retrieves the AI suggestion for a particular question in an assessment.

**Use Case:**
This endpoint is designed for displaying AI suggestions in a modal or popup interface. The suggestion is concise (400-500 words max) and provides actionable feedback for improving the answer.

**Response includes:**
- Question text and type
- Applicant's current answer
- AI suggestion for improvement
- Flag information (if the question was flagged)
- Risk level and category (if flagged)

**Required Role**: \`organization\` or \`organization_member\``,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiParam({
      name: 'questionId',
      description: 'Question UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'AI suggestion retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'AI suggestion retrieved successfully',
          data: {
            question_text: 'Does your organization have fire safety procedures?',
            question_type: 'boolean',
            applicant_answer: 'Yes',
            ai_suggestion:
              'Your response indicates compliance with fire safety requirements. Consider providing documentation or additional details about your fire safety procedures to strengthen your certification application.',
            flag_reason: null,
            is_flagged: false,
            risk_level: null,
            category: null,
          },
          statusCode: 200,
          timestamp: '2026-01-15T10:30:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'AI response not found for this question',
      ...errorResponse(
        404,
        'AI response not found for this question. The assessment may not have been reviewed yet.',
        'Not Found',
      ),
    }),
    forbiddenResponse(),
    unauthorizedResponse(),
  );
}
