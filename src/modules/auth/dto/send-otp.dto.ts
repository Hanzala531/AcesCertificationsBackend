import { IsEmail, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'Email address to send OTP to',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Purpose of OTP (email_verification or password_reset)',
    example: 'email_verification',
    enum: ['email_verification', 'password_reset'],
    required: false,
  })
  @IsEnum(['email_verification', 'password_reset'], {
    message: 'Purpose must be either email_verification or password_reset',
  })
  @IsOptional()
  purpose?: 'email_verification' | 'password_reset';
}
