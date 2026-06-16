import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class AssignAssessmentDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Assessment UUID to assign reviewer to',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'assessmentId must be a valid UUID' })
  @IsNotEmpty({ message: 'assessmentId is required' })
  assessmentId: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description:
      'Reviewer UUID (reviewer.id, not user_id). Pass null to unassign.',
    format: 'uuid',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.reviewerId !== null)
  @IsUUID('4', { message: 'reviewerId must be a valid UUID when provided' })
  reviewerId: string | null;
}

export class AssignAssessmentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Reviewer assigned successfully' })
  message: string;

  @ApiProperty({
    example: {
      assessmentId: '123e4567-e89b-12d3-a456-426614174000',
      reviewerId: '123e4567-e89b-12d3-a456-426614174001',
      reviewerName: 'Jane Smith',
    },
  })
  data: {
    assessmentId: string;
    reviewerId: string | null;
    reviewerName: string | null;
  };
}
