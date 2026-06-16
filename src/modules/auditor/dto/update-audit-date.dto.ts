import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class UpdateAuditDateDto {
  @ApiProperty({
    example: '2026-02-15T14:30:00.000Z',
    description: 'Scheduled audit date (ISO 8601).',
  })
  @IsNotEmpty({ message: 'auditDate is required' })
  @IsDateString(
    {},
    { message: 'auditDate must be a valid ISO 8601 date string' },
  )
  auditDate: string;
}

export class UpdateAuditDateResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Audit date updated successfully' })
  message: string;

  @ApiProperty({
    example: {
      assessmentId: '123e4567-e89b-12d3-a456-426614174000',
      auditDate: '2026-02-15T14:30:00.000Z',
    },
  })
  data: {
    assessmentId: string;
    auditDate: string;
  };
}
