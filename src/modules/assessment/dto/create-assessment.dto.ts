import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export enum AssessmentType {
  SELF_DISCLOSURE = 'self_disclosure',
  ASSURED = 'assured',
}

export class CreateAssessmentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the certificate to assess',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'certificate_id must be a valid UUID' })
  @IsNotEmpty({ message: 'certificate_id is required' })
  certificate_id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description:
      'UUID of the completed payment. Payment must be confirmed (is_paid=true)',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'payment_id must be a valid UUID' })
  @IsNotEmpty({ message: 'payment_id is required' })
  payment_id: string;

  @ApiProperty({
    enum: AssessmentType,
    enumName: 'AssessmentType',
    example: AssessmentType.SELF_DISCLOSURE,
    description: 'Type of assessment. Must match the payment type.',
  })
  @IsEnum(AssessmentType, {
    message: 'assessment_type must be either self_disclosure or assured',
  })
  @IsNotEmpty({ message: 'assessment_type is required' })
  assessment_type: AssessmentType;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description:
      'UUID of the branch. Required for organization_member role, optional for organization role.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'branch_id must be a valid UUID' })
  branch_id?: string;
}
