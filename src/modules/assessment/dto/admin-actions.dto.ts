import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImproveAndResolveDto {
  @ApiProperty({
    example:
      'Questions 3 and 7 need more detailed evidence. Please upload supporting documents.',
    description: 'Message to the applicant explaining what needs improvement',
  })
  @IsNotEmpty({ message: 'message is required' })
  @IsString({ message: 'message must be a string' })
  @MaxLength(2000, { message: 'message must not exceed 2000 characters' })
  message: string;
}

export class ApproveAssessmentDto {
  @ApiPropertyOptional({
    example:
      'Applicant demonstrated sufficient compliance during manual review',
    description: 'Reason for admin approval',
  })
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(2000, { message: 'reason must not exceed 2000 characters' })
  reason?: string;
}

export class EscalateAssessmentDto {
  @ApiProperty({
    example: 'Suspected fraudulent documentation in uploaded PDFs',
    description: 'Reason for escalating this assessment',
  })
  @IsNotEmpty({ message: 'reason is required' })
  @IsString({ message: 'reason must be a string' })
  @MaxLength(2000, { message: 'reason must not exceed 2000 characters' })
  reason: string;
}

export class ImprovedAnswerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the question being answered',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'questionId must be a valid UUID' })
  @IsNotEmpty({ message: 'questionId is required' })
  questionId: string;

  @ApiProperty({
    example: 'Updated response with more detailed evidence...',
    description: 'Updated response value for the flagged question',
  })
  @IsNotEmpty({ message: 'responseValue is required' })
  @IsString({ message: 'responseValue must be a string' })
  @MaxLength(10000, {
    message: 'responseValue must not exceed 10000 characters',
  })
  responseValue: string;
}

export class SubmitImprovedAnswersDto {
  @ApiProperty({
    type: [ImprovedAnswerDto],
    description:
      'Array of improved answers for flagged questions. At least one answer is required.',
    example: [
      {
        questionId: '550e8400-e29b-41d4-a716-446655440000',
        responseValue: 'Updated response with detailed evidence...',
      },
    ],
  })
  @IsArray({ message: 'answers must be an array' })
  @ArrayMinSize(1, { message: 'At least one answer is required' })
  @ValidateNested({ each: true })
  @Type(() => ImprovedAnswerDto)
  answers: ImprovedAnswerDto[];
}
