import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssessmentStatusEnum {
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  AI_REVIEWING = 'ai_reviewing',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}


export enum AssessmentTypeEnum {
  SELF_DISCLOSURE = 'self_disclosure',
  ASSURED = 'assured',
}

export enum ResponseTypeEnum {
  PDF = 'pdf',
  BOOLEAN = 'boolean',
  TEXT = 'text',
  NUMBER = 'number',
  CHECKBOX = 'checkbox',
  MULTIPLE_CHOICE = 'multiple_choice',
  RATING = 'rating',
}

export class AssessmentResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique assessment ID',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Organization ID (automatically set from authenticated user)',
  })
  organization_id: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Branch ID (null for organization-level assessment)',
  })
  branch_id?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440003',
    description: 'Certificate ID being assessed',
  })
  certificate_id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440004',
    description: 'Payment ID for this assessment',
  })
  payment_id: string;

  @ApiProperty({
    enum: AssessmentTypeEnum,
    example: AssessmentTypeEnum.SELF_DISCLOSURE,
    description: 'Type of assessment',
  })
  assessment_type: AssessmentTypeEnum;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440005',
    description: 'Badge ID awarded (after completion)',
  })
  badge_id?: string;

  @ApiPropertyOptional({
    example: 85.5,
    description:
      'Assessment score (0-100). Score is calculated during AI review and stored in ai_reviews.',
  })
  score?: number;

  @ApiProperty({
    example: false,
    description:
      'Whether assessment has been submitted (defaults to false on creation)',
  })
  is_submitted: boolean;

  @ApiProperty({
    example: false,
    description:
      'Whether certificate allocation/progression is blocked by admin for this assessment',
  })
  is_certificate_blocked: boolean;

  @ApiPropertyOptional({
    example: 'Missing mandatory compliance documents',
    description: 'Reason provided by admin when blocking the assessment',
  })
  certificate_block_reason?: string | null;

  @ApiProperty({
    enum: AssessmentStatusEnum,
    example: AssessmentStatusEnum.IN_PROGRESS,
    description: 'Current assessment status',
  })
  status: AssessmentStatusEnum;

  @ApiPropertyOptional({
    example: '2024-01-15T10:30:00.000Z',
    description: 'When assessment was submitted',
  })
  submitted_at?: string;

  @ApiPropertyOptional({
    example: '2024-01-15T11:00:00.000Z',
    description: 'When assessment was completed',
  })
  completed_at?: string;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'When assessment was created',
  })
  created_at: string;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'When assessment was last updated',
  })
  updated_at: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440006',
    description:
      'Assurance review ID (present only when assessment_type is assured)',
  })
  assuranceId?: string;
}

export class AssessmentWithDetailsResponseDto extends AssessmentResponseDto {
  @ApiPropertyOptional({
    example: 'Safety Compliance Certificate',
    description: 'Certificate name',
  })
  certificate_name?: string;

  @ApiPropertyOptional({
    example: 'Acme Corporation',
    description: 'Organization name',
  })
  organization_name?: string;

  @ApiPropertyOptional({
    example: 'Main Office',
    description: 'Branch name',
  })
  branch_name?: string;

  @ApiPropertyOptional({
    example: 'Certified',
    description: 'Badge name (e.g., Rated, Verified, Certified)',
  })
  badge_name?: string;

  @ApiPropertyOptional({
    example: 50,
    description: 'Total questions in certificate',
  })
  total_questions?: number;

  @ApiPropertyOptional({
    example: 35,
    description: 'Number of questions answered',
  })
  answered_questions?: number;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440006',
    description: 'Assurance review ID (present only for assured assessments)',
  })
  assurance_id?: string | null;
}

export class AssessmentQueryResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Answer ID',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Assessment ID',
  })
  certificate_assessment_id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Question ID',
  })
  question_id: string;

  @ApiProperty({
    enum: ResponseTypeEnum,
    example: ResponseTypeEnum.TEXT,
    description: 'Type of response',
  })
  response_type: ResponseTypeEnum;

  @ApiPropertyOptional({
    example: 'Yes, we have implemented all safety protocols.',
    description:
      'Response value (file URL for pdf, yes/no for boolean, text content)',
  })
  response_value?: string;

  @ApiPropertyOptional({
    example: [
      'https://storage.example.com/policies/fire-safety.pdf',
      'https://storage.example.com/policies/evacuation-plan.pdf',
    ],
    description:
      'Array of uploaded document URLs for pdf responses (supports multi-document uploads)',
    type: [String],
    nullable: true,
  })
  response_files?: string[] | null;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'When answer was created',
  })
  created_at: string;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'When answer was last updated',
  })
  updated_at: string;
}

