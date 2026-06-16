import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from './create-user.dto';

export class UserResponseDto {
  @ApiProperty({ example: '5e3e8f92-8b3a-4c6b-91d4-8df9e4f6b8a1' })
  id: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ example: UserRole.USER, enum: UserRole })
  role: UserRole;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: false })
  is_deleted: boolean;

  @ApiProperty({ example: 0 })
  login_attempts: number;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z', required: false })
  updated_at?: string;

  @ApiProperty({ example: null, required: false })
  last_login?: string | null;
}
