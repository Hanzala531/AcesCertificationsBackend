import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CertificationOverviewQueryDto {
  @ApiPropertyOptional({ description: 'Page number for in_progress section', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  in_progress_page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page for in_progress section', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  in_progress_limit?: number = 10;

  @ApiPropertyOptional({ description: 'Page number for active section', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  active_page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page for active section', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  active_limit?: number = 10;

  @ApiPropertyOptional({ description: 'Page number for failed section', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  failed_page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page for failed section', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  failed_limit?: number = 10;

  @ApiPropertyOptional({ description: 'Page number for expired section', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expired_page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page for expired section', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  expired_limit?: number = 10;
}
