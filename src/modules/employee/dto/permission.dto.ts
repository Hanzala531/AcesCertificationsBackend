import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PermissionDto {
  @ApiProperty({ example: 'reports' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  resource: string;

  @ApiProperty({
    example: ['read', 'write'],
    type: [String],
    description: 'Array of actions allowed for this resource',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'action must have at least one element' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  action: string[];
}

export class PermissionArrayDto {
  @ApiProperty({ type: [PermissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];
}
