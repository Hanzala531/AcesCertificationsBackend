import {
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsNumberString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SearchType {
  ALL = 'all',
  ORGANIZATION = 'organization',
  CERTIFICATE = 'certificate',
}

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Search query text (matches organization name, certificate name, industry name, description, etc.)',
    example: 'ISO',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Type of results to return',
    enum: SearchType,
    default: SearchType.ALL,
  })
  @IsOptional()
  @IsEnum(SearchType)
  type?: SearchType;

  @ApiPropertyOptional({
    description: 'Filter by country name',
    example: 'United States',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by industry ID',
    example: 'uuid-of-industry',
  })
  @IsOptional()
  @IsUUID()
  industry_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by organization ID',
    example: 'uuid-of-organization',
  })
  @IsOptional()
  @IsUUID()
  organization_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by certificate definition ID',
    example: 'uuid-of-certificate',
  })
  @IsOptional()
  @IsUUID()
  certificate_id?: string;

  @ApiPropertyOptional({ description: 'Page number', default: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Results per page', default: '10' })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
