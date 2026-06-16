import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetInvitationsQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'accepted', 'declined'] })
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'accepted', 'declined'])
  status?: 'pending' | 'accepted' | 'declined';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
