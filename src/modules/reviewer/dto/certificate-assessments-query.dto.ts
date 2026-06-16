import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReviewerAssessmentStatus {
  AI_FLAGGED = 'ai_flagged',
  UNDER_REVIEWER = 'under_reviewer',
  ASSIGNED_TO_AUDITOR = 'assigned_to_auditor',
  AUDIT_COMPLETED = 'audit_completed',
  APPROVED = 'approved',
  BLOCKED = 'blocked',
}

export class CertificateAssessmentsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 100,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class CertificateAssessmentItemDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    format: 'uuid',
    description: 'Assessment ID',
  })
  assessmentId: string;

  @ApiProperty({
    example: 'd8f2c5a1-9b3e-4a2c-8f1d-2e3c4b5a6f7a',
    format: 'uuid',
  })
  organizationId: string;

  @ApiProperty({ example: 'TechCorp Inc' })
  organizationName: string;

  @ApiPropertyOptional({
    example: 'f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
    format: 'uuid',
    nullable: true,
  })
  branchId: string | null;

  @ApiPropertyOptional({ example: 'Head Office', nullable: true })
  branchName: string | null;

  @ApiProperty({
    example: 'c1b2a3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    format: 'uuid',
  })
  certificateId: string;

  @ApiProperty({ example: 'ISO 9001:2015 Quality Management' })
  certificateName: string;

  @ApiPropertyOptional({
    example: 'p1b2a3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    format: 'uuid',
    nullable: true,
    description: 'Product ID if available from schema',
  })
  productId: string | null;

  @ApiProperty({ example: 3, description: 'Count of AI flags on this assessment' })
  totalAiFlags: number;

  @ApiProperty({
    enum: ReviewerAssessmentStatus,
    example: ReviewerAssessmentStatus.UNDER_REVIEWER,
    description:
      'Derived status with precedence: blocked > approved > audit_completed > assigned_to_auditor > under_reviewer > ai_flagged',
  })
  status: ReviewerAssessmentStatus;

  @ApiProperty({
    example: '2026-02-01T10:00:00.000Z',
    format: 'date-time',
    description: 'Date when the assessment was assigned to the reviewer',
  })
  assignedDate: string;
}

export class GetReviewerAuditsQueryDto {
  @ApiPropertyOptional({
    enum: ['pending', 'in_progress', 'submitted', 'rejected', 'completed'],
    description: 'Filter by computed audit status',
  })
  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'submitted', 'rejected', 'completed'])
  lifecycleStatus?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (default: 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Items per page (default: 10)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CertificateAssessmentsPaginatedResponseDto {
  @ApiProperty({ example: 'Certificate assessments retrieved successfully' })
  message: string;

  @ApiProperty({ type: [CertificateAssessmentItemDto] })
  items: CertificateAssessmentItemDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
