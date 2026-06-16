import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateIndustryDto {
  @ApiProperty({
    example: 'Information Technology',
    required: true,
    description: 'Name of the industry',
    minLength: 2,
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Industry name is required' })
  @IsString()
  @MinLength(2, { message: 'Industry name must be at least 2 characters long' })
  @MaxLength(255, { message: 'Industry name must not exceed 255 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;
}
