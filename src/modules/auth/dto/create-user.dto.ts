import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUBADMIN = 'subadmin',
  ORGANIZATION = 'organization',
  ORGANIZATION_MEMBER = 'organization_member',
  AUDITOR = 'auditor',
  REVIEWER = 'reviewer',
}

export class CreateUserDto {
  @ApiProperty({ example: 'jane@example.com', required: true })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'strong-password', writeOnly: true, required: true })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ example: UserRole.USER, required: false, enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
