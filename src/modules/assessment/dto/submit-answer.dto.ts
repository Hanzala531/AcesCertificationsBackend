import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ResponseType {
  PDF = 'pdf',
  BOOLEAN = 'boolean',
  TEXT = 'text',
  NUMBER = 'number',
  CHECKBOX = 'checkbox',
  MULTIPLE_CHOICE = 'multiple_choice',
  RATING = 'rating',
}

export class AnswerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the question being answered',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'question_id must be a valid UUID' })
  @IsNotEmpty({ message: 'question_id is required' })
  question_id: string;

  @ApiProperty({
    enum: ResponseType,
    enumName: 'ResponseType',
    example: ResponseType.TEXT,
    description: `Type of response:
- **pdf**: File URL pointing to uploaded PDF document
- **boolean**: "yes" or "no" string value
- **text**: Free-form text description
- **number**: Numeric value as a string
- **checkbox**: JSON array of selected option strings
- **multiple_choice**: Single selected option string
- **rating**: Numeric rating value as a string (e.g., "1" to "5")`,
  })
  @IsEnum(ResponseType, {
    message:
      'response_type must be pdf, boolean, text, number, checkbox, multiple_choice, or rating',
  })
  @IsNotEmpty({ message: 'response_type is required' })
  response_type: ResponseType;

  @ApiPropertyOptional({
    example: 'We have implemented comprehensive safety protocols including...',
    description: `Response value based on type:
- **pdf**: URL to uploaded file (e.g., "https://storage.example.com/doc.pdf")
- **boolean**: "yes" or "no"
- **text**: Free-form text content
- **number**: Numeric value as string (e.g., "42", "3.14")
- **checkbox**: JSON array of selected options (e.g., '["Option A","Option C"]')
- **multiple_choice**: Single selected option string (e.g., "Option B")
- **rating**: Rating value as string (e.g., "4")`,
  })
  @IsOptional()
  @IsString({ message: 'response_value must be a string' })
  @MaxLength(10000, {
    message: 'response_value must not exceed 10000 characters',
  })
  response_value?: string;

  @ApiPropertyOptional({
    example: [
      'https://storage.example.com/doc1.pdf',
      'https://storage.example.com/doc2.pdf',
    ],
    description:
      'Array of additional file URLs for PDF type questions. Maximum 3 files allowed.',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'response_files must be an array' })
  @ArrayMaxSize(3, { message: 'response_files cannot exceed 3 files' })
  @IsString({ each: true, message: 'Each file URL must be a string' })
  response_files?: string[];
}

export class SubmitAnswersDto {
  @ApiProperty({
    type: [AnswerDto],
    description: 'Array of answers to submit. At least one answer is required.',
    example: [
      {
        question_id: '550e8400-e29b-41d4-a716-446655440000',
        response_type: 'boolean',
        response_value: 'yes',
      },
      {
        question_id: '550e8400-e29b-41d4-a716-446655440001',
        response_type: 'text',
        response_value: 'Our safety procedures include regular inspections...',
      },
      {
        question_id: '550e8400-e29b-41d4-a716-446655440002',
        response_type: 'pdf',
        response_files: [
          'https://storage.example.com/safety-report.pdf',
          'https://storage.example.com/inspection-checklist.pdf',
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
        response_value: '["Fire Safety","Electrical Safety","Chemical Safety"]',
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
  })
  @IsArray({ message: 'answers must be an array' })
  @ArrayMinSize(1, { message: 'At least one answer is required' })
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

export class UpdateAnswerDto {
  @ApiProperty({
    enum: ResponseType,
    enumName: 'ResponseType',
    example: ResponseType.TEXT,
    description: 'Updated response type',
  })
  @IsEnum(ResponseType, {
    message:
      'response_type must be pdf, boolean, text, number, checkbox, multiple_choice, or rating',
  })
  @IsNotEmpty({ message: 'response_type is required' })
  response_type: ResponseType;

  @ApiPropertyOptional({
    example: 'Updated response with more detailed information...',
    description: 'Updated response value',
  })
  @IsOptional()
  @IsString({ message: 'response_value must be a string' })
  @MaxLength(10000, {
    message: 'response_value must not exceed 10000 characters',
  })
  response_value?: string;

  @ApiPropertyOptional({
    example: [
      'https://storage.example.com/doc1.pdf',
      'https://storage.example.com/doc2.pdf',
    ],
    description:
      'Array of file URLs for PDF type questions. Maximum 3 files allowed.',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'response_files must be an array' })
  @ArrayMaxSize(3, { message: 'response_files cannot exceed 3 files' })
  @IsString({ each: true, message: 'Each file URL must be a string' })
  response_files?: string[];
}
