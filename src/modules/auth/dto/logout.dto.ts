import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ example: '5e3e8f92-8b3a-4c6b-91d4-8df9e4f6b8a1' })
  @IsNotEmpty()
  @IsString()
  userId: string;
}
