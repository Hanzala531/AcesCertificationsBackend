import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

export class ColorDto {
  @ApiProperty({ example: '#FFD700', description: 'Color value (hex or name)' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ example: 80, description: 'Minimum score for this color' })
  @IsInt()
  @Min(0)
  min_score: number;

  @ApiProperty({ example: 100, description: 'Maximum score for this color' })
  @IsInt()
  @Min(0)
  max_score: number;
}
