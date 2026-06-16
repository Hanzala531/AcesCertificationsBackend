import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsString,
  IsNumber,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReviewerAiFlagsQueryDto {
  @ApiPropertyOptional({
    enum: ['open', 'pending', 'escalated', 'resolved'],
    description: 'Filter by flag status',
  })
  @IsOptional()
  @IsEnum(['open', 'pending', 'escalated', 'resolved'])
  status?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class ReviewFlagActionDto {
  @ApiProperty({
    enum: ['accepted', 'rejected'],
    description: 'Accept (AI was wrong, answer is correct) or reject (AI was right, answer has issues)',
  })
  @IsEnum(['accepted', 'rejected'])
  action: 'accepted' | 'rejected';

  @ApiPropertyOptional({
    description: 'Notes explaining the decision',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SubmitReviewerReviewDto {
  @ApiPropertyOptional({
    description: 'Optional overall score override (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  adjustedScore?: number;
}

export class AssignReviewerToFlaggedDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The reviewer ID to assign to this flagged assessment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  reviewerId: string;
}

export class ReviewerAiFlagItemDto {
  @ApiProperty({ format: 'uuid' })
  reviewId: string;

  @ApiProperty({ format: 'uuid' })
  assessmentId: string;

  @ApiProperty({ format: 'uuid' })
  certificateId: string;

  @ApiProperty({ example: 'ISO 9001:2015' })
  certificateName: string;

  @ApiProperty({ example: 'TechCorp Inc' })
  organizationName: string;

  @ApiPropertyOptional({ nullable: true })
  branchName: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Certificate product ID' })
  productId: string | null;

  @ApiProperty({ example: 'self_disclosure' })
  assessmentType: string;

  @ApiPropertyOptional({ example: 72.5, nullable: true })
  aiScore: number | null;

  @ApiProperty({ example: 3 })
  totalFlags: number;

  @ApiProperty({ example: 'open' })
  flagStatus: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Assigned auditor details if any',
  })
  auditor: {
    id: string;
    name: string;
    email: string;
  } | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  reviewerSubmittedAt: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ example: 20, description: 'Total questions in the certificate' })
  totalQuestions: number;

  @ApiProperty({ example: 18, description: 'Total questions attempted by the applicant' })
  totalAttempted: number;
}
