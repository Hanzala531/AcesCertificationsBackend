import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum AuditorReviewerRole {
  AUDITOR = 'auditor',
  REVIEWER = 'reviewer',
}

export class CreateAuditorReviewerDto {
  @ApiProperty({
    example: 'auditor@example.com',
    required: true,
    description: 'Email address for the auditor/reviewer account',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: AuditorReviewerRole.AUDITOR,
    required: true,
    enum: AuditorReviewerRole,
    description: 'Role must be either "auditor" or "reviewer"',
  })
  @IsNotEmpty()
  @IsEnum(AuditorReviewerRole)
  role: AuditorReviewerRole;

  @ApiProperty({
    example: 'John',
    required: true,
    description: 'First name of the auditor/reviewer',
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  first_name: string;

  @ApiProperty({
    example: 'Doe',
    required: true,
    description: 'Last name of the auditor/reviewer',
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  last_name: string;

  @ApiProperty({
    example: 'United States',
    required: false,
    description: 'Country of the auditor (required only for auditor role)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  country?: string;

  @ApiProperty({
    example: 'California',
    required: false,
    description:
      'State/Province of the auditor (required only for auditor role)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  state?: string;

  @ApiProperty({
    example: 'Los Angeles',
    required: false,
    description: 'City of the auditor (required only for auditor role)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  city?: string;

  @ApiProperty({
    example: ['cert-1', 'cert-2', 'cert-3'],
    required: false,
    type: [String],
    description: 'Array of assigned certificate IDs (for auditor role)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigned_certificates?: string[];

  @ApiProperty({
    example: 'available',
    required: false,
    description:
      'Status of the auditor. Only "available" or "busy" are allowed.',
    enum: ['available', 'busy'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @IsEnum(['available', 'busy'])
  status?: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Account status. true = active, false = inactive',
    default: true,
  })
  @IsOptional()
  accountStatus?: boolean;

  @ApiProperty({
    example: ['experienced', 'iso-certified', 'fast'],
    required: false,
    type: [String],
    description: 'Array of tags (for reviewer role)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
