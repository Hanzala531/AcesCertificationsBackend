import { ApiProperty } from '@nestjs/swagger';

export class OtpResponseDto {
  @ApiProperty({
    description: 'Message about OTP operation',
    example: 'OTP sent successfully',
  })
  message: string;

  @ApiProperty({
    description: 'User ID',
    example: 'uuid-string',
  })
  userId?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  email?: string;

  @ApiProperty({
    description: 'OTP code (only in development)',
    example: 'ABC123',
    required: false,
  })
  otp?: string;

  @ApiProperty({
    description: 'OTP expiry timestamp (ISO) - development only',
    example: '2026-01-14T12:34:56.000Z',
    required: false,
  })
  otp_expires_at?: string;
}
