export interface UserRecord {
  id: string;
  email: string;
  password?: string;
  role: string;
  is_active?: boolean;
  is_deleted?: boolean;
  is_verified?: boolean;
  login_attempts?: number;
  refresh_token?: string | null;
  created_at?: Date;
  updated_at?: Date;
  last_login?: Date;
}

export interface OtpRecord {
  id: string;
  user_id: string;
  otp_code: string;
  purpose: string;
  expires_at: Date;
  is_used: boolean;
  attempts: number;
  created_at?: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organization_id?: string;
  employee_id?: string;
  auditor_id?: string;
  reviewer_id?: string;
  industry_id?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
