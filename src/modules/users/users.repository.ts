import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  UserEntity,
  UserRole,
  OtpEntity,
  OtpPurpose,
  QueryResult,
  OrganizationEntity,
  EmployeeEntity,
  AuditorEntity,
  ReviewerEntity,
  LoginLogEntity,
} from '../../common/types/database.types';

export interface CreatedUser {
  id: string;
  email: string;
  role: UserRole;
  created_at: Date;
}

@Injectable()
export class UsersRepository {
  constructor(private db: DatabaseService) {}

  async create(
    email: string,
    passwordHash?: string,
    role: UserRole = 'organization',
  ): Promise<CreatedUser> {
    const query = passwordHash
      ? 'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at'
      : 'INSERT INTO users (email, role) VALUES ($1, $2) RETURNING id, email, role, created_at';
    const params = passwordHash ? [email, passwordHash, role] : [email, role];
    const result = (await this.db.query(
      query,
      params,
    )) as QueryResult<CreatedUser>;
    return result.rows[0];
  }

  async findById(id: string): Promise<UserEntity | null> {
    const result = (await this.db.query(
      `SELECT id, email, role, is_active, is_deleted, login_attempts, 
              created_at, updated_at, refresh_token, password, is_verified, 
              email_verified, last_login, locked_until, last_failed_login
       FROM users WHERE id = $1`,
      [id],
    )) as QueryResult<UserEntity>;
    return result.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const result = (await this.db.query(
      `SELECT id, email, password, role, is_active, is_deleted, is_verified,
              email_verified, login_attempts, refresh_token, last_login,
              locked_until, last_failed_login,
              created_at, updated_at
       FROM users WHERE email = $1`,
      [email],
    )) as QueryResult<UserEntity>;
    return result.rows[0] ?? null;
  }

  async setRefreshToken(userId: string, hashed: string): Promise<void> {
    await this.db.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
      hashed,
      userId,
    ]);
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.db.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [
      userId,
    ]);
  }

  async setLastLogin(userId: string): Promise<void> {
    await this.db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [
      userId,
    ]);
  }

  async insertLoginLog(
    userId: string,
    email?: string | null,
    device?: string | null,
    location?: string | null,
  ): Promise<void> {
    await this.db.query(
      'INSERT INTO login_logs (user_id, email, device, location) VALUES ($1, $2, $3, $4)',
      [userId, email ?? null, device ?? null, location ?? null],
    );
  }

  async setOtp(
    userId: string,
    otp: string,
    expiryTime: Date,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<void> {
    // First, mark any existing OTPs for this user/purpose as used
    await this.db.query(
      `UPDATE otp SET is_used = TRUE 
       WHERE user_id = $1 AND purpose = $2 AND is_used = FALSE`,
      [userId, purpose],
    );

    // Then insert the new OTP
    await this.db.query(
      `INSERT INTO otp (user_id, otp_code, purpose, expires_at) 
       VALUES ($1, $2, $3, $4)`,
      [userId, otp, purpose, expiryTime],
    );
  }

  async clearOtp(
    userId: string,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<void> {
    await this.db.query(
      'UPDATE otp SET is_used = TRUE WHERE user_id = $1 AND purpose = $2',
      [userId, purpose],
    );
  }

  async verifyUser(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET is_verified = TRUE, email_verified = TRUE WHERE id = $1',
      [userId],
    );
  }

  async incrementLoginAttempts(
    userId: string,
    lockoutMinutes: number = 30,
  ): Promise<void> {
    const lockoutTime = new Date(Date.now() + lockoutMinutes * 60 * 1000);
    await this.db.query(
      `UPDATE users 
       SET login_attempts = login_attempts + 1, 
           last_failed_login = NOW(),
           locked_until = CASE 
             WHEN login_attempts + 1 >= 5 THEN $2
             ELSE locked_until
           END,
           updated_at = NOW() 
       WHERE id = $1`,
      [userId, lockoutTime],
    );
  }

  async resetLoginAttempts(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users 
       SET login_attempts = 0, 
           locked_until = NULL,
           last_failed_login = NULL,
           updated_at = NOW() 
       WHERE id = $1`,
      [userId],
    );
  }

  async verifyOtp(
    userId: string,
    _otpCode: string,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<OtpEntity | null> {
    const result = (await this.db.query(
      `SELECT id, user_id, otp_code, purpose, expires_at, is_used, attempts, created_at 
       FROM otp 
       WHERE user_id = $1 AND purpose = $2 AND is_used = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, purpose],
    )) as QueryResult<OtpEntity>;
    return result.rows[0] ?? null;
  }

  async incrementOtpAttempts(otpId: string): Promise<void> {
    await this.db.query(
      'UPDATE otp SET attempts = attempts + 1 WHERE id = $1',
      [otpId],
    );
  }

  async markOtpAsUsed(otpId: string): Promise<void> {
    await this.db.query('UPDATE otp SET is_used = TRUE WHERE id = $1', [otpId]);
  }

  async updateEmail(
    userId: string,
    newEmail: string,
  ): Promise<UserEntity | null> {
    const result = (await this.db.query(
      `UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2 
       RETURNING id, email, role, is_active, is_deleted, login_attempts, 
                 created_at, updated_at, refresh_token, password, is_verified, 
                 email_verified, last_login`,
      [newEmail, userId],
    )) as QueryResult<UserEntity>;
    return result.rows[0] ?? null;
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId],
    );
  }

  async markAsDeleted(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1',
      [userId],
    );
  }

  async getOrganizationByUserId(
    userId: string,
  ): Promise<OrganizationEntity | null> {
    const result = (await this.db.query(
      `SELECT id, name, user_id, contact_no, website, logo, industry_id, description, legal_city, legal_state, legal_country, total_branches FROM organization WHERE user_id = $1 LIMIT 1`,
      [userId],
    )) as QueryResult<OrganizationEntity>;
    return result.rows[0] ?? null;
  }

  async getEmployeeByUserId(userId: string): Promise<EmployeeEntity | null> {
    const result = (await this.db.query(
      `SELECT id, user_id, organization_id, branch_id, first_name, last_name, position, department, profile_picture, created_at, updated_at
       FROM employee
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    )) as QueryResult<EmployeeEntity>;
    return result.rows[0] ?? null;
  }

  async getAuditorByUserId(userId: string): Promise<AuditorEntity | null> {
    const result = (await this.db.query(
      `SELECT id, user_id, first_name, last_name, profile_picture FROM auditor WHERE user_id = $1 LIMIT 1`,
      [userId],
    )) as QueryResult<AuditorEntity>;
    return result.rows[0] ?? null;
  }

  async getReviewerByUserId(userId: string): Promise<ReviewerEntity | null> {
    const result = (await this.db.query(
      `SELECT id, user_id, first_name, last_name, profile_picture FROM reviewer WHERE user_id = $1 LIMIT 1`,
      [userId],
    )) as QueryResult<ReviewerEntity>;
    return result.rows[0] ?? null;
  }

  async getLoginLogs(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: LoginLogEntity[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = (await this.db.query(
      `SELECT COUNT(*)::int AS total FROM login_logs WHERE user_id = $1`,
      [userId],
    )) as QueryResult<{ total: number }>;
    const total = countResult.rows[0]?.total ?? 0;

    const result = (await this.db.query(
      `SELECT id, user_id, email, device, location, created_at
       FROM login_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    )) as QueryResult<LoginLogEntity>;

    return { items: result.rows, total };
  }
}
