import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateReviewerNotesDto {
  @ApiProperty({ description: 'Reviewer notes for the assessment query' })
  @IsString()
  reviewerNotes: string;
}

export class UpdateAuditorNotesDto {
  @ApiProperty({ description: 'Auditor notes for the assessment query' })
  @IsString()
  auditorNotes: string;
}

export class ComplianceActionDto {
  @ApiProperty({
    enum: ['request_clarification'],
    description: 'Compliance action to perform on this question',
  })
  @IsEnum(['request_clarification'])
  action: 'request_clarification';

  @ApiProperty({ description: 'Message to send to the assessment chat thread' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    enum: ['applicant', 'reviewer'],
    description:
      'Who the clarification is directed at. Only applicable when action is request_clarification and the user is an auditor. Defaults to applicant.',
  })
  @IsOptional()
  @IsEnum(['applicant', 'reviewer'])
  clarificationTarget?: 'applicant' | 'reviewer';
}

export class UpsertAuditDto {
  @ApiPropertyOptional({ description: 'Audit summary text' })
  @IsOptional()
  @IsString()
  auditSummary?: string;

  @ApiPropertyOptional({ description: 'URL or path to audit summary document' })
  @IsOptional()
  @IsString()
  auditSummaryDoc?: string;

  @ApiPropertyOptional({ description: 'Detailed audit description' })
  @IsOptional()
  @IsString()
  auditDescription?: string;

  @ApiPropertyOptional({
    enum: ['approved', 'conditionally_approved', 'rejected'],
    description: 'Audit decision status',
  })
  @IsOptional()
  @IsEnum(['approved', 'conditionally_approved', 'rejected'])
  status?: 'approved' | 'conditionally_approved' | 'rejected';
}

export class UpsertReviewDto {
  @ApiPropertyOptional({ description: 'Reviewer summary text' })
  @IsOptional()
  @IsString()
  reviewSummary?: string;

  @ApiPropertyOptional({
    description: 'URL or path to review summary document',
  })
  @IsOptional()
  @IsString()
  reviewSummaryDoc?: string;

  @ApiPropertyOptional({
    description: 'Detailed review description and final remarks',
  })
  @IsOptional()
  @IsString()
  reviewDescription?: string;

  @ApiPropertyOptional({
    enum: ['approved', 'conditionally_approved', 'rejected'],
    description: 'Reviewer final decision status',
  })
  @IsOptional()
  @IsEnum(['approved', 'conditionally_approved', 'rejected'])
  reviewStatus?: 'approved' | 'conditionally_approved' | 'rejected';
}

export class IssueCertificateDto {}

export class BlockCertificateDto {
  @ApiProperty({ description: 'Reason for blocking the certificate' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class GetAuditorAuditsQueryDto {
  @ApiPropertyOptional({
    description:
      'Auditor profile ID. Required for admin/subadmin. Auditors use their token instead.',
  })
  @IsOptional()
  @IsUUID()
  auditorProfileId?: string;

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
