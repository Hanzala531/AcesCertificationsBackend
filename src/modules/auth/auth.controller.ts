// I am adding this comment here as a remoinder for me to refactir things in the login controller

import {
  Body,
  Controller,
  Post,
  Get,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Res,
  UseGuards,
  Request,
  UseInterceptors,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import { PublicUser, UserRole } from '../../common/types/database.types';
import { DatabaseService } from '../../database/database.service';

function parseDurationToMs(str: string | undefined, fallbackMs = 0): number {
  if (!str) return fallbackMs;
  const m = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return fallbackMs;
  const v = Number(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case 's':
      return v * 1000;
    case 'm':
      return v * 60 * 1000;
    case 'h':
      return v * 60 * 60 * 1000;
    case 'd':
      return v * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
}

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number | undefined;
  path: string;
}

function getCookieOptions(expireStr?: string): CookieOptions {
  const isProd = (process.env.NODE_ENV ?? 'development') === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: parseDurationToMs(expireStr, undefined),
    path: '/',
  };
}

import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import {
  SwaggerRegisterAdminPublic,
  SwaggerRegisterAuditorReviewer,
  SwaggerRegisterSubadmin,
  SwaggerRegisterOrganization,
  SwaggerLogin,
  SwaggerRefreshToken,
  SwaggerLogout,
  SwaggerLogoutAll,
  SwaggerSendOtp,
  SwaggerVerifyOtp,
  SwaggerResendOtp,
  SwaggerUpdatePassword,
  SwaggerForgotPassword,
  SwaggerResendCredentials,
  SwaggerGetMyProfile,
} from './swagger/auth.swagger';

import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from './role.guard';
import { Roles } from './roles.decorator';

import { AuthService } from './auth.service';
import { LoginInterceptor } from './login.interceptor';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpResponseDto } from './dto/otp-response.dto';
import { UsersService } from '../users/users.service';
import { PublicAdminRegisterDto } from './dto/public-admin-register.dto';
import {
  CreateAuditorReviewerDto,
  AuditorReviewerRole,
} from './dto/create-auditor-reviewer.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendCredentialsDto } from './dto/resend-credentials.dto';
import { isDbError, isErrorWithStack } from '../../common/utils/error.util';
import {
  getEmailPolicyConfigFromEnv,
  validateEmailWithPolicy,
} from '../../common/utils/email-policy.util';
import { resolveRequestLocation } from '../../common/utils/request-location.util';
import { AuditorService } from '../auditor/auditor.service';
import { ReviewerService } from '../reviewer/reviewer.service';
import { SubadminService } from '../subadmin/subadmin.service';
import { OrganizationService } from '../organization/organization.service';
import { FileUploadService } from '../../common/services/file-upload.service';
import { PasswordGeneratorService } from '../../common/services/password-generator.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateSubadminDto } from './dto/create-subadmin.dto';
import type { RequestWithUser } from './types/auth.types';
import { IndustryService } from '../industry/industry.service';
import { EmployeeService } from '../employee/employee.service';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { resolveLoginLocation } from '../../common/utils/ip-location.util';

interface AdminRegisterResponse {
  message: string;
  userId: string;
  email: string;
  role: string;
}

interface RegisterAuditorReviewerResponse {
  message: string;
  userId: string;
  email: string;
  role: string;
  profile: Record<string, unknown>;
}

interface SubadminRegisterResponse {
  message: string;
  userId: string;
  email: string;
  role: string;
  profile: Record<string, unknown>;
}

interface OrganizationRegisterResponse {
  message: string;
  userId: string;
  email: string;
  organization: Record<string, unknown>;
}

// User response with string dates (serialized format)
interface UserResponseSerialized {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_deleted: boolean;
  login_attempts: number;
  created_at: string;
  updated_at?: string;
  last_login?: string | null;
  is_verified?: boolean;
  email_verified?: boolean;
}

interface LoginResponse {
  user: UserResponseSerialized;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}

interface VerifyOtpResponse {
  message: string;
  user: UserResponseSerialized;
  tokens?: {
    access_token: string;
    refresh_token: string;
  };
}