export class QuestionWithAnswerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Question ID',
  })
  id: string;

  @ApiProperty({
    example: 'Describe your fire safety procedures.',
    description: 'Question text',
  })
  question_text: string;

  @ApiProperty({
    example: 'text',
    description: 'Question type (boolean, text, multiple_choice, rating, number, file, checkbox)',
  })
  question_type: string;

  @ApiPropertyOptional({
    example: ['Fire Safety', 'Electrical Safety', 'Chemical Safety'],
    description: 'Available options for checkbox type questions',
    type: [String],
    nullable: true,
  })
  options?: string[] | null;

  @ApiProperty({
    example: true,
    description: 'Whether question is compulsory',
  })
  is_compulsory: boolean;

  @ApiProperty({
    example: 1,
    description: 'Question rank/order',
  })
  rank: number;

  @ApiProperty({
    example: 'Safety Compliance',
    description: 'Main section name',
  })
  main_section_name: string;

  @ApiPropertyOptional({
    example: 'Fire Safety',
    description: 'Section name',
  })
  section_name?: string;

  @ApiPropertyOptional({
    example: 'Procedures',
    description: 'Sub-section name',
  })
  sub_section_name?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Answer ID (if answered)',
  })
  answer_id?: string;

  @ApiPropertyOptional({
    enum: ResponseTypeEnum,
    example: ResponseTypeEnum.TEXT,
    description: 'Response type (if answered)',
  })
  response_type?: ResponseTypeEnum;

  @ApiPropertyOptional({
    example: 'Our fire safety procedures include...',
    description: 'Response value (if answered)',
  })
  response_value?: string;

  @ApiPropertyOptional({
    example: [
      'https://storage.example.com/policies/fire-safety.pdf',
      'https://storage.example.com/policies/evacuation-plan.pdf',
    ],
    description:
      'Array of uploaded document URLs for pdf answers (if answered)',
    type: [String],
    nullable: true,
  })
  response_files?: string[] | null;
}

export class AssessmentScoreResponseDto {
  @ApiPropertyOptional({
    example: 85.5,
    description:
      'Assessment score (0-100). Score is calculated during AI review and stored in ai_reviews.',
  })
  score?: number;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Badge ID awarded',
  })
  badge_id?: string;

  @ApiPropertyOptional({
    example: 'Verified',
    description:
      'Badge name (Rated: 70-79%, Verified: 80-89%, Certified: 90%+)',
  })
  badge_name?: string;

  @ApiProperty({
    enum: AssessmentStatusEnum,
    example: AssessmentStatusEnum.COMPLETED,
    description: 'Assessment status',
  })
  status: AssessmentStatusEnum;
}

export class AssessmentListResponseDto {
  @ApiProperty({
    type: [AssessmentWithDetailsResponseDto],
    description: 'Array of assessments',
  })
  data: AssessmentWithDetailsResponseDto[];

  @ApiProperty({
    example: 25,
    description: 'Total number of assessments',
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

export class AssessmentSubmitResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Assessment ID',
  })
  assessment_id: string;

  @ApiProperty({
    example: 'ai_reviewing',
    description: 'Current status after submission',
  })
  status: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'When assessment was submitted',
  })
  submitted_at: string;
}

export class SelfDisclosureStatusDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Credential certificate identifier',
  })
  certificateId: string;

  @ApiProperty({
    example: true,
    description:
      'Indicates whether at least one self disclosure assessment exists',
  })
  hasSelfDisclosure: boolean;

  @ApiProperty({
    example: false,
    description:
      'Indicates whether at least one assured assessment has already been applied for this certificate',
  })
  isAssuredApplied: boolean;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description:
      'Latest self disclosure assessment ID (null when no assessment exists)',
  })
  assessmentId?: string | null;

  @ApiPropertyOptional({
    enum: AssessmentStatusEnum,
    example: AssessmentStatusEnum.COMPLETED,
    description: 'Status of the latest self disclosure assessment',
  })
  status?: AssessmentStatusEnum | null;

  @ApiPropertyOptional({
    example: '2024-01-15T10:30:00.000Z',
    description: 'When the latest request was submitted',
  })
  submittedAt?: string | null;

  @ApiPropertyOptional({
    example: '2024-01-12T08:00:00.000Z',
    description: 'When the latest assessment record was created',
  })
  createdAt?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the latest assessment has been submitted',
  })
  isSubmitted?: boolean | null;
}

export class GetSelfDisclosureStatusApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Self disclosure status retrieved successfully' })
  message: string;

  @ApiProperty({ type: SelfDisclosureStatusDto })
  data: SelfDisclosureStatusDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class CreateAssessmentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Assessment created successfully' })
  message: string;

  @ApiProperty({ type: AssessmentResponseDto })
  data: AssessmentResponseDto;

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class GetAssessmentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Assessment retrieved successfully' })
  message: string;

  @ApiProperty({ type: AssessmentWithDetailsResponseDto })
  data: AssessmentWithDetailsResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class GetAssessmentsListApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Assessments retrieved successfully' })
  message: string;

  @ApiProperty({ type: AssessmentListResponseDto })
  data: AssessmentListResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class GetQuestionsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Questions retrieved successfully' })
  message: string;

  @ApiProperty({ type: [QuestionWithAnswerDto] })
  data: QuestionWithAnswerDto[];

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class SubmitAnswersApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Answers saved successfully' })
  message: string;

  @ApiProperty({ type: [AssessmentQueryResponseDto] })
  data: AssessmentQueryResponseDto[];

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class UpdateAnswerApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Answer updated successfully' })
  message: string;

  @ApiProperty({ type: AssessmentQueryResponseDto })
  data: AssessmentQueryResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class SubmitAssessmentApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: 'Assessment submitted successfully. AI review in progress.',
  })
  message: string;

  @ApiProperty({ type: AssessmentSubmitResponseDto })
  data: AssessmentSubmitResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class GetScoreApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Score retrieved successfully' })
  message: string;

  @ApiProperty({ type: AssessmentScoreResponseDto })
  data: AssessmentScoreResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}

export class AssessmentBadRequestErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: ['certificate_id must be a valid UUID', 'payment_id is required'],
    description: 'Array of validation error messages',
    type: [String],
  })
  message: string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}

export class AssessmentNotFoundErrorDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'Assessment not found' })
  message: string;

  @ApiProperty({ example: 'Not Found' })
  error: string;
}

export class AssessmentForbiddenErrorDto {
  @ApiProperty({ example: 403 })
  statusCode: number;

  @ApiProperty({ example: 'Access denied to this assessment' })
  message: string;

  @ApiProperty({ example: 'Forbidden' })
  error: string;
}

export class AssessmentUnauthorizedErrorDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'Unauthorized' })
  message: string;
}

export class NestedQuestionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Do you have a fire extinguisher?' })
  question: string;

  @ApiProperty({ example: 'boolean' })
  type: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  hint?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  criteria?: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  options?: string[] | null;

  @ApiProperty({ example: 10 })
  score: number;

  @ApiProperty({ example: 1 })
  rank: number;

  @ApiPropertyOptional({ example: 3 })
  question_number?: number;

  @ApiPropertyOptional({ example: 7 })
  certificate_question_number?: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  parent_question_id: string;

  @ApiProperty({ example: 'yes', enum: ['yes', 'no'] })
  parent_trigger_value: 'yes' | 'no';
}

export class NextQuestionDataDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Do you have safety protocols in place?' })
  question: string;

  @ApiProperty({ example: 'boolean' })
  type: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  hint?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  criteria?: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  options?: string[] | null;

  @ApiProperty({ example: 10 })
  score: number;

  @ApiProperty({ example: 3 })
  question_number: number;

  @ApiProperty({ example: 7 })
  certificate_question_number: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  parent_question_id?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true, enum: ['yes', 'no'] })
  parent_trigger_value?: 'yes' | 'no' | null;

  @ApiProperty({ type: [NestedQuestionDto] })
  yes_sub_questions: NestedQuestionDto[];

  @ApiProperty({ type: [NestedQuestionDto] })
  no_sub_questions: NestedQuestionDto[];
}

export class NextQuestionResultDto {
  @ApiProperty({ example: false })
  done: boolean;

  @ApiPropertyOptional({ type: NextQuestionDataDto, nullable: true })
  question: NextQuestionDataDto | null;
}

export class GetNextQuestionApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Next question retrieved' })
  message: string;

  @ApiProperty({ type: NextQuestionResultDto })
  data: NextQuestionResultDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z', format: 'date-time' })
  timestamp: string;
}
