import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Error DTOs ──────────────────────────────────────────────────────────────

export class UnauthorizedErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Unauthorized' })
  message: string;

  @ApiProperty({ example: 401 })
  statusCode: number;
}

// ─── Login Log DTOs ──────────────────────────────────────────────────────────

export class LoginLogItemDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-123456789012',
    description: 'Unique identifier for the login log entry',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address used during login',
  })
  email: string;

  @ApiPropertyOptional({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    description: 'User-Agent string captured at login time',
  })
  device: string | null;

  @ApiPropertyOptional({
    example: '192.168.1.100',
    description: 'IP address captured at login time',
  })
  location: string | null;

  @ApiProperty({
    example: '2026-04-01T10:30:00.000Z',
    description: 'Timestamp of the login event',
  })
  loginAt: Date;
}

export class LoginLogsPaginatedDataDto {
  @ApiProperty({ type: () => [LoginLogItemDto] })
  items: LoginLogItemDto[];

  @ApiProperty({ example: 42, description: 'Total number of login log entries' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 3, description: 'Total number of pages' })
  totalPages: number;
}

export class GetLoginLogsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Login logs retrieved successfully' })
  message: string;

  @ApiProperty({ type: () => LoginLogsPaginatedDataDto })
  data: LoginLogsPaginatedDataDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-04-01T10:30:00.000Z' })
  timestamp: string;
}
