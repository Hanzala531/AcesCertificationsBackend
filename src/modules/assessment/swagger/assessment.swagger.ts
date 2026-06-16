import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import { CreateAssessmentDto } from '../dto/create-assessment.dto';
import { SubmitAnswersDto, UpdateAnswerDto } from '../dto/submit-answer.dto';
import {
  ImproveAndResolveDto,
  ApproveAssessmentDto,
  EscalateAssessmentDto,
  SubmitImprovedAnswersDto,
} from '../dto/admin-actions.dto';
import {
  CreateAssessmentApiResponse,
  GetAssessmentApiResponse,
  GetAssessmentsListApiResponse,
  GetQuestionsApiResponse,
  SubmitAnswersApiResponse,
  UpdateAnswerApiResponse,
  SubmitAssessmentApiResponse,
  GetScoreApiResponse,
  SelfDisclosureStatusDto,
  GetSelfDisclosureStatusApiResponse,
  AssessmentBadRequestErrorDto,
  AssessmentNotFoundErrorDto,
  AssessmentForbiddenErrorDto,
  AssessmentUnauthorizedErrorDto,
  GetNextQuestionApiResponse,
} from '../dto/assessment-response.dto';
import {
  GetAssessmentMetricsApiResponse,
  GetAdminAssessmentListApiResponse,
  GetAdminAssessmentDetailsApiResponse,
  AdminAssessmentErrorDto,
  GetAdminDashboardStatsApiResponse,
} from '../dto/admin-assessment-response.dto';

