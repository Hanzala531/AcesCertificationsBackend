import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'ID of the parent AI review',
    format: 'uuid',
  })
  ai_review_id: string;

  @ApiProperty({
    example: 'Response indicates compliance with safety standards.',
    description: 'AI-generated feedback/analysis for this answer',
  })
  response: string;

  @ApiProperty({
    example: false,
    description: 'Whether this answer has been flagged for non-compliance',
  })
  is_flagged: boolean;

  @ApiPropertyOptional({
    example: 'Response too brief',
    description: 'Reason for flagging (null if not flagged)',
    nullable: true,
  })
  flag_reason: string | null;

  @ApiProperty({
    example: 95.0,
    description: 'AI confidence score (0-100) indicating certainty of analysis',
    minimum: 0,
    maximum: 100,
  })
  confidence_score: number;

  @ApiProperty({
    example: false,
    description: 'Whether this flagged question has been approved by an admin',
  })
  is_question_approved: boolean;

  @ApiProperty({
    example: '2024-01-15T10:32:00.000Z',
    description: 'Timestamp when the AI response was created',
    format: 'date-time',
  })
  created_at: Date;
}

export class AiResponseWithQuestionDto extends AiResponseDto {
  @ApiProperty({
    example: 'Do you have fire safety procedures in place?',
    description: 'The original question text',
  })
  question_text: string;

  @ApiProperty({
    example: 'boolean',
    enum: ['boolean', 'text', 'pdf'],
    description: 'Type of question (boolean, text, or pdf)',
  })
  question_type: string;

  @ApiProperty({
    example: 'boolean',
    enum: ['boolean', 'text', 'pdf'],
    description: 'Type of response provided',
  })
  response_type: string;

  @ApiPropertyOptional({
    example: 'yes',
    description: 'The actual response value submitted by the user',
    nullable: true,
  })
  response_value: string | null;
}

export class AiReviewDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Unique identifier for this AI review',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the certificate assessment being reviewed',
    format: 'uuid',
  })
  certificate_assessment_id: string;

  @ApiPropertyOptional({
    example:
      '45 of 50 responses passed (90%). 5 response(s) flagged for review.',
    description: 'Overall summary of the AI review results',
    nullable: true,
  })
  review_description: string | null;

  @ApiProperty({
    example: 'completed',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    description: 'Current status of the AI review process',
  })
  review_status: string;

  @ApiProperty({
    example: 5,
    description: 'Total number of flagged (non-compliant) responses',
    minimum: 0,
  })
  total_flags: number;

  @ApiPropertyOptional({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Timestamp when the AI review started processing',
    format: 'date-time',
    nullable: true,
  })
  started_at: Date | null;

  @ApiPropertyOptional({
    example: '2024-01-15T10:35:00.000Z',
    description: 'Timestamp when the AI review completed',
    format: 'date-time',
    nullable: true,
  })
  completed_at: Date | null;

  @ApiProperty({
    example: false,
    description: 'Whether a reviewer has been assigned to the assessment',
  })
  is_reviewer_assigned: boolean;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Timestamp when the AI review record was created',
    format: 'date-time',
  })
  created_at: Date;

  @ApiProperty({
    example: '2024-01-15T10:35:00.000Z',
    description: 'Timestamp when the AI review was last updated',
    format: 'date-time',
  })
  updated_at: Date;
}

export class AiReviewWithResponsesDto extends AiReviewDto {
  @ApiProperty({
    type: [AiResponseWithQuestionDto],
    description: 'Array of AI responses for each question in the assessment',
  })
  responses: AiResponseWithQuestionDto[];
}

export class GetAiReviewApiResponseDto {
  @ApiProperty({ example: true, description: 'Indicates successful operation' })
  success: boolean;

  @ApiProperty({
    example: 'AI review retrieved successfully',
    description: 'Human-readable response message',
  })
  message: string;

  @ApiProperty({
    type: AiReviewWithResponsesDto,
    description: 'The AI review data with all responses',
  })
  data: AiReviewWithResponsesDto;

  @ApiProperty({ example: 200, description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({
    example: '2024-01-15T11:00:00.000Z',
    description: 'Response timestamp',
    format: 'date-time',
  })
  timestamp: string;
}

export class FlaggedResponsesDataDto {
  @ApiProperty({
    example: 3,
    description: 'Total count of flagged responses',
    minimum: 0,
  })
  total_flags: number;

  @ApiProperty({
    type: [AiResponseWithQuestionDto],
    description: 'Array of flagged AI responses with question details',
  })
  flags: AiResponseWithQuestionDto[];
}

export class GetFlaggedResponsesApiResponseDto {
  @ApiProperty({ example: true, description: 'Indicates successful operation' })
  success: boolean;

  @ApiProperty({
    example: 'Flagged responses retrieved successfully',
    description: 'Human-readable response message',
  })
  message: string;

  @ApiProperty({
    type: FlaggedResponsesDataDto,
    description: 'The flagged responses data',
  })
  data: FlaggedResponsesDataDto;

  @ApiProperty({ example: 200, description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({
    example: '2024-01-15T11:00:00.000Z',
    description: 'Response timestamp',
    format: 'date-time',
  })
  timestamp: string;
}
