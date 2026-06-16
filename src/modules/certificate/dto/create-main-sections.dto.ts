import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SectionItemDto {
  @ApiProperty({ example: 'Safety Compliance', description: 'Section name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Section rank (auto-computed if not provided)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;
}

export class CreateMainSectionsDto {
  @ApiProperty({
    type: [SectionItemDto],
    description: 'Array of main sections to create',
    example: [
      { name: 'Safety Compliance' },
      { name: 'Environmental Standards', rank: 2 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionItemDto)
  sections: SectionItemDto[];
}