export function SwaggerGetAssessments() {
  return applyDecorators(
    ApiExtraModels(
      GetAssessmentsListApiResponse,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get all assessments for current user/organization',
      description: `
Retrieves a paginated list of assessments.

**For organization role**: Returns all organization assessments
**For organization_member role**: Returns assessments for their assigned branch only

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
      description: 'Items per page (default: 10)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Assessments retrieved successfully',
      type: GetAssessmentsListApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetPendingAssessments() {
  return applyDecorators(
    ApiExtraModels(
      GetAssessmentsListApiResponse,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get pending assessments for organization',
      description: `
Retrieves a paginated list of **pending** assessments for the current user's organization.

**Pending** = status is \`in_progress\`, \`submitted\`, or \`ai_reviewing\` (excludes \`completed\` and \`expired\`).

**For organization role**: Returns pending assessments for the organization
**For organization_member role**: Returns pending assessments for their assigned branch only

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
      description: 'Items per page (default: 10)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Pending assessments retrieved successfully',
      type: GetAssessmentsListApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetAssessmentById() {
  return applyDecorators(
    ApiExtraModels(
      GetAssessmentApiResponse,
      AssessmentNotFoundErrorDto,
      AssessmentForbiddenErrorDto,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get assessment details by ID',
      description: `
Retrieves detailed information about a specific assessment including progress.

**For organization role**: Can access assessments belonging to their organization
**For organization_member role**: Can access assessments belonging to their assigned branch
**For admin role**: Can access any assessment across all organizations

**Required Role**: \`organization\`, \`organization_member\`, or \`admin\`
      `,
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
      description: 'Assessment retrieved successfully',
      type: GetAssessmentApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied to this assessment',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetAdminAssessmentMetrics() {
  return applyDecorators(
    ApiExtraModels(GetAssessmentMetricsApiResponse),
    ApiOperation({
      summary: 'Get assessment metrics for admin dashboard',
      description: `
Returns aggregated assessment statistics for the admin dashboard.

**Metrics included:**
- Total Assessments: Count of all assessments
- AI Flagged: Count of assessments with AI flags or discrepancies
- Pending Audits: Count of assessments awaiting audit (submitted or ai_reviewing status)
- Completed: Count of assessments with completed status

**Required Role**: \`admin\`
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Assessment metrics retrieved successfully',
      type: GetAssessmentMetricsApiResponse,
    }),
  );
}

export function SwaggerGetAdminDashboardStats() {
  return applyDecorators(
    ApiExtraModels(GetAdminDashboardStatsApiResponse),
    ApiOperation({
      summary: 'Get admin dashboard statistics',
      description: `
Returns aggregated counts for the admin dashboard split into two categories:

**Self-Disclosure Stats:**
- Total published certificates
- In-progress self-disclosure assessments
- Completed self-disclosure assessments
- Active (non-expired, non-blocked) issued certificates

**Self-Assured Stats:**
- Total self-assured assessments
- In-progress self-assured assessments
- Self-assured assessments in auditor-assigned phase
- Completed self-assured assessments

**Required Role**: \`admin\`, \`subadmin\`
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Dashboard statistics retrieved successfully',
      type: GetAdminDashboardStatsApiResponse,
    }),
  );
}

export function SwaggerGetAdminAssessments() {
  return applyDecorators(
    ApiExtraModels(GetAdminAssessmentListApiResponse),
    ApiOperation({
      summary: 'Get paginated list of all assessments (admin)',
      description: `
Returns a paginated list of all assessments with organization, certificate, badge, and AI review details.

**Query Parameters:**
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 10)
- \`organizationId\`: Filter by organization UUID (optional)
- \`status\`: Filter by assessment status (optional)
- \`assessmentType\`: Filter by assessment type (optional)
- \`startDate\`: Filter assessments from this date (ISO 8601 format, optional)
- \`endDate\`: Filter assessments until this date (ISO 8601 format, optional)
- \`sortBy\`: Sort by 'date' or 'score' (default: 'date')
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
      name: 'organizationId',
      required: false,
      type: String,
      description:
        'Filter by organization UUID (optional - leave empty to get assessments from all organizations)',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      type: String,
      enum: [
        'in_progress',
        'submitted',
        'ai_reviewing',
        'completed',
        'expired',
      ],
      description: 'Filter by assessment status',
    }),
    ApiQuery({
      name: 'assessmentType',
      required: false,
      type: String,
      enum: ['self_disclosure', 'assured'],
      description: 'Filter by assessment type',
    }),
    ApiQuery({
      name: 'startDate',
      required: false,
      type: String,
      description: 'Filter assessments from this date (ISO 8601 format)',
    }),
    ApiQuery({
      name: 'endDate',
      required: false,
      type: String,
      description: 'Filter assessments until this date (ISO 8601 format)',
    }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      enum: ['date', 'score'],
      description: 'Sort by date or score (default: date)',
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
      description: 'Assessments retrieved successfully',
      type: GetAdminAssessmentListApiResponse,
    }),
  );
}

export function SwaggerGetAdminAssessmentDetails() {
  return applyDecorators(
    ApiExtraModels(
      GetAdminAssessmentDetailsApiResponse,
      AdminAssessmentErrorDto,
    ),
    ApiOperation({
      summary: 'Get detailed assessment information (admin)',
      description: `
Returns complete assessment details including organization, certificate, badge, AI review, and all related information.

**Required Role**: \`admin\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Assessment details retrieved successfully',
      type: GetAdminAssessmentDetailsApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AdminAssessmentErrorDto,
    }),
  );
}

export function SwaggerGetAssessmentScore() {
  return applyDecorators(
    ApiExtraModels(
      GetScoreApiResponse,
      AssessmentNotFoundErrorDto,
      AssessmentForbiddenErrorDto,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get assessment score and badge',
      description: `
Retrieves the final score and awarded badge for a completed assessment.

**Badge Levels:**
- **Rated**: 70-79% score
- **Verified**: 80-89% score
- **Certified**: 90%+ score

**Note:** Score is only available after AI review is complete.

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Score retrieved successfully',
      type: GetScoreApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetSelfDisclosureStatus() {
  return applyDecorators(
    ApiExtraModels(
      GetSelfDisclosureStatusApiResponse,
      SelfDisclosureStatusDto,
      AssessmentUnauthorizedErrorDto,
      AssessmentForbiddenErrorDto,
    ),
    ApiOperation({
      summary:
        'Check if organization completed self disclosure for a certificate',
      description: `Returns whether the authenticated organization has run a self disclosure for the provided certificate, whether assured has already been applied, and details about the latest self disclosure assessment if any.`,
    }),
    ApiParam({
      name: 'certificateId',
      description: 'Certificate UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiQuery({
      name: 'branchId',
      required: false,
      type: 'string',
      description:
        'Optional branch UUID. If provided, checks self disclosure status only for that branch.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Self disclosure status retrieved successfully',
      type: GetSelfDisclosureStatusApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden',
      type: AssessmentForbiddenErrorDto,
    }),
  );
}

export function SwaggerGetQuestionsWithProgress() {
  return applyDecorators(
    ApiExtraModels(
      GetQuestionsApiResponse,
      AssessmentNotFoundErrorDto,
      AssessmentForbiddenErrorDto,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get all questions with answer progress',
      description: `
Retrieves all questions for the certificate with current answer status.
Questions are grouped by main section, section, and sub-section.

**For organization role**: Can access questions for assessments belonging to their organization
**For organization_member role**: Can access questions for assessments belonging to their assigned branch
**For admin role**: Can access questions for any assessment across all organizations

**Required Role**: \`organization\`, \`organization_member\`, or \`admin\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Questions retrieved successfully',
      type: GetQuestionsApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerCreateAssessment() {
  return applyDecorators(
    ApiExtraModels(
      CreateAssessmentApiResponse,
      AssessmentBadRequestErrorDto,
      AssessmentNotFoundErrorDto,
      AssessmentForbiddenErrorDto,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Create a new assessment',
      description: `
Creates a new certificate assessment after payment confirmation.

**Prerequisites:**
1. Payment must be initiated and confirmed (is_paid=true)
2. Payment type must match assessment type
3. Payment certificate must match assessment certificate

**For Assured Assessments:**
- Organization must have completed a self-disclosure assessment for the certificate
- Organization must have a badge allocated for the certificate (automatically detected)
- Assessment will be created with status 'completed' automatically
- An assurance review will be created automatically

**Automatic Fields:**
- \`organization_id\`: Automatically retrieved from the authenticated user's token
- \`is_submitted\`: Always set to \`false\` by default (cannot be provided by user)
- \`status\`: Set to 'completed' automatically for assured assessments

**Branch Requirement:**
- \`organization\` role: branch_id is optional
- \`organization_member\` role: branch_id is required (can use employee's default branch if not provided)

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiBody({
      type: CreateAssessmentDto,
      description: 'Assessment creation details',
      examples: {
        organization: {
          summary: 'Organization Assessment',
          value: {
            certificate_id: '550e8400-e29b-41d4-a716-446655440000',
            payment_id: '550e8400-e29b-41d4-a716-446655440001',
            assessment_type: 'self_disclosure',
          },
        },
        organization_member: {
          summary: 'Branch Assessment (Org Member)',
          value: {
            certificate_id: '550e8400-e29b-41d4-a716-446655440000',
            payment_id: '550e8400-e29b-41d4-a716-446655440001',
            assessment_type: 'self_disclosure',
            branch_id: '550e8400-e29b-41d4-a716-446655440002',
          },
        },
        assured_assessment: {
          summary: 'Assured Assessment',
          value: {
            certificate_id: '550e8400-e29b-41d4-a716-446655440000',
            payment_id: '550e8400-e29b-41d4-a716-446655440001',
            assessment_type: 'assured',
            branch_id: '550e8400-e29b-41d4-a716-446655440002',
          },
          description:
            'Badge is automatically detected based on organization and certificate',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Assessment created successfully',
      type: CreateAssessmentApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation error or payment issue',
      type: AssessmentBadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Payment or organization not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied - payment belongs to another user',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized - Invalid or missing JWT token',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerSubmitAnswers() {
  return applyDecorators(
    ApiExtraModels(
      SubmitAnswersApiResponse,
      AssessmentBadRequestErrorDto,
      AssessmentNotFoundErrorDto,
      AssessmentForbiddenErrorDto,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Submit answers for questions',
      description: `
Submit or update answers for multiple questions in a single request.
Existing answers will be updated, new answers will be created.

**Response Types:**
- \`pdf\`: \`response_files\` array for multi-document uploads (up to 3 file URLs). \`response_value\` can optionally store a primary/legacy URL.
- \`boolean\`: "yes" or "no"
- \`text\`: Free-form text (max 10,000 characters)
- \`number\`: Numeric value as string (e.g., "42", "3.14")
- \`checkbox\`: JSON array of selected options as string (e.g., '["Option A","Option C"]')
- \`multiple_choice\`: Single selected option string (e.g., "Option B")
- \`rating\`: Rating value as string (e.g., "4")

**Note:** Cannot submit after assessment is submitted for review.

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({
      type: SubmitAnswersDto,
      description:
        'Array of answers to submit. For pdf answers, pass uploaded document URLs in response_files.',
      examples: {
        mixedAnswers: {
          summary: 'Mixed Answers Including Multi-Document PDF',
          value: {
            answers: [
              {
                question_id: '550e8400-e29b-41d4-a716-446655440000',
                response_type: 'boolean',
                response_value: 'yes',
              },
              {
                question_id: '550e8400-e29b-41d4-a716-446655440001',
                response_type: 'text',
                response_value:
                  'Our safety procedures include regular inspections and training.',
              },
              {
                question_id: '550e8400-e29b-41d4-a716-446655440002',
                response_type: 'pdf',
                response_files: [
                  'https://storage.example.com/policies/fire-safety.pdf',
                  'https://storage.example.com/policies/evacuation-plan.pdf',
                ],
              },
              {
                question_id: '550e8400-e29b-41d4-a716-446655440003',
                response_type: 'number',
                response_value: '42',
              },
              {
                question_id: '550e8400-e29b-41d4-a716-446655440004',
                response_type: 'checkbox',
                response_value: '["Fire Safety","Electrical Safety"]',
              },
              {
                question_id: '550e8400-e29b-41d4-a716-446655440005',
                response_type: 'multiple_choice',
                response_value: 'Yes, all trained',
              },
              {
                question_id: '550e8400-e29b-41d4-a716-446655440006',
                response_type: 'rating',
                response_value: '4',
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Answers saved successfully',
      type: SubmitAnswersApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Validation error or assessment already submitted',
      type: AssessmentBadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerUpdateAnswer() {
  return applyDecorators(
    ApiExtraModels(
      UpdateAnswerApiResponse,
      AssessmentBadRequestErrorDto,
      AssessmentNotFoundErrorDto,
      AssessmentForbiddenErrorDto,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Update a specific answer',
      description: `
Updates an existing answer before the assessment is submitted.

**Note:** Cannot update after assessment is submitted for review.

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiParam({
      name: 'answerId',
      description: 'Answer UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({
      type: UpdateAnswerDto,
      description: 'Updated answer data',
      examples: {
        boolean: {
          summary: 'Update Boolean Answer',
          value: {
            response_type: 'boolean',
            response_value: 'no',
          },
        },
        text: {
          summary: 'Update Text Answer',
          value: {
            response_type: 'text',
            response_value:
              'Updated detailed description of our safety procedures...',
          },
        },
        pdf: {
          summary: 'Update PDF Answer With Multiple Documents',
          value: {
            response_type: 'pdf',
            response_files: [
              'https://storage.example.com/docs/compliance-cert.pdf',
              'https://storage.example.com/docs/inspection-report.pdf',
            ],
          },
        },
        number: {
          summary: 'Update Number Answer',
          value: {
            response_type: 'number',
            response_value: '15',
          },
        },
        checkbox: {
          summary: 'Update Checkbox Answer',
          value: {
            response_type: 'checkbox',
            response_value: '["Fire Safety","Chemical Safety"]',
          },
        },
        multipleChoice: {
          summary: 'Update Multiple Choice Answer',
          value: {
            response_type: 'multiple_choice',
            response_value: 'Yes, all trained',
          },
        },
        rating: {
          summary: 'Update Rating Answer',
          value: {
            response_type: 'rating',
            response_value: '4',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Answer updated successfully',
      type: UpdateAnswerApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Assessment already submitted or answer mismatch',
      type: AssessmentBadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment or answer not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerSubmitAssessment() {
  return applyDecorators(
    ApiExtraModels(
      SubmitAssessmentApiResponse,
      AssessmentBadRequestErrorDto,
      AssessmentNotFoundErrorDto,
      AssessmentForbiddenErrorDto,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Submit assessment for AI review',
      description: `
Submits the assessment for AI review. This action:
1. Marks the assessment as submitted
2. Triggers automatic AI review
3. AI analyzes each answer and flags non-compliant responses
4. Calculates final score
5. Awards badge based on score (Rated: 70-79%, Verified: 80-89%, Certified: 90%+)

**Note:** This action cannot be undone. Ensure all answers are complete.

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Assessment submitted successfully',
      type: SubmitAssessmentApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Assessment already submitted',
      type: AssessmentBadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerImproveAndResolve() {
  return applyDecorators(
    ApiOperation({
      summary: 'Request improvement on flagged questions (admin)',
      description: `
Sends the assessment back to the applicant with a message explaining which questions need improvement.
Sets status to \`improvement_requested\` and flag_status to \`pending\`.
Notifies the applicant.

**Required Role**: \`admin\` or \`subadmin\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({ type: ImproveAndResolveDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Improvement requested successfully',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment or AI review not found',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Assessment is not in completed status',
    }),
  );
}

export function SwaggerGetFlaggedQuestions() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get flagged questions for improvement',
      description: `
Returns only the flagged questions with their previous answers, flag reasons, and AI suggestions.
Used by the applicant to see which questions need improvement.

**Required Role**: \`organization\`, \`organization_member\`, \`admin\`, or \`subadmin\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Flagged questions retrieved successfully',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
    }),
  );
}

export function SwaggerSubmitImprovements() {
  return applyDecorators(
    ApiOperation({
      summary: 'Submit improved answers for flagged questions',
      description: `
Submits updated answers for flagged questions. Triggers AI re-review of only the flagged questions,
updates existing ai_responses (no delete/recreate), and recalculates the overall score.

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({ type: SubmitImprovedAnswersDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Improvements submitted and re-reviewed successfully',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment or AI review not found',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Assessment is not in improvement_requested status',
    }),
  );
}

export function SwaggerApproveAssessment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Admin approve assessment',
      description: `
Admin override to approve an assessment. If score < 50, adjusts to random 50-60.
Preserves original score for audit trail. Resolves flags and re-allocates badge.

**Required Role**: \`admin\` or \`subadmin\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({ type: ApproveAssessmentDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Assessment approved successfully',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment or AI review not found',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Assessment already admin-approved',
    }),
  );
}

export function SwaggerEscalateAssessment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Escalate assessment for further review',
      description: `
Escalates the assessment by setting flag_status to \`escalated\` and blocking certificate allocation.
Notifies the applicant that their assessment is under further review.

**Required Role**: \`admin\` or \`subadmin\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({ type: EscalateAssessmentDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Assessment escalated successfully',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment or AI review not found',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Assessment already escalated',
    }),
  );
}

export function SwaggerSetCertificateBlockStatus() {
  return applyDecorators(
    ApiExtraModels(
      AssessmentBadRequestErrorDto,
      AssessmentNotFoundErrorDto,
      AssessmentForbiddenErrorDto,
      AssessmentUnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Block or unblock certificate progression for an assessment',
      description: `
Allows admin/subadmin to block or unblock certificate progression for a specific assessment.

**Behavior:**
- \`isBlocked: true\` requires \`reason\`
- \`isBlocked: false\` unblocks and clears any existing reason
- When blocked, applicants cannot continue the assessment

**Required Role**: \`admin\` or \`subadmin\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiBody({
      required: true,
      schema: {
        type: 'object',
        properties: {
          isBlocked: {
            type: 'boolean',
            example: true,
          },
          reason: {
            type: 'string',
            nullable: true,
            example: 'Critical compliance documents are missing.',
          },
        },
        required: ['isBlocked'],
      },
      examples: {
        block: {
          summary: 'Block assessment',
          value: {
            isBlocked: true,
            reason: 'Critical compliance documents are missing.',
          },
        },
        unblock: {
          summary: 'Unblock assessment',
          value: {
            isBlocked: false,
            reason: null,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Certificate block status updated successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: 'Certificate allocation blocked for this assessment',
          },
          data: {
            type: 'object',
            properties: {
              assessmentId: { type: 'string', format: 'uuid' },
              isBlocked: { type: 'boolean' },
              reason: { type: 'string', nullable: true },
            },
          },
          statusCode: { type: 'number', example: 200 },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid payload or missing block reason',
      type: AssessmentBadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetReviewOverview() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get assessment review overview for the applicant',
      description: `
Retrieves the full review status of a submitted assessment from the applicant's perspective:

- **assessment_name**: Name of the certificate being assessed
- **submitted_at**: Date/time the assessment was submitted
- **actions_required**: Clarification requests directed at the applicant (with question text and auditor message)
- **auditor**: Auditor name, purpose (requires_clarification if they raised actions), and audit notes
- **reviewer**: Reviewer name, purpose (requires_clarification if they raised actions), and review notes

\`auditor\` and \`reviewer\` are \`null\` when nobody is assigned. \`purpose\` is \`"requires_clarification"\` if that role has entries in \`actions_required\`, otherwise \`null\`.

**Required Role**: \`organization\` or \`organization_member\`
      `,
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
      description: 'Review overview retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'Review overview retrieved successfully',
          data: {
            assessment_name: 'ISO 27001 Certification',
            submitted_at: '2026-01-26T21:42:28.000Z',
            actions_required: [
              {
                id: '550e8400-e29b-41d4-a716-446655440001',
                question_id: '550e8400-e29b-41d4-a716-446655440002',
                question_text: 'Do you have a documented security policy?',
                message: 'Please provide the latest version of your security policy document.',
                created_by_role: 'auditor',
                created_at: '2026-01-26T21:42:28.000Z',
              },
            ],
            auditor: {
              name: 'John Smith',
              purpose: 'requires_clarification',
              notes: {
                audit_summary: 'Assessment reviewed with conditions',
                audit_description: 'Overall compliant but requires additional documentation.',
                status: 'conditionally_approved',
                score: 87.5,
              },
            },
            reviewer: {
              name: 'Jane Doe',
              purpose: null,
              notes: {
                review_summary: null,
                review_description: null,
                review_status: null,
                review_score: null,
              },
            },
          },
          statusCode: 200,
          timestamp: '2026-01-26T21:42:28.000Z',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetSubmittedAssessmentView() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get complete submitted assessment with all Q&A',
      description: `
Retrieves all questions and submitted answers for an assessment, organized by:
**Main Section → Section → Sub-section → Questions**

Each question includes the applicant's answer (response_type, response_value, response_files for multi-document uploads).

**Required Role**: \`organization\` or \`organization_member\`
      `,
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
      description: 'Submitted assessment retrieved successfully',
      schema: {
        example: {
          success: true,
          message: 'Submitted assessment retrieved successfully',
          data: [
            {
              main_section_id: '550e8400-e29b-41d4-a716-446655440010',
              main_section_name: 'Health & Safety',
              sections: [
                {
                  section_id: '550e8400-e29b-41d4-a716-446655440011',
                  section_name: 'Fire Safety',
                  sub_sections: [
                    {
                      sub_section_id: null,
                      sub_section_name: null,
                      questions: [
                        {
                          question_id: '550e8400-e29b-41d4-a716-446655440002',
                          question_text: 'Do you have fire safety procedures in place?',
                          question_type: 'boolean',
                          hint: 'Consider fire drills, extinguishers, evacuation plans.',
                          rank: 1,
                          answer_id: '550e8400-e29b-41d4-a716-446655440020',
                          response_type: 'boolean',
                          response_value: 'yes',
                          response_files: null,
                        },
                        {
                          question_id: '550e8400-e29b-41d4-a716-446655440003',
                          question_text: 'Upload your fire safety certificate.',
                          question_type: 'file',
                          hint: null,
                          rank: 2,
                          answer_id: '550e8400-e29b-41d4-a716-446655440021',
                          response_type: 'pdf',
                          response_value: 'https://storage.example.com/cert.pdf',
                          response_files: [
                            'https://storage.example.com/cert1.pdf',
                            'https://storage.example.com/cert2.pdf',
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          statusCode: 200,
          timestamp: '2024-01-15T11:00:00.000Z',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Access denied',
      type: AssessmentForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetAssessmentStages() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get assessment stages/progress',
      description:
        'Returns the current stages and progress for an assessment. ' +
        'Self-disclosure assessments have 3 stages, assured assessments have 4 stages. ' +
        'Each stage has a status: completed, current, or upcoming.',
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'UUID of the assessment',
      type: String,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Assessment stages retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Assessment stages retrieved successfully' },
          data: {
            type: 'object',
            properties: {
              assessmentId: { type: 'string', format: 'uuid' },
              assessmentType: { type: 'string', enum: ['self_disclosure', 'assured'] },
              stages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    step: { type: 'number', example: 1 },
                    label: { type: 'string', example: 'Self-Disclosure In Progress' },
                    status: { type: 'string', enum: ['completed', 'current', 'upcoming'] },
                  },
                },
              },
              currentStep: { type: 'number', example: 2 },
            },
          },
          statusCode: { type: 'number', example: 200 },
          timestamp: { type: 'string' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetNextQuestion() {
  return applyDecorators(
    ApiExtraModels(GetNextQuestionApiResponse, AssessmentNotFoundErrorDto, AssessmentUnauthorizedErrorDto),
    ApiOperation({
      summary: 'Get next question for an assessment',
      description: `
Returns the next question to be answered in a sequential assessment flow.

- If \`current_question_id\` is omitted, returns the very first question.
- If the current question is **boolean** and has sub-questions, the \`answer\` param determines which branch to follow.
- When a boolean branch is exhausted, the flow continues at the next top-level question.
- Returns \`{ done: true, question: null }\` when there are no more questions.

**Required Role**: \`organization\` or \`organization_member\`
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'Assessment UUID',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiQuery({
      name: 'current_question_id',
      required: false,
      type: String,
      description: 'UUID of the question just answered. Omit to get the first question.',
    }),
    ApiQuery({
      name: 'answer',
      required: false,
      type: String,
      enum: ['yes', 'no'],
      description: 'Answer to the current question (required when current question is boolean).',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Next question retrieved',
      type: GetNextQuestionApiResponse,
      content: {
        'application/json': {
          examples: {
            first_question: {
              summary: 'Get first question (no current_question_id)',
              value: {
                success: true,
                message: 'Next question retrieved',
                data: {
                  done: false,
                  question: {
                    id: 'aaaaaaaa-0000-0000-0000-000000000001',
                    question: 'Do you have a documented health and safety policy?',
                    type: 'boolean',
                    hint: 'Include any written policy approved by management.',
                    criteria: 'Policy must be reviewed annually.',
                    options: null,
                    score: 20,
                    question_number: 1,
                    certificate_question_number: 1,
                    parent_question_id: null,
                    parent_trigger_value: null,
                    yes_sub_questions: [
                      {
                        id: 'bbbbbbbb-0000-0000-0000-000000000002',
                        question: 'When was the policy last reviewed?',
                        type: 'text',
                        hint: null,
                        criteria: null,
                        options: null,
                        score: 10,
                        question_number: 2,
                        certificate_question_number: 2,
                        parent_question_id: 'aaaaaaaa-0000-0000-0000-000000000001',
                        parent_trigger_value: 'yes',
                        yes_sub_questions: [],
                        no_sub_questions: [],
                      },
                    ],
                    no_sub_questions: [
                      {
                        id: 'cccccccc-0000-0000-0000-000000000003',
                        question: 'When do you plan to create one?',
                        type: 'text',
                        hint: null,
                        criteria: null,
                        options: null,
                        score: 10,
                        question_number: 3,
                        certificate_question_number: 3,
                        parent_question_id: 'aaaaaaaa-0000-0000-0000-000000000001',
                        parent_trigger_value: 'no',
                        yes_sub_questions: [],
                        no_sub_questions: [],
                      },
                    ],
                  },
                },
                statusCode: 200,
                timestamp: '2024-01-15T10:00:00.000Z',
              },
            },
            follow_yes_branch: {
              summary: 'Boolean answered "yes" → returns first yes sub-question',
              value: {
                success: true,
                message: 'Next question retrieved',
                data: {
                  done: false,
                  question: {
                    id: 'bbbbbbbb-0000-0000-0000-000000000002',
                    question: 'When was the policy last reviewed?',
                    type: 'text',
                    hint: null,
                    criteria: null,
                    options: null,
                    score: 10,
                    question_number: 2,
                    certificate_question_number: 2,
                    parent_question_id: 'aaaaaaaa-0000-0000-0000-000000000001',
                    parent_trigger_value: 'yes',
                    yes_sub_questions: [],
                    no_sub_questions: [],
                  },
                },
                statusCode: 200,
                timestamp: '2024-01-15T10:00:00.000Z',
              },
            },
            after_last_sub_question: {
              summary: 'After last sub-question → returns next top-level question',
              value: {
                success: true,
                message: 'Next question retrieved',
                data: {
                  done: false,
                  question: {
                    id: 'dddddddd-0000-0000-0000-000000000004',
                    question: 'How many employees do you have?',
                    type: 'number',
                    hint: 'Include full-time and part-time staff.',
                    criteria: null,
                    options: null,
                    score: 10,
                    question_number: 4,
                    certificate_question_number: 4,
                    parent_question_id: null,
                    parent_trigger_value: null,
                    yes_sub_questions: [],
                    no_sub_questions: [],
                  },
                },
                statusCode: 200,
                timestamp: '2024-01-15T10:00:00.000Z',
              },
            },
            assessment_complete: {
              summary: 'No more questions → done: true',
              value: {
                success: true,
                message: 'Next question retrieved',
                data: {
                  done: true,
                  question: null,
                },
                statusCode: 200,
                timestamp: '2024-01-15T10:00:00.000Z',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment or question not found',
      type: AssessmentNotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: AssessmentUnauthorizedErrorDto,
    }),
  );
}
