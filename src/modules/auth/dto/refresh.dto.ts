import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ example: 'existing-refresh-token' })
  @IsNotEmpty()
  @IsString()
  refresh_token: string;
}
