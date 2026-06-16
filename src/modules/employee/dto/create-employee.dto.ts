import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsUUID,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PermissionDto } from './permission.dto';

export class CreateEmployeeDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  first_name!: string;

  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  last_name!: string;

  @IsString({ message: 'Position must be a string' })
  @MaxLength(100, { message: 'Position must not exceed 100 characters' })
  @IsOptional()
  position?: string;

  @IsString({ message: 'Department must be a string' })
  @MaxLength(100, { message: 'Department must not exceed 100 characters' })
  @IsOptional()
  department?: string;

  @IsUrl({}, { message: 'Profile picture URL must be a valid URL' })
  @IsOptional()
  profile_picture_url?: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'Please provide a valid phone number',
  })
  phone_number?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === '') return null;
    return typeof value === 'string' ? value : value;
  })
  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  @IsOptional()
  branch_id?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}
