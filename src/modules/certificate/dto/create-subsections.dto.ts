import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParentType } from '../types/certificate.types';

export class SubsectionItemDto {
  @ApiProperty({ example: 'Fire Safety', description: 'Subsection name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Subsection rank (auto-computed if not provided)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;
}

export class CreateSubsectionsDto {
  @ApiProperty({
    enum: ParentType,
    example: 'main',
    description:
      'Type of parent: "main" (creates sections) or "section" (creates subsections). sub_sub_section is no longer supported.',
  })
  @IsEnum(ParentType)
  parent_type: ParentType;

  @ApiProperty({
    type: [SubsectionItemDto],
    description: 'Array of sections/subsections to create',
    example: [
      { name: 'Fire Safety' },
      { name: 'Equipment Inspection', rank: 2 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubsectionItemDto)
  sections: SubsectionItemDto[];
}
