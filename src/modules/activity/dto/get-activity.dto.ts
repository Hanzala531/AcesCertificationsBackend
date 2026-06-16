import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ActivityType {
  AUTH = 'auth',
  RESOURCE = 'resource',
  TRANSACTION = 'transaction',
  PAYMENT = 'payment',
  ASSESSMENT = 'assessment',
  COMMUNICATION = 'communication',
  ADMIN = 'admin',
  AUDIT = 'audit',
  SYSTEM = 'system',
}

export class GetActivityDto {
  @ApiPropertyOptional({
    enum: ActivityType,
    description: 'Optional category filter',
  })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
