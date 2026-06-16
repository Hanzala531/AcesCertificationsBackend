import { IsOptional, IsNumberString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum BranchStatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum BranchTypeFilter {
  ALL = 'all',
  MAIN = 'main',
  SUB = 'sub',
}

export class BranchesQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Results per page', default: '10' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({
    description: 'Filter by branch type',
    enum: BranchTypeFilter,
    default: BranchTypeFilter.ALL,
  })
  @IsOptional()
  @IsEnum(BranchTypeFilter)
  type?: BranchTypeFilter;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: BranchStatusFilter,
    default: BranchStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(BranchStatusFilter)
  status?: BranchStatusFilter;
}
