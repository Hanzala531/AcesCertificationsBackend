import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateMainSectionDto {
  @ApiPropertyOptional({
    example: 'Safety Compliance',
    description: 'Main section name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Main section rank',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;
}
