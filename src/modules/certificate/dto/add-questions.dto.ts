import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsEnum,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ConditionalTargetType,
  QuestionType,
  SectionType,
} from '../types/certificate.types';

class ConditionalLogicTargetDto {
  @ApiProperty({
    enum: ConditionalTargetType,
    example: ConditionalTargetType.SECTION,
    description:
      'Target type for a conditional action: main_section, section, sub_section, or question',
  })
  @IsEnum(ConditionalTargetType)
  target_type: ConditionalTargetType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID of the selected main section, section, subsection, or question',
  })
  @IsUUID('4')
  target_id: string;
}

class ConditionalLogicActionDto {
  @ApiPropertyOptional({
    description: 'Where the applicant should be redirected for this answer',
    type: () => ConditionalLogicTargetDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionalLogicTargetDto)
  redirect_to?: ConditionalLogicTargetDto | null;

  @ApiPropertyOptional({
    description: 'Sections/subsections/questions to block for this answer',
    type: () => [ConditionalLogicTargetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionalLogicTargetDto)
  blocked_sections?: ConditionalLogicTargetDto[];

  @ApiPropertyOptional({
    description: 'Sections/subsections/questions to allow for this answer',
    type: () => [ConditionalLogicTargetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionalLogicTargetDto)
  allowed_sections?: ConditionalLogicTargetDto[];
}

export class ConditionalLogicDto {
  @ApiPropertyOptional({
    description: 'Conditional actions when the applicant answers yes',
    type: () => ConditionalLogicActionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionalLogicActionDto)
  yes?: ConditionalLogicActionDto;

  @ApiPropertyOptional({
    description: 'Conditional actions when the applicant answers no',
    type: () => ConditionalLogicActionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionalLogicActionDto)
  no?: ConditionalLogicActionDto;
}

export class SubQuestionItemDto {
  @ApiProperty({
    example: 'Is the fire extinguisher present and accessible?',
    description: 'Question text',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    enum: QuestionType,
    example: 'boolean',
    description:
      'Question type: boolean, text, multiple_choice, rating, number, file',
  })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiPropertyOptional({
    example: 1,
    description: 'Question rank/order (auto-computed if not provided)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;

  @ApiPropertyOptional({
    example: 'Check if the fire extinguisher is within reach and not expired',
    description: 'Hint or help text for the question',
  })
  @IsOptional()
  @IsString()
  hint?: string;

  @ApiPropertyOptional({
    description: 'Text description of evaluation criteria',
    example:
      'Fire extinguisher must be visible, accessible, and inspection tag current within 12 months',
  })
  @IsOptional()
  @IsString()
  criteria?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Enable AI review configuration for this question. When true, ai_review_criteria and ai_review_score are required for non-boolean questions; boolean questions require ai_review_criteria only.',
  })
  @IsOptional()
  @IsBoolean()
  ai_review_enabled?: boolean;

  @ApiPropertyOptional({
    example: 'Answer must describe current evidence and compliance controls',
    description: 'Evaluation rules used by AI review when ai_review_enabled is true',
  })
  @IsOptional()
  @IsString()
  ai_review_criteria?: string;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    maximum: 9999,
    description: 'AI review score for non-boolean questions when AI review is enabled',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  ai_review_score?: number;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    maximum: 9999,
    description: 'Score applied when a boolean question is answered yes',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  yes_score?: number;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    maximum: 9999,
    description: 'Score applied when a boolean question is answered no',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  no_score?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable yes/no conditional navigation and allow/block rules',
  })
  @IsOptional()
  @IsBoolean()
  conditional_logic_enabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Conditional actions for yes/no answers. Only valid for boolean questions when conditional_logic_enabled is true.',
    type: () => ConditionalLogicDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionalLogicDto)
  conditional_logic?: ConditionalLogicDto;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    maximum: 999,
    description: 'Question score value (0-999). Used for final percentage calculation.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  score?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, the applicant must answer this question; it cannot be skipped. Enforced on assessment submit.',
  })
  @IsOptional()
  @IsBoolean()
  is_compulsory?: boolean;

  @ApiPropertyOptional({
    example: ['Fire Safety', 'Electrical Safety'],
    description: 'Array of option strings for checkbox and multiple_choice type questions.',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'options must be an array' })
  @ArrayMinSize(1, {
    message: 'options must have at least 1 item for checkbox questions',
  })
  @IsString({ each: true, message: 'Each option must be a string' })
  options?: string[];

  @ApiPropertyOptional({
    description: 'Sub-questions shown when boolean answer is "yes"',
    type: () => [SubQuestionItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubQuestionItemDto)
  yes_sub_questions?: SubQuestionItemDto[];

  @ApiPropertyOptional({
    description: 'Sub-questions shown when boolean answer is "no"',
    type: () => [SubQuestionItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubQuestionItemDto)
  no_sub_questions?: SubQuestionItemDto[];
}

export class QuestionItemDto {
  @ApiProperty({
    example: 'Is the fire extinguisher present and accessible?',
    description: 'Question text',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    enum: QuestionType,
    example: 'boolean',
    description:
      'Question type: boolean, text, multiple_choice, rating, number, file',
  })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiPropertyOptional({
    example: 1,
    description: 'Question rank/order (auto-computed if not provided)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Persistent question number to assign within the parent (section/subsection). If omitted, next available number is used.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  question_number?: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Global certificate-wide question number. If omitted, assigned automatically by backend.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  certificate_question_number?: number;

  @ApiPropertyOptional({
    example: 'Check if the fire extinguisher is within reach and not expired',
    description: 'Hint or help text for the question',
  })
  @IsOptional()
  @IsString()
  hint?: string;

  @ApiPropertyOptional({
    description: 'Text description of evaluation criteria',
    example:
      'Fire extinguisher must be visible, accessible, and inspection tag current within 12 months',
  })
  @IsOptional()
  @IsString()
  criteria?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Enable AI review configuration for this question. When true, ai_review_criteria and ai_review_score are required for non-boolean questions; boolean questions require ai_review_criteria only.',
  })
  @IsOptional()
  @IsBoolean()
  ai_review_enabled?: boolean;

  @ApiPropertyOptional({
    example: 'Answer must describe current evidence and compliance controls',
    description: 'Evaluation rules used by AI review when ai_review_enabled is true',
  })
  @IsOptional()
  @IsString()
  ai_review_criteria?: string;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    maximum: 9999,
    description: 'AI review score for non-boolean questions when AI review is enabled',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  ai_review_score?: number;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    maximum: 9999,
    description: 'Score applied when a boolean question is answered yes',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  yes_score?: number;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    maximum: 9999,
    description: 'Score applied when a boolean question is answered no',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  no_score?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable yes/no conditional navigation and allow/block rules',
  })
  @IsOptional()
  @IsBoolean()
  conditional_logic_enabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Conditional actions for yes/no answers. Only valid for boolean questions when conditional_logic_enabled is true.',
    type: () => ConditionalLogicDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionalLogicDto)
  conditional_logic?: ConditionalLogicDto;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    maximum: 999,
    description: 'Question score value (0-999). Used for final percentage calculation.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  score?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, the applicant must answer this question; it cannot be skipped. Enforced on assessment submit.',
  })
  @IsOptional()
  @IsBoolean()
  is_compulsory?: boolean;

  @ApiPropertyOptional({
    example: ['Fire Safety', 'Electrical Safety', 'Chemical Safety'],
    description:
      'Array of option strings for checkbox and multiple_choice type questions. Required when type is "checkbox" or "multiple_choice". Each option represents a selectable choice.',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'options must be an array' })
  @ArrayMinSize(1, {
    message: 'options must have at least 1 item for checkbox questions',
  })
  @IsString({ each: true, message: 'Each option must be a string' })
  options?: string[];

  @ApiPropertyOptional({
    description: 'Sub-questions shown when boolean answer is "yes"',
    type: [SubQuestionItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubQuestionItemDto)
  yes_sub_questions?: SubQuestionItemDto[];

  @ApiPropertyOptional({
    description: 'Sub-questions shown when boolean answer is "no"',
    type: [SubQuestionItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubQuestionItemDto)
  no_sub_questions?: SubQuestionItemDto[];
}

export class AddQuestionsDto {
  @ApiProperty({
    enum: SectionType,
    example: 'sub_section',
    description:
      'Target section type: "section" (Level 2, is_third_level=false) or "sub_section" (Level 3, is_third_level=true)',
  })
  @IsEnum(SectionType)
  section_type: SectionType;

  @ApiProperty({
    type: [QuestionItemDto],
    description: 'Array of questions to add',
    example: [
      {
        question: 'Is the fire extinguisher present?',
        type: 'boolean',
        hint: 'Check for visual presence',
        criteria: 'Must be visible and accessible',
        score: 100,
      },
      {
        question: 'Describe the condition of safety equipment',
        type: 'text',
        hint: 'Provide detailed description',
        criteria: 'Note any visible defects or damage',
        score: 50,
      },
      {
        question: 'Upload the safety inspection certificate',
        type: 'file',
        hint: 'Upload a PDF document of the inspection certificate',
        criteria: 'Certificate must be valid and within the last 12 months',
        score: 10,
      },
      {
        question: 'How many fire extinguishers are present?',
        type: 'number',
        hint: 'Enter the total count',
        score: 30,
      },
      {
        question: 'Which safety measures are implemented?',
        type: 'checkbox',
        hint: 'Select all that apply',
        options: ['Fire Safety', 'Electrical Safety', 'Chemical Safety', 'First Aid'],
        score: 50,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  questions: QuestionItemDto[];
}
