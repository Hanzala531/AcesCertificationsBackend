import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Validate,
  IsInt,
  Min,
  IsBoolean,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BadgeDto } from './badge.dto';
import {
  ExactlyThreeBadgesValidator,
  UniqueBadgeSlotsValidator,
  UniqueBadgeNamesValidator,
  UniqueColorsPerBadgeValidator,
  ValidScoreRangesValidator,
} from '../validators/badge.validators';
import { QuestionType } from '../types/certificate.types';

// ── Step 1: Complete Structure ──────────────────────────────────────────────

class DevSubSectionDto {
  @ApiProperty({ example: 'Fire Safety Equipment' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

class DevSectionDto {
  @ApiProperty({ example: 'Fire Safety' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ type: [DevSubSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevSubSectionDto)
  sub_sections?: DevSubSectionDto[];
}

class DevMainSectionDto {
  @ApiProperty({ example: 'Safety Compliance' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: [DevSectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DevSectionDto)
  sections: DevSectionDto[];
}

export class DevCreateCertificateDto {
  @ApiProperty({ example: 'CERT-DEV-001' })
  @IsString()
  @IsNotEmpty()
  certificate_id: string;

  @ApiProperty({ example: 'EW' })
  @IsString()
  @IsNotEmpty()
  short_code: string;

  @ApiProperty({ example: 'Safety Compliance Certificate' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  industry_ids: string[];

  @ApiProperty({ example: 1500.0 })
  @IsNumber()
  @Min(0)
  disclosure_price: number;

  @ApiPropertyOptional({ example: 2000.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  assured_price?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  validity_days?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  validity_months?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  validity_years?: number;

  @ApiPropertyOptional({ example: ['ISO Certificate', 'Business License'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compulsory_docs?: string[];

  @ApiPropertyOptional({ example: 'Annual safety audit certificate' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @ApiProperty({ type: [BadgeDto] })
  @ValidateNested({ each: true })
  @Type(() => BadgeDto)
  @Validate(ExactlyThreeBadgesValidator)
  @Validate(UniqueBadgeSlotsValidator)
  @Validate(UniqueBadgeNamesValidator)
  @Validate(UniqueColorsPerBadgeValidator)
  @Validate(ValidScoreRangesValidator)
  badges: BadgeDto[];

  @ApiProperty({ type: [DevMainSectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DevMainSectionDto)
  main_sections: DevMainSectionDto[];
}

// ── Step 2: Bulk Questions ──────────────────────────────────────────────────

class DevQuestionItemDto {
  @ApiProperty({ example: 'Is the fire extinguisher present and accessible?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ enum: QuestionType, example: 'boolean' })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiPropertyOptional({
    example: 'Check if the fire extinguisher is within reach',
  })
  @IsOptional()
  @IsString()
  hint?: string;

  @ApiPropertyOptional({ example: 'Must be visible and accessible' })
  @IsOptional()
  @IsString()
  criteria?: string;

  @ApiPropertyOptional({
    example: ['Fire Safety', 'Electrical Safety'],
    description: 'Array of option strings for checkbox type questions',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

class DevBulkQuestionEntryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID('4')
  @IsNotEmpty()
  section_id: string;

  @ApiProperty({ type: [DevQuestionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DevQuestionItemDto)
  questions: DevQuestionItemDto[];
}

export class DevBulkQuestionsDto {
  @ApiProperty({ type: [DevBulkQuestionEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DevBulkQuestionEntryDto)
  entries: DevBulkQuestionEntryDto[];
}
