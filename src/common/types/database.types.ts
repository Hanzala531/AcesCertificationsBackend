export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserEntity extends BaseEntity {
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
  is_deleted: boolean;
  is_verified: boolean;
  email_verified: boolean;
  login_attempts: number;
  refresh_token: string | null;
  last_login: Date | null;
  locked_until: Date | null;
  last_failed_login: Date | null;
}

export type UserRole =
  | 'admin'
  | 'subadmin'
  | 'organization'
  | 'organization_member'
  | 'auditor'
  | 'reviewer';

export interface OtpEntity {
  id: string;
  user_id: string;
  otp_code: string;
  purpose: OtpPurpose;
  expires_at: Date;
  is_used: boolean;
  attempts: number;
  created_at: Date;
}

export type OtpPurpose = 'email_verification' | 'password_reset';

export interface OrganizationEntity extends BaseEntity {
  user_id: string;
  name: string;
  email?: string;
  contact_no?: string;
  company_size?: string;
  website?: string;
  logo?: string;
  industry_id?: string;
  total_branches: number;
  organization_type?: string;
  business_id?: string;
  legal_city?: string;
  legal_state?: string;
  legal_country?: string;
  description?: string;
  legal_document_url?: string;
}

export interface EmployeeEntity extends BaseEntity {
  user_id: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  branch_id?: string | null;
  position?: string | null;
  department?: string | null;
  profile_picture?: string | null;
  email?: string;
}

export interface IndustryEntity extends BaseEntity {
  name: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface AuditorEntity extends BaseEntity {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_picture?: string | null;
}

export interface ReviewerEntity extends BaseEntity {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_picture?: string | null;
}

export interface LoginLogEntity {
  id: string;
  user_id: string;
  email: string;
  device?: string | null;
  location?: string | null;
  created_at: Date;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount?: number;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type PublicUser = Omit<UserEntity, 'password' | 'refresh_token'>;

export interface CreateUserInput {
  email: string;
  password: string;
  role?: UserRole;
}

export interface CreateEmployeeInput {
  user_id: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  branch_id?: string | null;
  position?: string | null;
  department?: string | null;
  profile_picture?: string | null;
}

export interface CreateOrganizationInput {
  name: string;
  industry_id: string;
  business_id: string;
  legal_country: string;
  legal_state: string;
  description: string;
  contact_no?: string;
  website?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  contact_no?: string;
  website?: string;
  logo?: string;
  industry_id?: string;
  description?: string;
  legal_country?: string;
  legal_state?: string;
  legal_city?: string;
  organization_type?: string;
  total_branches?: number;
  legal_document_url?: string;
}

export interface UpdateEmployeeInput {
  first_name?: string;
  last_name?: string;
  position?: string;
  department?: string;
  branch_id?: string;
  profile_picture?: string;
}
