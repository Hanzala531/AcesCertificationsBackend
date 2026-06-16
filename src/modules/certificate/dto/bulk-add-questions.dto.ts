import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SectionType } from '../types/certificate.types';
import { QuestionItemDto } from './add-questions.dto';

export class BulkQuestionEntryDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID of the section or sub-section to add questions to',
  })
  @IsUUID('4')
  @IsNotEmpty()
  section_id: string;

  @ApiProperty({
    enum: SectionType,
    example: 'sub_section',
    description:
      '"section" (Level 2, is_third_level=false) or "sub_section" (Level 3, is_third_level=true)',
  })
  @IsEnum(SectionType)
  section_type: SectionType;

  @ApiProperty({
    type: [QuestionItemDto],
    description: 'Questions to add to this section/sub-section',
    example: [
      {
        question: 'Is the fire extinguisher present?',
        type: 'boolean',
        hint: 'Check for visual presence',
        criteria: 'Must be visible and accessible',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  questions: QuestionItemDto[];
}

export class BulkAddQuestionsDto {
  @ApiProperty({
    type: [BulkQuestionEntryDto],
    description:
      'Array of entries, each targeting a different section or sub-section with its questions',
    example: [
      {
        section_id: '550e8400-e29b-41d4-a716-446655440001',
        section_type: 'section',
        questions: [
          {
            question: 'Do you have a fire safety plan?',
            type: 'boolean',
            hint: 'Check if a written plan exists',
            criteria: 'A documented fire safety plan must be present',
          },
        ],
      },
      {
        section_id: '550e8400-e29b-41d4-a716-446655440002',
        section_type: 'sub_section',
        questions: [
          {
            question: 'Is the fire extinguisher inspected monthly?',
            type: 'boolean',
          },
          {
            question: 'Describe the last fire drill conducted',
            type: 'text',
            hint: 'Include date, participants, and findings',
          },
        ],
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkQuestionEntryDto)
  entries: BulkQuestionEntryDto[];
}
