import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateSectionDto {
  @ApiPropertyOptional({
    example: 'Fire Safety',
    description: 'Section name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Section rank',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;
}
