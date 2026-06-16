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

export class CreateCertificateDto {
  @ApiProperty({
    example: 'CERT-2024-001',
    description: 'Unique certificate identifier',
  })
  @IsString()
  @IsNotEmpty()
  certificate_id: string;

  @ApiProperty({
    example: 'EW',
    description:
      'Manual root short code entered by admin. Child hierarchy codes are generated from this value.',
  })
  @IsString()
  @IsNotEmpty()
  short_code: string;

  @ApiProperty({ example: 'Safety Compliance Certificate' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'Array of industry UUIDs',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  industry_ids: string[];

  @ApiProperty({ example: 1500.0, description: 'Disclosure price' })
  @IsNumber()
  @Min(0)
  disclosure_price: number;

  @ApiPropertyOptional({ example: 2000.0, description: 'Assured price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  assured_price?: number;

  @ApiPropertyOptional({ example: 0, description: 'Validity in days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  validity_days?: number;

  @ApiPropertyOptional({ example: 0, description: 'Validity in months' })
  @IsOptional()
  @IsInt()
  @Min(0)
  validity_months?: number;

  @ApiPropertyOptional({ example: 1, description: 'Validity in years' })
  @IsOptional()
  @IsInt()
  @Min(0)
  validity_years?: number;

  @ApiPropertyOptional({
    example: ['ISO Certificate', 'Business License'],
    description: 'List of compulsory documents',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compulsory_docs?: string[];

  @ApiPropertyOptional({ example: 'Annual safety audit certificate' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the certificate is published and visible/usable',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @ApiProperty({
    type: [BadgeDto],
    description: 'Exactly 3 badges with 1-4 colors each',
    example: [
      {
        slot: 1,
        name: 'Gold',
        colors: [
          { color: '#FFD700', min_score: 90, max_score: 100 },
          { color: '#FFA500', min_score: 80, max_score: 89 },
        ],
      },
      {
        slot: 2,
        name: 'Silver',
        colors: [{ color: '#C0C0C0', min_score: 70, max_score: 79 }],
      },
      {
        slot: 3,
        name: 'Bronze',
        colors: [{ color: '#CD7F32', min_score: 50, max_score: 69 }],
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => BadgeDto)
  @Validate(ExactlyThreeBadgesValidator)
  @Validate(UniqueBadgeSlotsValidator)
  @Validate(UniqueBadgeNamesValidator)
  @Validate(UniqueColorsPerBadgeValidator)
  @Validate(ValidScoreRangesValidator)
  badges: BadgeDto[];
}
