import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsString,
  IsNotEmpty,
  IsUUID,
  ValidateIf,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
  IsIn,
} from 'class-validator';
import type {
  SupportTicketTargetType,
  SupportTicketType,
} from '../types/support-ticket.types';

export class CreateSupportTicketDto {
  @ApiProperty({
    example: 'Certificate renewal issue',
    description: 'Subject of the support ticket',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  subject: string;

  @ApiProperty({ example: 'renewal', description: 'Category of the ticket' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  category: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'Certificate UUID. Required when target_type is "certificate", optional otherwise.',
    required: false,
    nullable: true,
  })
  @ValidateIf((o) => (o.target_type || 'certificate') === 'certificate')
  @IsNotEmpty()
  @IsUUID()
  certificate_id?: string;

  @ApiProperty({
    example: 'I need help with my certificate renewal process.',
    description: 'Detailed description',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({
    example: 'https://example.com/document.pdf',
    description: 'URL of supporting document (optional)',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  supporting_document?: string;

  @ApiProperty({
    example: 'support',
    enum: ['support', 'dispute', 'billing', 'technical', 'other'],
    required: false,
    description: 'Ticket workflow type',
  })
  @IsOptional()
  @IsIn(['support', 'dispute', 'billing', 'technical', 'other'])
  ticket_type?: SupportTicketType;

  @ApiProperty({
    example: 'certificate',
    enum: ['certificate', 'assessment', 'payment', 'account', 'other'],
    required: false,
    description: 'Entity type this ticket targets',
  })
  @IsOptional()
  @IsIn(['certificate', 'assessment', 'payment', 'account', 'other'])
  target_type?: SupportTicketTargetType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440111',
    description:
      'Target entity UUID. Required when target_type is not "other". Defaults to certificate_id for legacy flows.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  target_id?: string;

  @ApiProperty({
    example: { assessment_id: '550e8400-e29b-41d4-a716-446655440222' },
    description: 'Optional structured context',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
