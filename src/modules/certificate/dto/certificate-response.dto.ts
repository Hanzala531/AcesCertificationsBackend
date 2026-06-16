import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CertificateResponseDto<T = any> {
  @ApiProperty({
    example: true,
    description: 'Whether the request was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'Certificate created successfully',
    description: 'Response message',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Response data (varies by endpoint)',
  })
  data?: T;

  @ApiPropertyOptional({
    example: 201,
    description: 'HTTP status code',
  })
  statusCode?: number;

  @ApiPropertyOptional({
    example: '2026-01-12T02:21:55.000Z',
    description: 'Timestamp of the response',
  })
  timestamp?: string;
}

export class CreateCertificateResponseDto {
  @ApiProperty({
    example: 'd026e139-d042-4931-9893-2596541796eb',
    description: 'Certificate ID',
  })
  id: string;

  @ApiProperty({
    example: 'ISO 9001:2015 Certification',
    description: 'Certificate name',
  })
  name: string;

  @ApiProperty({
    example: 'Quality Management System Certification',
    description: 'Certificate description',
  })
  description: string;

  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'Industry IDs',
    type: [String],
  })
  industry_ids: string[];

  @ApiProperty({
    type: 'array',
    example: [
      {
        id: 'badge-id-1',
        name: 'Gold Badge',
        color: '#FFD700',
        slot: 1,
      },
    ],
    description: 'Associated badges',
  })
  badges: Array<{
    id: string;
    name: string;
    color: string;
    slot: number;
  }>;

  @ApiProperty({
    example: '2026-01-12T02:21:55.000Z',
    description: 'Creation timestamp',
  })
  created_at: string;
}

export class CreateMainSectionResponseDto {
  @ApiProperty({
    example: 'main-section-id',
    description: 'Main section ID',
  })
  id: string;

  @ApiProperty({
    example: 'd026e139-d042-4931-9893-2596541796eb',
    description: 'Certificate ID',
  })
  certificate_id: string;

  @ApiProperty({
    example: 'Health and Safety',
    description: 'Section name',
  })
  name: string;

  @ApiProperty({
    example: 1,
    description: 'Section rank/order',
  })
  rank: number;

  @ApiProperty({
    example: '2026-01-12T02:21:55.000Z',
    description: 'Creation timestamp',
  })
  created_at: string;
}

export class CreateSubsectionResponseDto {
  @ApiProperty({
    example: 'subsection-id',
    description: 'Subsection ID',
  })
  id: string;

  @ApiProperty({
    example: 'd026e139-d042-4931-9893-2596541796eb',
    description: 'Certificate ID',
  })
  certificate_id: string;

  @ApiProperty({
    example: 'main-section-id',
    description: 'Parent main section ID',
  })
  main_id: string;

  @ApiProperty({
    example: 'section-id',
    description: 'Parent section ID (for level 3 subsections)',
  })
  section_id?: string;

  @ApiProperty({
    example: 'Fire Safety Measures',
    description: 'Section name',
  })
  name: string;

  @ApiProperty({
    example: 1,
    description: 'Section rank/order',
  })
  rank: number;

  @ApiProperty({
    example: '2026-01-12T02:21:55.000Z',
    description: 'Creation timestamp',
  })
  created_at: string;
}

