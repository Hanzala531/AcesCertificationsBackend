import {
  IsString,
  IsNotEmpty,
  Length,
  IsEmail,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User email to verify',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'OTP code (6 characters)',
    example: 'ABC123',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp: string;

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
