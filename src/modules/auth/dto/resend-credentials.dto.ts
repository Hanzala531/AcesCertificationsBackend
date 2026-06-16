import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail } from 'class-validator';

export class ResendCredentialsDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address of the user whose credentials should be resent',
    format: 'email',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsString()
  email: string;
}
