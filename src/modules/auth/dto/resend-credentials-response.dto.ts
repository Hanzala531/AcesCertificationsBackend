import { ApiProperty } from '@nestjs/swagger';

export class ResendCredentialsResponseDto {
  @ApiProperty({
    example: 'Credentials have been reset and sent to user@example.com',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address where credentials were sent',
    format: 'email',
  })
  email: string;
}
