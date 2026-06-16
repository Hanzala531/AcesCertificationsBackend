import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';

export enum AuditorStatusEnum {
  AVAILABLE = 'available',
  BUSY = 'busy',
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/account/image/upload/v123/auditors/profile.jpg',
    required: false,
    description: 'Cloudinary image URL. Must be from Cloudinary domain.',
  })
  @IsOptional()
  @IsUrl()
  profile_picture_url?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/account/image/upload/v123/auditors/signature.png',
    required: false,
    description:
      'Cloudinary image URL of the auditor signature. Must be from Cloudinary domain. Required before the auditor can finalize an audit decision.',
  })
  @IsOptional()
  @IsUrl()
  signature_url?: string;

  @ApiProperty({ example: 'United States', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'California', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'Los Angeles', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    enum: AuditorStatusEnum,
    example: AuditorStatusEnum.AVAILABLE,
    required: false,
    description:
      'Auditor availability status. Only "available" or "busy" are allowed.',
  })
  @IsOptional()
  @IsEnum(AuditorStatusEnum)
  status?: AuditorStatusEnum;

  @ApiProperty({
    type: [String],
    example: ['cert-id-1', 'cert-id-2'],
    required: false,
    description: 'Array of certificate IDs to assign',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigned_certificates?: string[];

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

export class AssignCertificateDto {
  @ApiProperty({
    type: [String],
    example: ['cert-id-1', 'cert-id-2'],
    description: 'Array of certificate IDs to assign',
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  certificate_ids: string[];
}

export class UnassignCertificateDto {
  @ApiProperty({
    type: [String],
    example: ['cert-id-1', 'cert-id-2'],
    description: 'Array of certificate IDs to unassign',
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  certificate_ids: string[];
}

export class UpdateStatusDto {
  @ApiProperty({
    enum: AuditorStatusEnum,
    example: AuditorStatusEnum.AVAILABLE,
    description:
      'Auditor availability status. Only "available" or "busy" are allowed.',
  })
  @IsNotEmpty()
  @IsEnum(AuditorStatusEnum)
  status: AuditorStatusEnum;
}

export class UpdateAccountStatusDto {
  @ApiProperty({
    example: true,
    description: 'Account status. true = active, false = inactive',
  })
  @IsNotEmpty()
  @IsOptional()
  accountStatus: boolean;
}
