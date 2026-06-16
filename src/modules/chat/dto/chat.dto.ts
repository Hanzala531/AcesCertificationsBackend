import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateChatThreadDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  assessmentId: string;
}

export class CreateAuditorReviewerThreadDto {
  @ApiProperty({
    description: 'The assessment ID to create an auditor-reviewer chat thread for',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  assessmentId: string;

  @ApiPropertyOptional({
    description: 'Optional first message to send in the thread',
    example: 'Hi, I need to discuss the assessment findings.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;
}

export class AddParticipantDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: ['applicant', 'auditor', 'reviewer', 'admin'] })
  @IsEnum(['applicant', 'auditor', 'reviewer', 'admin'])
  @IsNotEmpty()
  role: 'applicant' | 'auditor' | 'reviewer' | 'admin';
}

export class SendMessageDto {
  @ApiProperty({ example: 'Hello, I have a question about the assessment.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}

export class GetMessagesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  after?: string;
}

export class LockThreadDto {
  @ApiPropertyOptional({ example: 'Certificate issued' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ChatThreadResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  assessmentId?: string;

  @ApiPropertyOptional()
  supportTicketId?: string;

  @ApiProperty({ enum: ['active', 'locked', 'archived'] })
  status: string;

  @ApiPropertyOptional()
  certificateName?: string;

  @ApiPropertyOptional()
  organizationName?: string;

  @ApiPropertyOptional()
  supportTicketSubject?: string;

  @ApiPropertyOptional()
  supportTicketCategory?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  lockedAt?: Date;

  @ApiPropertyOptional()
  lockedReason?: string;
}

export class ChatMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  threadId: string;

  @ApiProperty()
  senderId: string;

  @ApiPropertyOptional()
  senderName?: string;

  @ApiPropertyOptional()
  senderRole?: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  isSystemMessage: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class ChatParticipantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiProperty({ enum: ['applicant', 'auditor', 'reviewer', 'admin'] })
  role: string;

  @ApiProperty()
  joinedAt: Date;

  @ApiPropertyOptional()
  lastReadAt?: Date;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ type: [ChatMessageResponseDto] })
  messages: ChatMessageResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasMore: boolean;
}
