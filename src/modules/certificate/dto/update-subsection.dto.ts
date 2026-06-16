import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateSubsectionDto {
  @ApiPropertyOptional({
    example: 'Equipment Inspection',
    description: 'Subsection name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Subsection rank',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;
}
