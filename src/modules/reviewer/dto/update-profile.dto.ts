import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsArray,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Jane', required: false })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ example: 'Smith', required: false })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/account/image/upload/v123/reviewers/profile.jpg',
    required: false,
    description: 'Cloudinary image URL. Must be from Cloudinary domain.',
  })
  @IsOptional()
  @IsUrl()
  profile_picture_url?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/account/image/upload/v123/reviewers/signature.png',
    required: false,
    description:
      'Cloudinary image URL of the reviewer signature. Must be from Cloudinary domain. Required before the reviewer can finalize a review decision.',
  })
  @IsOptional()
  @IsUrl()
  signature_url?: string;

  @ApiProperty({
    type: [String],
    example: ['iso-certified', 'experienced'],
    required: false,
    description: 'Array of tags to add',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    example: true,
    required: false,
    description:
      'Account status (true = active, false = inactive). Only admin can update this field.',
  })
  @IsOptional()
  accountStatus?: boolean;
}

export class UpdateEmailDto {
  @ApiProperty({ example: 'newemail@example.com', required: true })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({
    example: '123456',
    required: true,
    description: 'OTP sent to current email',
  })
  @IsNotEmpty()
  @IsString()
  otp: string;
}

export class UpdatePasswordDto {
  @ApiProperty({ example: 'currentPassword123!', required: true })
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @ApiProperty({ example: 'newPassword456!', required: true })
  @IsNotEmpty()
  @IsString()
  newPassword: string;

  @ApiProperty({
    example: '123456',
    required: true,
    description: 'OTP sent to email',
  })
  @IsNotEmpty()
  @IsString()
  otp: string;
}

export class AddTagsDto {
  @ApiProperty({
    type: [String],
    example: ['experienced', 'iso-certified', 'fast'],
    description: 'Array of tags to add',
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}

export class RemoveTagsDto {
  @ApiProperty({
    type: [String],
    example: ['iso-certified', 'experienced'],
    description: 'Array of tags to remove',
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}

export class UpdateAccountStatusDto {
  @ApiProperty({
    example: true,
    required: true,
    description: 'Account status. true = active, false = inactive',
  })
  @IsNotEmpty()
  accountStatus: boolean;
}