export class NestedQuestionResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-111111111111' })
  id: string;
  @ApiProperty({ example: 'How many fire extinguishers are on site?' })
  question: string;
  @ApiProperty({ example: 'number', enum: ['boolean','text','multiple_choice','rating','number','file','checkbox'] })
  type: string;
  @ApiPropertyOptional({ example: 'Enter the total count.', nullable: true })
  hint: string | null;
  @ApiPropertyOptional({ example: 'Minimum 1 extinguisher per 200 m².', nullable: true })
  criteria: string | null;
  @ApiPropertyOptional({ example: null, type: [String], nullable: true })
  options: string[] | null;
  @ApiProperty({ example: 30 })
  score: number;
  @ApiProperty({ example: 2 })
  rank: number;
  @ApiPropertyOptional({ example: 2, nullable: true })
  question_number: number | null;
  @ApiProperty({ example: 8 })
  certificate_question_number: number;
  @ApiProperty({ example: 'b1b2c3d4-e5f6-7890-abcd-000000000001', description: 'UUID of parent boolean question' })
  parent_question_id: string;
  @ApiProperty({ example: 'yes', enum: ['yes','no'] })
  parent_trigger_value: 'yes' | 'no';
  @ApiProperty({ type: () => [NestedQuestionResponseDto], description: 'Sub-questions when this boolean answer is YES' })
  yes_sub_questions: NestedQuestionResponseDto[];
  @ApiProperty({ type: () => [NestedQuestionResponseDto], description: 'Sub-questions when this boolean answer is NO' })
  no_sub_questions: NestedQuestionResponseDto[];
  @ApiProperty({ example: '2026-04-01T17:58:18.884Z' })
  created_at: string;
  @ApiProperty({ example: '2026-04-01T17:58:18.884Z' })
  updated_at: string;
}

export class QuestionResponseDto {
  @ApiProperty({ example: 'b1b2c3d4-e5f6-7890-abcd-000000000001' })
  id: string;
  @ApiProperty({ example: 'd026e139-d042-4931-9893-2596541796eb' })
  certificate_id: string;
  @ApiProperty({ example: 'main-section-uuid' })
  main_section_id: string;
  @ApiProperty({ example: 'section-uuid' })
  section_id: string;
  @ApiPropertyOptional({ example: null, nullable: true })
  sub_section_id: string | null;
  @ApiProperty({ example: 'Are all fire extinguishers serviced within the last 12 months?' })
  question: string;
  @ApiPropertyOptional({ example: 'Check the inspection tag on each extinguisher.', nullable: true })
  hint: string | null;
  @ApiProperty({ example: 'boolean', enum: ['boolean','text','multiple_choice','rating','number','file','checkbox'] })
  type: string;
  @ApiProperty({ example: false })
  is_third_level: boolean;
  @ApiPropertyOptional({ example: 'All extinguishers must have a valid service tag.', nullable: true })
  criteria: string | null;
  @ApiPropertyOptional({ example: null, type: [String], nullable: true, description: 'Options for multiple_choice and checkbox types' })
  options: string[] | null;
  @ApiProperty({ example: 50 })
  score: number;
  @ApiProperty({ example: 1 })
  rank: number;
  @ApiProperty({ example: 1 })
  question_number: number;
  @ApiProperty({ example: 7, description: 'Global certificate-wide question number (DFS pre-order)' })
  certificate_question_number: number;
  @ApiPropertyOptional({ example: null, nullable: true, description: 'null for top-level questions' })
  parent_question_id: string | null;
  @ApiPropertyOptional({ example: null, nullable: true, enum: ['yes','no'], description: 'null for top-level questions' })
  parent_trigger_value: 'yes' | 'no' | null;
  @ApiProperty({ example: 'Fire Safety' })
  section_name: string;
  @ApiPropertyOptional({ example: null, nullable: true })
  sub_section_name: string | null;
  @ApiProperty({ type: () => [NestedQuestionResponseDto], description: 'Sub-questions shown when boolean answer is YES. Empty array for non-boolean.' })
  yes_sub_questions: NestedQuestionResponseDto[];
  @ApiProperty({ type: () => [NestedQuestionResponseDto], description: 'Sub-questions shown when boolean answer is NO. Empty array for non-boolean.' })
  no_sub_questions: NestedQuestionResponseDto[];
  @ApiProperty({ example: '2026-04-01T17:58:18.884Z' })
  created_at: string;
  @ApiProperty({ example: '2026-04-01T17:58:18.884Z' })
  updated_at: string;
}

export class CreateQuestionsResponseDto {
  @ApiProperty({
    example: 5,
    description: 'Number of questions created',
  })
  created_count: number;

  @ApiProperty({
    type: [QuestionResponseDto],
    description: 'Details of created questions',
  })
  questions: QuestionResponseDto[];
}

export class DeleteResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the deletion was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'Certificate deleted successfully',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({
    example: 'd026e139-d042-4931-9893-2596541796eb',
    description: 'ID of deleted resource',
  })
  deletedId: string;
}
