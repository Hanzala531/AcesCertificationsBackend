import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  IsUrl,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class OrganizationDocumentDto {
  @ApiProperty({
    example: 'legal',
    enum: ['legal', 'certificate', 'compliance'],
  })
  @IsEnum(['legal', 'certificate', 'compliance'], {
    message: 'Document type must be one of: legal, certificate, compliance',
  })
  type: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/document.pdf' })
  @IsUrl({}, { message: 'Document URL must be a valid URL' })
  url: string;
}

export class UpdateOrganizationProfileDto {
  @ApiProperty({ example: 'TechCorp Inc', required: false })
  @IsString({ message: 'Organization name must be a string' })
  @MinLength(2, { message: 'Organization name must be at least 2 characters' })
  @MaxLength(255, {
    message: 'Organization name must not exceed 255 characters',
  })
  @IsOptional()
  name?: string;

  @ApiProperty({ example: '+1-555-0123', required: false })
  @IsString({ message: 'Contact number must be a string' })
  @MaxLength(20, { message: 'Contact number must not exceed 20 characters' })
  @IsOptional()
  contact_no?: string;

  @ApiProperty({ example: 'contact@organization.com', required: false })
  @IsString({ message: 'Email must be a string' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'https://techcorp.com', required: false })
  @IsString({ message: 'Website must be a string' })
  @MaxLength(255, { message: 'Website must not exceed 255 characters' })
  @IsOptional()
  website?: string;

  @ApiProperty({ example: 'Technology', required: false })
  @IsString({ message: 'Organization type must be a string' })
  @MaxLength(100, {
    message: 'Organization type must not exceed 100 characters',
  })
  @IsOptional()
  organization_type?: string;

  @ApiProperty({ example: 'A leading technology company...', required: false })
  @IsString({ message: 'Description must be a string' })
  @MinLength(10, { message: 'Description must be at least 10 characters' })
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 5, required: false })
  @IsNumber({}, { message: 'Total branches must be a number' })
  @Min(0, { message: 'Total branches must be at least 0' })
  @IsOptional()
  total_branches?: number;

  @ApiProperty({ example: 'San Francisco', required: false })
  @IsString({ message: 'Legal city must be a string' })
  @MaxLength(100, { message: 'Legal city must not exceed 100 characters' })
  @IsOptional()
  legal_city?: string;

  @ApiProperty({ example: 'California', required: false })
  @IsString({ message: 'Legal state must be a string' })
  @MaxLength(100, { message: 'Legal state must not exceed 100 characters' })
  @IsOptional()
  legal_state?: string;

  @ApiProperty({ example: 'United States', required: false })
  @IsString({ message: 'Legal country must be a string' })
  @MaxLength(100, { message: 'Legal country must not exceed 100 characters' })
  @IsOptional()
  legal_country?: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/account/image/upload/v123456789/organizations/logo.jpg',
    required: false,
    description: 'Organization logo URL from Cloudinary',
  })
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  @IsOptional()
  logo_url?: string;

  @ApiProperty({
    type: [OrganizationDocumentDto],
    required: false,
    description: 'Array of legal documents with type and S3 URL',
  })
  @IsArray({ message: 'Documents must be an array' })
  @ValidateNested({ each: true })
  @Type(() => OrganizationDocumentDto)
  @IsOptional()
  documents?: OrganizationDocumentDto[];

  @ApiProperty({
    example: ['industry-uuid-1', 'industry-uuid-2'],
    required: false,
    description: 'Array of industry ids to associate with the organization',
  })
  @IsOptional()
  @IsArray()
  industry_ids?: string[];

  @ApiProperty({ example: 'Small', required: false })
  @IsOptional()
  @IsString()
  company_size?: string;

  @ApiProperty({
    example: 'https://s3.amazonaws.com/legal.pdf',
    required: false,
    description: 'Single legal document URL (S3) for quick reference',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Legal document URL must be a valid URL' })
  legal_document_url?: string;
}
