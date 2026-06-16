import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsIn } from 'class-validator';
import type { SupportTicketStatus } from '../types/support-ticket.types';

export class UpdateTicketStatusDto {
  @ApiProperty({
    example: 'in_progress',
    enum: ['pending', 'in_progress', 'completed'],
    description: 'New status for the support ticket',
  })
  @IsNotEmpty()
  @IsIn(['pending', 'in_progress', 'completed'])
  status: SupportTicketStatus;
}
