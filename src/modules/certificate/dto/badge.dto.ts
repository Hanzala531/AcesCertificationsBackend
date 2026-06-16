import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ColorDto } from './color.dto';

export class BadgeDto {
  @ApiProperty({ example: 1, description: 'Badge slot (1, 2, or 3)' })
  @IsInt()
  @Min(1)
  @Max(3)
  slot: number;

  @ApiProperty({ example: 'Gold', description: 'Badge name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: [ColorDto],
    description: 'Badge colors (1-4 colors)',
    example: [
      { color: '#FFD700', min_score: 90, max_score: 100 },
      { color: '#FFA500', min_score: 80, max_score: 89 },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => ColorDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  colors: ColorDto[];
}
