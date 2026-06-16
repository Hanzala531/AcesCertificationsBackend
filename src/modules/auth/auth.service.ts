import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { isErrorWithStack } from '../../common/utils/error.util';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { OtpService } from '../../common/services/otp.service';
import { EmailService } from '../../common/services/email.service';
import { AuditorService } from '../auditor/auditor.service';
import { ReviewerService } from '../reviewer/reviewer.service';
import { SubadminService } from '../subadmin/subadmin.service';
import { OrganizationService } from '../organization/organization.service';
import { EmployeeService } from '../employee/employee.service';
import {
  UserEntity,
  PublicUser,
  OtpPurpose,
} from '../../common/types/database.types';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organization_id?: string;
  employee_id?: string;
  auditor_id?: string;
  reviewer_id?: string;
  industry_id?: string;
}

interface LoginResult {
  user: PublicUser;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}

interface SendOtpResult {
  userId: string;
  message: string;
  otp?: string;
  otpExpiresAt?: Date;
}

interface VerifyOtpResult {
  message: string;
  user: PublicUser;
}

const BCRYPT_ROUNDS = 12;

const durationToSeconds = (value?: string, fallbackSeconds = 900): number => {
  if (!value) return fallbackSeconds;
  if (!Number.isNaN(Number(value))) {
    return Number(value);
  }
  const match = value.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
  };
  return amount * (multipliers[unit] ?? 1);
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    private emailService: EmailService,
    private auditorService: AuditorService,
    private reviewerService: ReviewerService,
    private subadminService: SubadminService,
    private organizationService: OrganizationService,
    private employeeService: EmployeeService,
  ) {}

  private get accessTokenOptions(): JwtSignOptions {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret || secret === 'change-me') {
      throw new Error(
        'JWT_SECRET environment variable is not set or using default value. Please configure a secure JWT_SECRET.',
      );
    }
    return {
      secret,
      expiresIn: durationToSeconds(
        this.configService.get<string>('JWT_EXPIRES_IN'),
        15 * 60,
      ),
    };
  }

  private get refreshTokenOptions(): JwtSignOptions {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret || secret === 'change-me-refresh') {
      throw new Error(
        'JWT_REFRESH_SECRET environment variable is not set or using default value. Please configure a secure JWT_REFRESH_SECRET.',
      );
    }
    return {
      secret,
      expiresIn: durationToSeconds(
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
        7 * 24 * 60 * 60,
      ),
    };
  }

  private toPublicUser(user: UserEntity): PublicUser {
    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      is_deleted: user.is_deleted,
      is_verified: user.is_verified,
      email_verified: user.email_verified,
      login_attempts: user.login_attempts,
      last_login: user.last_login,
      locked_until: user.locked_until,
      last_failed_login: user.last_failed_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
    return publicUser;
  }

  async validateUser(email: string, pass: string): Promise<PublicUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const passwordValid = await bcrypt.compare(pass, user.password || '');
    if (passwordValid) {
      return this.toPublicUser(user);
    }
    return null;
  }

  private async buildEnrichedPayload(
    userId: string,
    email: string,
    role: string,
  ): Promise<JwtPayload> {
    const payload: JwtPayload = { sub: userId, email, role };

    try {
      if (role === 'organization') {
        const org = await this.usersService.getOrganizationByUserId(userId);
        if (org) {
          payload.organization_id = org.id;
          this.logger.debug(
            `Enriched organization JWT for user ${userId} with org ${org.id}`,
          );
        } else {
          this.logger.warn(
            `No organization found for user ${userId} with role 'organization'`,
          );
        }
      } else if (role === 'organization_member') {
        const employee = await this.usersService.getEmployeeByUserId(userId);
        if (employee) {
          payload.employee_id = employee.id;
          payload.organization_id = employee.organization_id;
          this.logger.debug(
            `Enriched employee JWT for user ${userId} with emp ${employee.id} and org ${employee.organization_id}`,
          );
        } else {
          this.logger.warn(
            `No employee found for user ${userId} with role 'organization_member'`,
          );
        }
      } else if (role === 'auditor') {
        const auditor = await this.usersService.getAuditorByUserId(userId);
        if (auditor) {
          payload.auditor_id = auditor.id;
          this.logger.debug(
            `Enriched auditor JWT for user ${userId} with auditor ${auditor.id}`,
          );
        } else {
          this.logger.warn(
            `No auditor found for user ${userId} with role 'auditor'`,
          );
        }
      } else if (role === 'reviewer') {
        const reviewer = await this.usersService.getReviewerByUserId(userId);
        if (reviewer) {
          payload.reviewer_id = reviewer.id;
          this.logger.debug(
            `Enriched reviewer JWT for user ${userId} with reviewer ${reviewer.id}`,
          );
        } else {
          this.logger.warn(
            `No reviewer found for user ${userId} with role 'reviewer'`,
          );
        }
      }
    } catch (e: unknown) {
      this.logger.warn(
        `Failed to enrich JWT payload with role context for user ${userId}: ${isErrorWithStack(e) ? e.stack : String(e)}. Proceeding with basic payload.`,
      );
    }

    return payload;
  }

  async login(user: PublicUser): Promise<LoginResult> {
    const payload = await this.buildEnrichedPayload(
      user.id,
      user.email,
      user.role,
    );

    const access_token = this.jwtService.sign(payload, this.accessTokenOptions);
    const refresh_token = this.jwtService.sign(
      payload,
      this.refreshTokenOptions,
    );
    const hashed = await bcrypt.hash(refresh_token, BCRYPT_ROUNDS);
    await this.usersService.setRefreshToken(user.id, hashed);

    try {
      await this.usersService.setLastLogin(user.id);
    } catch (e: unknown) {
      this.logger.error(
        `Failed to update last_login for user ${user.id}: ${isErrorWithStack(e) ? e.stack : String(e)}`,
      );
    }

    const freshUser = await this.usersService.findById(user.id);
    if (!freshUser) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: this.toPublicUser(freshUser),
      tokens: { access_token, refresh_token },
    };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshTokenOptions.secret,
      });
    } catch (e: unknown) {
      this.logger.warn(
        'Invalid refresh token verification',
        isErrorWithStack(e) ? e.stack : String(e),
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(decoded.sub);
    if (!user || !user.refresh_token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenValid = await bcrypt.compare(refreshToken, user.refresh_token);
    if (!tokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = await this.buildEnrichedPayload(
      user.id,
      user.email,
      user.role,
    );

    const access_token = this.jwtService.sign(payload, this.accessTokenOptions);
    const new_refresh = this.jwtService.sign(payload, this.refreshTokenOptions);
    const hashed = await bcrypt.hash(new_refresh, BCRYPT_ROUNDS);
    await this.usersService.setRefreshToken(user.id, hashed);

    try {
      await this.usersService.setLastLogin(user.id);
    } catch (e: unknown) {
      this.logger.warn(
        `Failed to update last_login during refresh: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const freshUser = await this.usersService.findById(user.id);
    if (!freshUser) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: this.toPublicUser(freshUser),
      tokens: { access_token, refresh_token: new_refresh },
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.clearRefreshToken(userId);
    return {
      message: 'Logged out successfully',
    };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.usersService.clearRefreshToken(userId);
    return {
      message: 'Logged out from all sessions successfully',
    };
  }

  async sendOtp(
    email: string,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<SendOtpResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const otpExpiryMinutes =
      Number(this.configService.get<string>('OTP_EXPIRY_MINUTES')) || 10;
    const otp = this.otpService.generateOtp();
    const expiryTime = this.otpService.generateOtpExpiry(otpExpiryMinutes);

    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(
        `Generated OTP for ${email}: ${otp}, Expires at: ${expiryTime.toISOString()}`,
      );
    }

    await this.usersService.setOtp(user.id, otp, expiryTime, purpose);

    try {
      await this.emailService.sendOtpEmail(email, otp, purpose);
    } catch (e: unknown) {
      this.logger.error(
        `Failed to send OTP email to ${email}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return {
      userId: user.id,
      message: 'OTP sent successfully to your email',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      otpExpiresAt: expiryTime,
    };
  }

  async verifyOtp(
    userId: string,
    otp: string,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<VerifyOtpResult> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const otpRecord = await this.usersService.verifyOtp(userId, otp, purpose);
    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    if (otpRecord.is_used) {
      throw new BadRequestException('OTP has already been used');
    }

    const MAX_OTP_ATTEMPTS = 5;
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        'Maximum OTP attempts exceeded. Please request a new OTP.',
      );
    }

    if (otpRecord.otp_code !== otp) {
      await this.usersService.incrementOtpAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP');
    }

    await this.usersService.markOtpAsUsed(otpRecord.id);
    await this.usersService.verifyUser(userId);

    const updatedUser = await this.usersService.findById(userId);
    if (!updatedUser) {
      throw new BadRequestException('User not found');
    }

    return {
      message: 'Email verified successfully',
      user: this.toPublicUser(updatedUser),
    };
  }

  async updatePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.password || '',
    );
    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password || '',
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.updatePassword(userId, hashedNewPassword);
    await this.usersService.clearRefreshToken(userId);

    return {
      message: 'Password updated successfully. Please log in again.',
    };
  }

  async forgotPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const otpRecord = await this.usersService.verifyOtp(
      user.id,
      otp,
      'password_reset',
    );
    if (!otpRecord) {
      throw new BadRequestException(
        'Invalid or expired OTP. Please request a new OTP for password reset.',
      );
    }

    if (otpRecord.is_used) {
      throw new BadRequestException('OTP has already been used');
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      throw new BadRequestException(
        'OTP has expired. Please request a new OTP.',
      );
    }

    const MAX_OTP_ATTEMPTS = 5;
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        'Maximum OTP attempts exceeded. Please request a new OTP.',
      );
    }

    if (otpRecord.otp_code !== otp) {
      await this.usersService.incrementOtpAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP code');
    }

    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password || '',
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.updatePassword(user.id, hashedNewPassword);
    await this.usersService.markOtpAsUsed(otpRecord.id);
    await this.usersService.clearRefreshToken(user.id);

    return {
      message:
        'Password reset successfully. Please log in with your new password.',
    };
  }

  async resendOtp(
    email: string,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<SendOtpResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (purpose === 'email_verification' && user.is_verified) {
      throw new BadRequestException('User is already verified');
    }

    const otpExpiryMinutes =
      Number(this.configService.get<string>('OTP_EXPIRY_MINUTES')) || 10;
    const otp = this.otpService.generateOtp();
    const expiryTime = this.otpService.generateOtpExpiry(otpExpiryMinutes);

    await this.usersService.setOtp(user.id, otp, expiryTime, purpose);
    await this.emailService.sendOtpEmail(email, otp, purpose);

    return {
      userId: user.id,
      message: 'OTP resent successfully to your email',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      otpExpiresAt: expiryTime,
    };
  }

  async sendCredentialsEmail(
    email: string,
    password: string,
    role: string,
    context?: {
      createdBy?: 'admin' | 'organization';
      organizationName?: string;
      creatorName?: string;
    },
  ): Promise<void> {
    await this.emailService.sendCredentialsEmail(
      email,
      password,
      role,
      context,
    );
  }

  async getMyProfile(
    userId: string,
    userRole: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    let profile: Record<string, unknown> | null = null;

    switch (userRole) {
      case 'admin':
        profile = {
          id: user.id,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          is_verified: user.is_verified,
          email_verified: user.email_verified,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login: user.last_login,
        };
        break;

      case 'subadmin':
        profile = await this.subadminService.findByUserId(userId);
        if (profile) {
          profile = { ...profile, email: user.email, role: user.role };
        }
        break;

      case 'organization':
        const orgProfile = await this.organizationService.findByUserId(userId);
        profile = orgProfile
          ? ({
              ...orgProfile,
              email: user.email,
              role: user.role,
            } as unknown as Record<string, unknown>)
          : null;
        break;

      case 'organization_member':
        try {
          const empProfile = await this.employeeService.getMyProfile(userId);
          profile = {
            ...empProfile,
            email: user.email,
            role: user.role,
          } as unknown as Record<string, unknown>;
        } catch (error) {
          profile = {
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            is_verified: user.is_verified,
            email_verified: user.email_verified,
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_login: user.last_login,
          };
        }
        break;

      case 'auditor':
        profile = await this.auditorService.findByUserId(userId);
        if (profile) {
          profile = { ...profile, email: user.email, role: user.role };
        }
        break;

      case 'reviewer':
        profile = await this.reviewerService.findByUserId(userId);
        if (profile) {
          profile = { ...profile, email: user.email, role: user.role };
        }
        break;

      default:
        profile = {
          id: user.id,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          is_verified: user.is_verified,
          email_verified: user.email_verified,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login: user.last_login,
        };
    }

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async resendCredentials(
    email: string,
    requesterUserId: string,
    requesterRole: string,
    passwordGenerator: { generate: () => string },
  ): Promise<{ message: string; email: string }> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (requesterRole !== 'admin') {
      if (user.id !== requesterUserId) {
        throw new UnauthorizedException(
          'You can only resend credentials for your own account',
        );
      }
    }

    if (user.is_deleted) {
      throw new BadRequestException(
        'Cannot resend credentials for deleted account',
      );
    }

    const newPassword = passwordGenerator.generate();
    await this.usersService.updatePasswordWithPlaintext(user.id, newPassword);

    try {
      await this.sendCredentialsEmail(user.email, newPassword, user.role, {
        createdBy: 'admin',
      });
    } catch (error) {
      this.logger.error(
        `Failed to send credentials email to ${user.email}: ${isErrorWithStack(error) ? error.stack : String(error)}`,
      );
      throw new BadRequestException(
        'Failed to send credentials email. Please try again later.',
      );
    }

    return {
      message: `Credentials have been reset and sent to ${user.email}`,
      email: user.email,
    };
  }
}
