import { ApiProperty } from '@nestjs/swagger';
import { TokensDto } from './tokens.dto';
import { UserResponseDto } from './user-response.dto';

export class RegisterResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: TokensDto })
  tokens: TokensDto;
}
