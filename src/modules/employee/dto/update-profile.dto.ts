import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PermissionDto } from './permission.dto';

export class UpdateProfileDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  first_name?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  last_name?: string;

  @ApiProperty({ example: 'Senior Developer', required: false })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({ example: 'Engineering', required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/account/image/upload/v123/employees/profile.jpg',
    required: false,
    description: 'Cloudinary image URL. Must be from Cloudinary domain.',
  })
  @IsOptional()
  @IsUrl()
  profile_picture_url?: string;

  @ApiProperty({ example: '+1-555-0123', required: false })
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'Please provide a valid phone number',
  })
  phone_number?: string;

  @ApiProperty({
    example: '880e8400-e29b-41d4-a716-446655440003',
    required: false,
    nullable: true,
    description: 'Branch UUID. Send null to unassign branch.',
  })
  @IsOptional()
  @IsUUID('4')
  branch_id?: string | null;

  @ApiProperty({
    required: false,
    type: [PermissionDto],
    description:
      'Organization-only field. Full permissions array replacement for the employee.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];

  @ApiProperty({
    required: false,
    enum: ['pending', 'active'],
    description:
      'Organization-only field. Employee status. Allowed values: pending, active.',
  })
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'active'])
  status?: 'pending' | 'active';
}

export class UpdateEmailDto {
  @ApiProperty({ example: 'newemail@example.com', required: true })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '123456',
    required: true,
    description: 'OTP sent to current email',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class UpdatePasswordDto {
  @ApiProperty({ example: 'currentPassword123!', required: true })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'newPassword456!', required: true })
  @IsString()
  @IsNotEmpty()
  newPassword: string;

  @ApiProperty({
    example: '123456',
    required: true,
    description: 'OTP sent to email',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