function toUserResponseSerialized(user: PublicUser): UserResponseSerialized {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    is_deleted: user.is_deleted,
    login_attempts: user.login_attempts,
    created_at:
      user.created_at instanceof Date
        ? user.created_at.toISOString()
        : String(user.created_at),
    updated_at:
      user.updated_at instanceof Date
        ? user.updated_at.toISOString()
        : user.updated_at
          ? String(user.updated_at)
          : undefined,
    last_login:
      user.last_login instanceof Date
        ? user.last_login.toISOString()
        : user.last_login,
    is_verified: user.is_verified,
    email_verified: user.email_verified,
  };
}

@ApiTags('🔐 Authentication')
@ApiCookieAuth()
@Controller('auth')
@RateLimit({ group: 'auth' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly emailPolicyConfig = getEmailPolicyConfigFromEnv();
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private auditorService: AuditorService,
    private reviewerService: ReviewerService,
    private subadminService: SubadminService,
    private organizationService: OrganizationService,
    private fileUploadService: FileUploadService,
    private passwordGeneratorService: PasswordGeneratorService,
    private industryService: IndustryService,
    private databaseService: DatabaseService,
    private employeeService: EmployeeService,
  ) {}

  private async activateEmployeeOnFirstLogin(user: PublicUser): Promise<void> {
    if (user.role !== 'organization_member' || user.last_login) {
      return;
    }

    try {
      await this.employeeService.activatePendingStatusOnFirstLogin(user.id);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to auto-activate employee ${user.id} on first login: ${isErrorWithStack(error) ? error.stack : String(error)}`,
      );
    }
  }

  private normalizeAndValidateEmail(
    email: string,
    options?: { requireOrganizational?: boolean },
  ): string {
    const result = validateEmailWithPolicy(email, {
      config: this.emailPolicyConfig,
      requireOrganizational: options?.requireOrganizational ?? false,
    });

    if (!result.isValid) {
      throw new BadRequestException(result.reason ?? 'Invalid email');
    }

    return result.normalizedEmail;
  }

  @Post('register-admin-public')

  @SwaggerRegisterAdminPublic()
  async registerAdminPublic(
    @Body() dto: PublicAdminRegisterDto,
  ): Promise<AdminRegisterResponse> {
    try {
      const user = await this.usersService.create({
        email: this.normalizeAndValidateEmail(dto.email),
        password: dto.password,
        role: 'admin' as UserRole,
      });

      await this.usersService.markAsVerified(user.id);

      return {
        message:
          'Admin account created successfully. You can now login with your credentials.',
        userId: user.id,
        email: user.email,
        role: 'admin',
      };
    } catch (error: unknown) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (
        isDbError(error) &&
        (error.code === '23505' || error.code === 'ER_DUP_ENTRY')
      ) {
        throw new ConflictException('Email already registered');
      }

      this.logger.error(
        'Error creating admin account',
        isErrorWithStack(error) ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to create admin account');
    }
  }

  @Post('register')

  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles('admin', 'subadmin')
  @SwaggerRegisterAuditorReviewer()
  async register(
    @Body() dto: CreateAuditorReviewerDto,
  ): Promise<RegisterAuditorReviewerResponse> {
    if (
      dto.role !== AuditorReviewerRole.AUDITOR &&
      dto.role !== AuditorReviewerRole.REVIEWER
    ) {
      throw new BadRequestException(
        'Role must be either "auditor" or "reviewer"',
      );
    }

    const generatedPassword = this.passwordGeneratorService.generate();

    const user = await this.usersService.create({
      email: this.normalizeAndValidateEmail(dto.email),
      password: generatedPassword,
      role: dto.role as UserRole,
    });

    await this.usersService.markAsVerified(user.id);

    let profile: Record<string, unknown>;
    if (dto.role === AuditorReviewerRole.AUDITOR) {
      profile = await this.auditorService.create(
        user.id,
        dto.first_name,
        dto.last_name,
        dto.country,
        dto.state,
        dto.city,
        undefined,
        dto.assigned_certificates,
        dto.status,
        dto.accountStatus,
      );
    } else {
      profile = await this.reviewerService.create(
        user.id,
        dto.first_name,
        dto.last_name,
        undefined,
        dto.tags,
        dto.accountStatus,
      );
    }

    // Send credentials email in background — don't block API response
    this.authService.sendCredentialsEmail(
      dto.email,
      generatedPassword,
      dto.role === 'auditor' ? 'Auditor' : 'Reviewer',
      { createdBy: 'admin' },
    ).catch((e) => {
      const errorMsg = isErrorWithStack(e)
        ? `${String(e)}\n${e.stack}`
        : String(e);
      this.logger.error(
        `Failed to send credentials email to ${dto.email}: ${errorMsg}`,
      );
    });

    return {
      message: `${dto.role.charAt(0).toUpperCase() + dto.role.slice(1)} registered successfully. Email and auto-generated password sent to user email. User is verified and can login immediately.`,
      userId: user.id,
      email: user.email,
      role: dto.role,
      profile,
    };
  }

  @Post('register-subadmin')

  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles('admin', 'subadmin')
  @SwaggerRegisterSubadmin()
  async registerSubadmin(
    @Body() dto: CreateSubadminDto,
  ): Promise<SubadminRegisterResponse> {
    const generatedPassword = this.passwordGeneratorService.generate();

    const user = await this.usersService.create({
      email: this.normalizeAndValidateEmail(dto.email),
      password: generatedPassword,
      role: 'subadmin' as UserRole,
    });

    await this.usersService.markAsVerified(user.id);

    const profile = await this.subadminService.create(
      user.id,
      dto.first_name,
      dto.last_name,
    );

    // Send credentials email in background — don't block API response
    this.authService.sendCredentialsEmail(
      user.email,
      generatedPassword,
      'subadmin',
      { createdBy: 'admin' },
    ).catch((e) => {
      const errorMsg = isErrorWithStack(e)
        ? `${String(e)}\n${e.stack}`
        : String(e);
      this.logger.error(
        `Failed to send credentials email to ${user.email}: ${errorMsg}`,
      );
    });

    return {
      message:
        'Subadmin registered successfully. Email and auto-generated password sent to user email. User is verified and can login immediately.',
      userId: user.id,
      email: user.email,
      role: 'subadmin',
      profile,
    };
  }

  @Post('register-organization')

  @SwaggerRegisterOrganization()
  async registerOrganization(
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationRegisterResponse> {
    try {
      const accountEmail = this.normalizeAndValidateEmail(dto.email, {
        requireOrganizational: true,
      });

      const organizationEmail = dto.organization_email
        ? this.normalizeAndValidateEmail(dto.organization_email, {
            requireOrganizational: true,
          })
        : undefined;

      const existingUser = await this.usersService.findByEmail(accountEmail);
      if (existingUser) {
        if (!existingUser.is_verified) {
          throw new ConflictException(
            'Your account is already created with this email but not verified. Kindly verify your account.',
          );
        }
        throw new ConflictException('Email already registered');
      }

      // Check for duplicate organization email
      if (organizationEmail) {
        const existingOrgEmail =
          await this.organizationService.findByEmail(organizationEmail);
        if (existingOrgEmail) {
          throw new ConflictException(
            'An organization with this email already exists',
          );
        }
      }

      // Check for duplicate organization phone number
      if (dto.contact_no) {
        const existingOrgPhone = await this.organizationService.findByContactNo(
          dto.contact_no,
        );
        if (existingOrgPhone) {
          throw new ConflictException(
            'An organization with this phone number already exists',
          );
        }
      }

      for (const industryId of dto.industry_ids) {
        const industry = await this.industryService.findById(industryId);
        if (!industry) {
          throw new BadRequestException(
            `Industry with ID ${industryId} not found`,
          );
        }
      }

      const existingOrg = await this.organizationService.findByBusinessId(
        dto.business_id,
      );
      if (existingOrg) {
        throw new ConflictException(
          'Organization with this business ID already exists',
        );
      }

      if (!dto.industry_ids || dto.industry_ids.length === 0) {
        throw new BadRequestException('At least 1 industry is required');
      }
      if (dto.industry_ids.length > 5) {
        throw new BadRequestException('Maximum 5 industries are allowed');
      }

      if (
        dto.organization_name.length < 2 ||
        dto.organization_name.length > 255
      ) {
        throw new BadRequestException(
          'Organization name must be between 2 and 255 characters',
        );
      }

      if (dto.description.length < 10 || dto.description.length > 1000) {
        throw new BadRequestException(
          'Description must be between 10 and 1000 characters',
        );
      }

      const { user, organization } = await this.databaseService.transaction(
        async () => {
          const createdUser = await this.usersService.create({
            email: accountEmail,
            password: dto.password,
            role: 'organization' as UserRole,
          });

          const createdOrganization = await this.organizationService.create(
            createdUser.id,
            {
              name: dto.organization_name,
              industry_ids: dto.industry_ids,
              business_id: dto.business_id,
              legal_country: dto.country,
              legal_state: dto.state,
              legal_city: dto.city,
              description: dto.description,
              contact_no: dto.contact_no,
              email: organizationEmail,
            },
          );

          return {
            user: createdUser,
            organization: createdOrganization,
          };
        },
      );

      try {
        await this.authService.sendOtp(user.email, 'email_verification');
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to send OTP email during organization registration for ${user.email}: ${isErrorWithStack(error) ? error.stack : String(error)}`,
        );
      }

      const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

      return {
        message: `Organization registered successfully. OTP sent to your email. Please verify your email within ${otpExpiryMinutes} minutes.`,
        userId: user.id,
        email: user.email,
        organization: { ...organization },
      };
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (isDbError(error)) {
        if (error.code === '23505' || error.code === 'ER_DUP_ENTRY') {
          // Check which field caused the duplicate constraint
          const errorMsg = String(
            (error as any).message || error,
          ).toLowerCase();
          if (errorMsg.includes('contact_no') || errorMsg.includes('phone')) {
            throw new ConflictException(
              'An organization with this phone number already exists',
            );
          }
          if (errorMsg.includes('email')) {
            throw new ConflictException(
              'An organization with this email already exists',
            );
          }
          if (errorMsg.includes('business_id')) {
            throw new ConflictException(
              'Organization with this business ID already exists',
            );
          }
          // Default fallback
          throw new ConflictException('A duplicate record already exists');
        }
      }
      this.logger.error(
        'Error registering organization',
        isErrorWithStack(error) ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to register organization');
    }
  }

  @Post('login')

  @UseInterceptors(LoginInterceptor)
  @SwaggerLogin()
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Request() req: ExpressRequest,
  ): Promise<LoginResponse> {
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = parseInt(
      process.env.LOGIN_LOCKOUT_MINUTES || '30',
      10,
    );

    const userRecord = await this.usersService.findByEmail(
      this.normalizeAndValidateEmail(dto.email),
    );
    if (!userRecord) {
      throw new UnauthorizedException(
        'Email not registered. Please sign up first.',
      );
    }
    if (
      userRecord.locked_until &&
      new Date(userRecord.locked_until) > new Date()
    ) {
      const remainingMinutes = Math.ceil(
        (new Date(userRecord.locked_until).getTime() - Date.now()) /
          (1000 * 60),
      );
      throw new BadRequestException(
        `Account locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
      );
    }

    if (
      userRecord.locked_until &&
      new Date(userRecord.locked_until) <= new Date()
    ) {
      await this.usersService.resetLoginAttempts(userRecord.id);
      const refreshedUser = await this.usersService.findByEmail(
        this.normalizeAndValidateEmail(dto.email),
      );
      if (refreshedUser) {
        Object.assign(userRecord, refreshedUser);
      }
    }

    if (!userRecord.is_active) {
      throw new BadRequestException(
        'Account is inactive. Please contact support.',
      );
    }

    if (userRecord.is_deleted) {
      throw new BadRequestException('Account has been deleted.');
    }

    if (userRecord.role === 'auditor') {
      const auditor = await this.auditorService.findByUserId(userRecord.id);
      if (!auditor) {
        throw new BadRequestException(
          'Auditor profile not found. Please contact support.',
        );
      }

      const accountStatus =
        auditor.accountstatus ??
        auditor.accountStatus ??
        auditor.account_status;

      this.logger.debug(
        `Auditor login check - userId: ${userRecord.id}, accountStatus: ${accountStatus}, type: ${typeof accountStatus}, isTrue: ${accountStatus === true}, raw keys: ${Object.keys(auditor).join(', ')}`,
      );

      const isActive =
        accountStatus === true || accountStatus === 't' || accountStatus === 1;

      if (!isActive) {
        this.logger.warn(
          `Blocked login attempt for auditor ${userRecord.id} - accountStatus is ${accountStatus} (type: ${typeof accountStatus})`,
        );
        throw new BadRequestException(
          'Account is not active. Please contact support.',
        );
      }
    }

    if (userRecord.role === 'reviewer') {
      const reviewer = await this.reviewerService.findByUserId(userRecord.id);
      if (!reviewer) {
        throw new BadRequestException(
          'Reviewer profile not found. Please contact support.',
        );
      }

      const accountStatus =
        reviewer.accountstatus ??
        reviewer.accountStatus ??
        reviewer.account_status;

      this.logger.debug(
        `Reviewer login check - userId: ${userRecord.id}, accountStatus: ${accountStatus}, type: ${typeof accountStatus}, isTrue: ${accountStatus === true}, raw keys: ${Object.keys(reviewer).join(', ')}`,
      );

      const isActive =
        accountStatus === true || accountStatus === 't' || accountStatus === 1;

      if (!isActive) {
        this.logger.warn(
          `Blocked login attempt for reviewer ${userRecord.id} - accountStatus is ${accountStatus} (type: ${typeof accountStatus})`,
        );
        throw new BadRequestException(
          'Account is not active. Please contact support.',
        );
      }
    }

    const user = await this.authService.validateUser(
      this.normalizeAndValidateEmail(dto.email),
      dto.password,
    );
    if (!user) {
      if (userRecord.is_verified) {
        await this.usersService.incrementLoginAttempts(
          userRecord.id,
          LOCKOUT_MINUTES,
        );

        const updatedUser = await this.usersService.findByEmail(
          this.normalizeAndValidateEmail(dto.email),
        );
        const remainingAttempts =
          MAX_LOGIN_ATTEMPTS - (updatedUser?.login_attempts || 0);

        const device = req.get?.('User-Agent') || 'Unknown';
        const location = await resolveRequestLocation(req);
        try {
          await this.usersService.insertLoginLog(
            userRecord.id,
            this.normalizeAndValidateEmail(dto.email),
            device,
            location,
          );
        } catch (err: unknown) {
          this.logger.debug(
            'Failed to insert login log',
            isErrorWithStack(err) ? err.stack : String(err),
          );
        }

        if (
          updatedUser?.locked_until &&
          new Date(updatedUser.locked_until) > new Date()
        ) {
          throw new BadRequestException(
            `Account locked due to too many failed login attempts. Please try again in ${LOCKOUT_MINUTES} minute${LOCKOUT_MINUTES > 1 ? 's' : ''}.`,
          );
        }

        throw new UnauthorizedException(
          `Password incorrect. You have ${Math.max(0, remainingAttempts)} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
        );
      }

      throw new UnauthorizedException('Password incorrect.');
    }

    const requiresOtpVerification = user.role === 'organization';

    if (!user.is_verified) {
      if (requiresOtpVerification) {
        throw new BadRequestException(
          'Please verify your email with OTP before login. Use /auth/send-otp to request a new OTP.',
        );
      } else {
        throw new BadRequestException(
          'Please verify your account before login.',
        );
      }
    }

    await this.activateEmployeeOnFirstLogin(user);
    await this.usersService.resetLoginAttempts(user.id);

    const result = await this.authService.login(user);

    const { access_token, refresh_token } = result.tokens;
    const cookieOptsAccess = getCookieOptions(process.env.JWT_EXPIRES_IN);
    const cookieOptsRefresh = getCookieOptions(
      process.env.JWT_REFRESH_EXPIRES_IN,
    );
    res.cookie('access_token', access_token, cookieOptsAccess);
    res.cookie('refresh_token', refresh_token, cookieOptsRefresh);

    return {
      user: toUserResponseSerialized(result.user),
      tokens: result.tokens,
    };
  }

  @Post('refresh')

  @SwaggerRefreshToken()
  async refresh(
    @Body() body: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.refresh(body.refresh_token);
    const { access_token, refresh_token } = result.tokens;
    const cookieOptsAccess = getCookieOptions(process.env.JWT_EXPIRES_IN);
    const cookieOptsRefresh = getCookieOptions(
      process.env.JWT_REFRESH_EXPIRES_IN,
    );
    res.cookie('access_token', access_token, cookieOptsAccess);
    res.cookie('refresh_token', refresh_token, cookieOptsRefresh);
    return {
      user: toUserResponseSerialized(result.user),
      tokens: result.tokens,
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @SwaggerLogout()
  async logout(
    @Request() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(req.user.sub);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(AuthGuard('jwt'))
  @SwaggerLogoutAll()
  async logoutAll(
    @Request() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logoutAll(req.user.sub);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out from all sessions successfully' };
  }

  @Post('send-otp')

  @SwaggerSendOtp()
  async sendOtp(@Body() dto: SendOtpDto): Promise<OtpResponseDto> {
    const purpose = dto.purpose || 'email_verification';
    const result = await this.authService.sendOtp(
      this.normalizeAndValidateEmail(dto.email),
      purpose,
    );
    return {
      message: result.message,
      userId: result.userId,
      email: this.normalizeAndValidateEmail(dto.email),
      otp: process.env.NODE_ENV === 'development' ? result.otp : undefined,
      otp_expires_at:
        process.env.NODE_ENV === 'development'
          ? result.otpExpiresAt
            ? result.otpExpiresAt.toISOString()
            : undefined
          : undefined,
    };
  }

  @Post('verify-otp')

  @SwaggerVerifyOtp()
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VerifyOtpResponse> {
    const user = await this.usersService.findByEmail(
      this.normalizeAndValidateEmail(dto.email),
    );
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isFirstVerification = user.is_verified === false;

    const purpose = dto.purpose || 'email_verification';
    const verificationResult = await this.authService.verifyOtp(
      user.id,
      dto.otp,
      purpose,
    );

    if (isFirstVerification) {
      await this.activateEmployeeOnFirstLogin(verificationResult.user);
      const loginResult = await this.authService.login(verificationResult.user);

      const { access_token, refresh_token } = loginResult.tokens;
      const cookieOptsAccess = getCookieOptions(process.env.JWT_EXPIRES_IN);
      const cookieOptsRefresh = getCookieOptions(
        process.env.JWT_REFRESH_EXPIRES_IN,
      );
      res.cookie('access_token', access_token, cookieOptsAccess);
      res.cookie('refresh_token', refresh_token, cookieOptsRefresh);

      return {
        message: verificationResult.message,
        user: toUserResponseSerialized(loginResult.user),
        tokens: loginResult.tokens,
      };
    }

    return {
      message: verificationResult.message,
      user: toUserResponseSerialized(verificationResult.user),
    };
  }

  @Post('resend-otp')

  @SwaggerResendOtp()
  async resendOtp(@Body() dto: SendOtpDto): Promise<OtpResponseDto> {
    const purpose = dto.purpose || 'email_verification';
    const result = await this.authService.resendOtp(
      this.normalizeAndValidateEmail(dto.email),
      purpose,
    );
    return {
      message: result.message,
      userId: result.userId,
      email: this.normalizeAndValidateEmail(dto.email),
      otp: process.env.NODE_ENV === 'development' ? result.otp : undefined,
      otp_expires_at:
        process.env.NODE_ENV === 'development'
          ? result.otpExpiresAt
            ? result.otpExpiresAt.toISOString()
            : undefined
          : undefined,
    };
  }

  @Post('update-password')
  @UseGuards(AuthGuard('jwt'))
  @SwaggerUpdatePassword()
  async updatePassword(
    @Request() req: RequestWithUser,
    @Body() dto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.updatePassword(
      req.user.sub,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  @Post('forgot-password')

  @SwaggerForgotPassword()
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(
      this.normalizeAndValidateEmail(dto.email),
      dto.otp,
      dto.newPassword,
    );
  }

  @Post('resend-credentials')
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles('admin', 'subadmin', 'organization')
  @SwaggerResendCredentials()
  async resendCredentials(
    @Request() req: RequestWithUser,
    @Body() dto: ResendCredentialsDto,
  ): Promise<{ message: string; email: string }> {
    const requesterUserId = req.user.sub;
    const requesterRole = req.user.role;

    return this.authService.resendCredentials(
      this.normalizeAndValidateEmail(dto.email),
      requesterUserId,
      requesterRole,
      this.passwordGeneratorService,
    );
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @SwaggerGetMyProfile()
  async getMyProfile(
    @Request() req: RequestWithUser,
  ): Promise<{ message: string; data: Record<string, unknown> }> {
    const userId = req.user.sub;
    const userRole = req.user.role;

    const profile = await this.authService.getMyProfile(userId, userRole);

    return {
      message: 'Profile retrieved successfully',
      data: profile,
    };
  }
}
