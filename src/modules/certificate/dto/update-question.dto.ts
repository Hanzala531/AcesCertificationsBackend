import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../types/certificate.types';
import { ConditionalLogicDto } from './add-questions.dto';

export class UpdateNestedQuestionDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440010',
    description:
      'Existing nested question ID. If provided, that nested question is updated. If omitted, a new nested question is created.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    example: 'Is the fire extinguisher present and accessible?',
    description: 'Question text',
  })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiPropertyOptional({
    enum: QuestionType,
    example: 'boolean',
    description:
      'Question type: boolean, text, multiple_choice, rating, number, file',
  })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({
    example: 'Check for visual presence and accessibility',
    description: 'Optional hint or guidance text',
  })
  @IsOptional()
  @IsString()
  hint?: string;

  @ApiPropertyOptional({
    example: 'Must be visible and accessible within 30 seconds',
    description: 'Evaluation criteria text',
  })
  @IsOptional()
  @IsString()
  criteria?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Enable AI review configuration. When true, ai_review_criteria and ai_review_score are required for non-boolean questions; boolean questions require ai_review_criteria only.',
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
    example: 1,
    description: 'Question rank/order',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;

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
      'Array of option strings for checkbox and multiple_choice type questions. Required when type is "checkbox" or "multiple_choice".',
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
    description: 'Nested sub-questions shown when boolean answer is "yes"',
    type: () => [UpdateNestedQuestionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNestedQuestionDto)
  yes_sub_questions?: UpdateNestedQuestionDto[];

  @ApiPropertyOptional({
    description: 'Nested sub-questions shown when boolean answer is "no"',
    type: () => [UpdateNestedQuestionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNestedQuestionDto)
  no_sub_questions?: UpdateNestedQuestionDto[];
}

export class UpdateQuestionDto {
  @ApiPropertyOptional({
    example: 'Is the fire extinguisher present and accessible?',
    description: 'Question text',
  })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiPropertyOptional({
    enum: QuestionType,
    example: 'boolean',
    description:
      'Question type: boolean, text, multiple_choice, rating, number, file',
  })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({
    example: 'Check for visual presence and accessibility',
    description: 'Optional hint or guidance text',
  })
  @IsOptional()
  @IsString()
  hint?: string;

  @ApiPropertyOptional({
    example: 'Must be visible and accessible within 30 seconds',
    description: 'Evaluation criteria text',
  })
  @IsOptional()
  @IsString()
  criteria?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Enable AI review configuration. When true, ai_review_criteria and ai_review_score are required for non-boolean questions; boolean questions require ai_review_criteria only.',
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
    example: 1,
    description: 'Question rank/order',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Persistent question number within the parent section/subsection.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  question_number?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Global certificate-wide question number.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  certificate_question_number?: number;

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
      'Array of option strings for checkbox and multiple_choice type questions. Required when type is "checkbox" or "multiple_choice".',
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
    description: 'Nested sub-questions shown when boolean answer is "yes"',
    type: () => [UpdateNestedQuestionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNestedQuestionDto)
  yes_sub_questions?: UpdateNestedQuestionDto[];

  @ApiPropertyOptional({
    description: 'Nested sub-questions shown when boolean answer is "no"',
    type: () => [UpdateNestedQuestionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNestedQuestionDto)
  no_sub_questions?: UpdateNestedQuestionDto[];
}
