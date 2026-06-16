import {
  IsEmail,
  IsString,
  MaxLength,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({
    example: 'organization@example.com',
    description: 'Email address for the organization account',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Password for the organization account (minimum 6 characters)',
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;

  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Name of the organization',
  })
  @IsString({ message: 'Organization name must be a string' })
  @MaxLength(255, {
    message: 'Organization name must not exceed 255 characters',
  })
  @IsNotEmpty({ message: 'Organization name is required' })
  organization_name!: string;

  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'Array of industry UUIDs (1-5 industries)',
    type: [String],
  })
  @IsUUID('4', { each: true, message: 'Each industry ID must be a valid UUID' })
  @IsArray({ message: 'Industries must be an array' })
  @ArrayMinSize(1, { message: 'At least 1 industry is required' })
  @ArrayMaxSize(5, { message: 'Maximum 5 industries allowed' })
  @IsNotEmpty({ message: 'Industry IDs are required' })
  industry_ids!: string[];

  @ApiProperty({
    example: 'BUS-12345',
    description: 'Unique business identifier',
  })
  @IsString({ message: 'Business ID must be a string' })
  @MaxLength(100, { message: 'Business ID must not exceed 100 characters' })
  @IsNotEmpty({ message: 'Business ID is required' })
  business_id!: string;

  @ApiProperty({
    example: 'United States',
    description: 'Country where the organization is legally registered',
  })
  @IsString({ message: 'Country must be a string' })
  @MaxLength(100, { message: 'Country must not exceed 100 characters' })
  @IsNotEmpty({ message: 'Country is required' })
  country!: string;

  @ApiProperty({
    example: 'California',
    description: 'State where the organization is legally registered',
  })
  @IsString({ message: 'State must be a string' })
  @MaxLength(100, { message: 'State must not exceed 100 characters' })
  @IsNotEmpty({ message: 'State is required' })
  state!: string;

  @ApiProperty({
    example: 'Los Angeles',
    description: 'City where the organization is legally registered',
  })
  @IsString({ message: 'City must be a string' })
  @MaxLength(100, { message: 'City must not exceed 100 characters' })
  @IsNotEmpty({ message: 'City is required' })
  city!: string;

  @ApiProperty({
    example: 'A leading technology company specializing in cloud solutions',
    description: 'Brief description of the organization',
  })
  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  @IsNotEmpty({ message: 'Description is required' })
  description!: string;

  @ApiPropertyOptional({
    example: '+1-555-123-4567',
    description: 'Contact phone number for the organization',
  })
  @IsString({ message: 'Contact number must be a string' })
  @MaxLength(20, { message: 'Contact number must not exceed 20 characters' })
  @IsOptional()
  contact_no?: string;

  @ApiPropertyOptional({
    example: 'contact@acmecorp.com',
    description:
      'Contact email address for the organization (different from account email)',
  })
  @IsEmail({}, { message: 'Organization email must be a valid email address' })
  @IsOptional()
  organization_email?: string;
}
