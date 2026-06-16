import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  IsDateString,
} from 'class-validator';

export class AssignAssessmentDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Assessment UUID to assign auditor to',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'assessmentId must be a valid UUID' })
  @IsNotEmpty({ message: 'assessmentId is required' })
  assessmentId: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description:
      'Auditor UUID (auditor.id, not user_id). Pass null to unassign.',
    format: 'uuid',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.auditorId !== null)
  @IsUUID('4', { message: 'auditorId must be a valid UUID when provided' })
  auditorId: string | null;

  @ApiProperty({
    example: '2026-02-10T10:00:00.000Z',
    description:
      'Scheduled audit date (ISO 8601). Optional when assigning an auditor.',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'auditDate must be a valid ISO 8601 date string' },
  )
  auditDate?: string;
}

export class AssignAssessmentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Auditor assigned successfully' })
  message: string;

  @ApiProperty({
    example: {
      assessmentId: '123e4567-e89b-12d3-a456-426614174000',
      auditorId: '123e4567-e89b-12d3-a456-426614174001',
      auditorName: 'John Doe',
      auditDate: '2026-02-10T10:00:00.000Z',
    },
  })
  data: {
    assessmentId: string;
    auditorId: string | null;
    auditorName: string | null;
    auditDate: string | null;
    invited?: boolean;
  };
}
