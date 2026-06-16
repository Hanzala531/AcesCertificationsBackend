import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpService } from '../../../common/services/otp.service';
import { EmailService } from '../../../common/services/email.service';
import { AuditorService } from '../../auditor/auditor.service';
import { ReviewerService } from '../../reviewer/reviewer.service';
import { SubadminService } from '../../subadmin/subadmin.service';
import { OrganizationService } from '../../organization/organization.service';
import { EmployeeService } from '../../employee/employee.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import {
  UserEntity,
  PublicUser,
  OtpPurpose,
  UserRole,
  OrganizationEntity,
  EmployeeEntity,
  AuditorEntity,
  ReviewerEntity,
} from '../../../common/types/database.types';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let otpService: jest.Mocked<OtpService>;
  let emailService: jest.Mocked<EmailService>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockEmail = 'test@example.com';
  const mockPassword = 'password123';
  const mockHashedPassword = 'hashedPassword';

  const mockUser: UserEntity = {
    id: mockUserId,
    email: mockEmail,
    password: mockHashedPassword,
    role: 'organization' as UserRole,
    is_active: true,
    is_deleted: false,
    is_verified: false,
    email_verified: false,
    login_attempts: 0,
    last_login: null,
    locked_until: null,
    last_failed_login: null,
    refresh_token: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPublicUser: PublicUser = {
    id: mockUserId,
    email: mockEmail,
    role: 'organization' as UserRole,
    is_active: true,
    is_deleted: false,
    is_verified: false,
    email_verified: false,
    login_attempts: 0,
    last_login: null,
    locked_until: null,
    last_failed_login: null,
    created_at: mockUser.created_at,
    updated_at: mockUser.updated_at,
  };

  const mockOrganization: OrganizationEntity = {
    id: 'org-123',
    user_id: mockUserId,
    name: 'Test Organization',
    total_branches: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockEmployee: EmployeeEntity = {
    id: 'emp-123',
    user_id: mockUserId,
    first_name: 'John',
    last_name: 'Doe',
    organization_id: mockOrganization.id,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAuditor: AuditorEntity = {
    id: 'auditor-123',
    user_id: mockUserId,
    first_name: 'Jane',
    last_name: 'Smith',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockReviewer: ReviewerEntity = {
    id: 'reviewer-123',
    user_id: mockUserId,
    first_name: 'Bob',
    last_name: 'Johnson',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setRefreshToken: jest.fn(),
      clearRefreshToken: jest.fn(),
      setLastLogin: jest.fn(),
      getOrganizationByUserId: jest.fn(),
      getEmployeeByUserId: jest.fn(),
      getAuditorByUserId: jest.fn(),
      getReviewerByUserId: jest.fn(),
      setOtp: jest.fn(),
      verifyOtp: jest.fn(),
      markOtpAsUsed: jest.fn(),
      incrementOtpAttempts: jest.fn(),
      verifyUser: jest.fn(),
      updatePassword: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockOtpService = {
      generateOtp: jest.fn(),
      generateOtpExpiry: jest.fn(),
    };

    const mockEmailService = {
      sendOtpEmail: jest.fn(),
      sendCredentialsEmail: jest.fn(),
    };

    const mockAuditorService = {
      findByUserId: jest.fn(),
    };

    const mockReviewerService = {
      findByUserId: jest.fn(),
    };

    const mockSubadminService = {
      findByUserId: jest.fn(),
    };

    const mockOrganizationService = {
      findById: jest.fn(),
    };

    const mockEmployeeService = {
      findByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AuditorService, useValue: mockAuditorService },
        { provide: ReviewerService, useValue: mockReviewerService },
        { provide: SubadminService, useValue: mockSubadminService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: EmployeeService, useValue: mockEmployeeService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    otpService = module.get(OtpService);
    emailService = module.get(EmailService);

    const bcrypt = require('bcrypt');
    bcrypt.compare.mockImplementation(
      async (a: string, b: string) => a === 'valid' || a === b,
    );
    bcrypt.hash.mockImplementation(async (data: string) => `hashed_${data}`);

    configService.get.mockImplementation((key) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key];
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockEmail, 'valid');

      expect(result).toEqual(mockPublicUser);
      expect(usersService.findByEmail).toHaveBeenCalledWith(mockEmail);
    });

    it('should return null if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(mockEmail, 'valid');

      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockImplementation(async (a: string, b: string) => false);

      const result = await service.validateUser(mockEmail, 'invalid');

      expect(result).toBeNull();
      bcrypt.compare.mockImplementation(
        async (a: string, b: string) => a === 'valid' || a === b,
      );
    });
  });

  describe('login', () => {
    const mockAccessToken = 'access-token';
    const mockRefreshToken = 'refresh-token';

    beforeEach(() => {
      jwtService.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);
      usersService.findById.mockResolvedValue(mockUser);
    });

    it('should login user and return tokens', async () => {
      usersService.getOrganizationByUserId.mockResolvedValue(mockOrganization);

      const result = await service.login(mockPublicUser);

      expect(result.user).toEqual(mockPublicUser);
      expect(result.tokens.access_token).toBe(mockAccessToken);
      expect(result.tokens.refresh_token).toBe(mockRefreshToken);
      expect(usersService.setRefreshToken).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
      );
      expect(usersService.setLastLogin).toHaveBeenCalledWith(mockUserId);
    });

    it('should enrich JWT payload for organization role', async () => {
      usersService.getOrganizationByUserId.mockResolvedValue(mockOrganization);

      await service.login(mockPublicUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          email: mockEmail,
          role: 'organization',
          organization_id: mockOrganization.id,
        }),
        expect.any(Object),
      );
    });

    it('should enrich JWT payload for organization_member role', async () => {
      const employeeUser = {
        ...mockPublicUser,
        role: 'organization_member' as UserRole,
      };
      usersService.getEmployeeByUserId.mockResolvedValue(mockEmployee);

      await service.login(employeeUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          email: mockEmail,
          role: 'organization_member',
          employee_id: mockEmployee.id,
          organization_id: mockOrganization.id,
        }),
        expect.any(Object),
      );
    });

    it('should enrich JWT payload for auditor role', async () => {
      const auditorUser = { ...mockPublicUser, role: 'auditor' as UserRole };
      usersService.getAuditorByUserId.mockResolvedValue(mockAuditor);

      await service.login(auditorUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          email: mockEmail,
          role: 'auditor',
          auditor_id: mockAuditor.id,
        }),
        expect.any(Object),
      );
    });

    it('should enrich JWT payload for reviewer role', async () => {
      const reviewerUser = { ...mockPublicUser, role: 'reviewer' as UserRole };
      usersService.getReviewerByUserId.mockResolvedValue(mockReviewer);

      await service.login(reviewerUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          email: mockEmail,
          role: 'reviewer',
          reviewer_id: mockReviewer.id,
        }),
        expect.any(Object),
      );
    });

    it('should throw UnauthorizedException if user not found during login', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.login(mockPublicUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    const mockRefreshToken = 'refresh-token';
    const mockAccessToken = 'new-access-token';
    const mockNewRefreshToken = 'new-refresh-token';
    const mockPayload = {
      sub: mockUserId,
      email: mockEmail,
      role: 'organization',
    };

    beforeEach(() => {
      jwtService.verify.mockReturnValue(mockPayload);
      jwtService.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockNewRefreshToken);
      const userWithRefreshToken = {
        ...mockUser,
        refresh_token: mockRefreshToken,
      };
      usersService.findById.mockResolvedValue(userWithRefreshToken);
    });

    it('should refresh tokens successfully', async () => {
      const result = await service.refresh(mockRefreshToken);

      expect(result.tokens.access_token).toBe(mockAccessToken);
      expect(result.tokens.refresh_token).toBe(mockNewRefreshToken);
      expect(jwtService.verify).toHaveBeenCalledWith(
        mockRefreshToken,
        expect.any(Object),
      );
      expect(usersService.setRefreshToken).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh token does not match', async () => {
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockImplementation(async (a: string, b: string) => false);

      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      bcrypt.compare.mockImplementation(
        async (a: string, b: string) => a === 'valid' || a === b,
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const result = await service.logout(mockUserId);

      expect(result.message).toBe('Logged out successfully');
      expect(usersService.clearRefreshToken).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('sendOtp', () => {
    const mockOtp = '123456';
    const mockExpiryTime = new Date();

    beforeEach(() => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      otpService.generateOtp.mockReturnValue(mockOtp);
      otpService.generateOtpExpiry.mockReturnValue(mockExpiryTime);
    });

    it('should send OTP successfully', async () => {
      const result = await service.sendOtp(mockEmail);

      expect(result.userId).toBe(mockUserId);
      expect(result.message).toBe('OTP sent successfully to your email');
      expect(usersService.setOtp).toHaveBeenCalledWith(
        mockUserId,
        mockOtp,
        mockExpiryTime,
        'email_verification',
      );
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
        mockEmail,
        mockOtp,
        'email_verification',
      );
    });

    it('should include OTP in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result = await service.sendOtp(mockEmail);

      expect(result.otp).toBe(mockOtp);
      expect(result.otpExpiresAt).toBe(mockExpiryTime);

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw BadRequestException if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.sendOtp(mockEmail)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle email sending failure gracefully', async () => {
      emailService.sendOtpEmail.mockRejectedValue(new Error('Email failed'));

      const result = await service.sendOtp(mockEmail);

      expect(result.message).toBe('OTP sent successfully to your email');
    });
  });

  describe('verifyOtp', () => {
    const mockOtp = '123456';
    const mockOtpRecord = {
      id: 'otp-123',
      user_id: mockUserId,
      otp_code: mockOtp,
      expires_at: new Date(Date.now() + 15 * 60 * 1000),
      is_used: false,
      attempts: 0,
      purpose: 'email_verification' as OtpPurpose,
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      usersService.findById.mockResolvedValue(mockUser);
      usersService.verifyOtp.mockResolvedValue(mockOtpRecord);
      usersService.verifyUser.mockResolvedValue(undefined);
    });

    it('should verify OTP successfully', async () => {
      const result = await service.verifyOtp(mockUserId, mockOtp);

      expect(result.message).toBe('Email verified successfully');
      expect(result.user).toEqual(mockPublicUser);
      expect(usersService.markOtpAsUsed).toHaveBeenCalledWith(mockOtpRecord.id);
      expect(usersService.verifyUser).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw BadRequestException if user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.verifyOtp(mockUserId, mockOtp)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      usersService.verifyOtp.mockResolvedValue(null);

      await expect(service.verifyOtp(mockUserId, mockOtp)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired OTP', async () => {
      usersService.verifyOtp.mockResolvedValue({
        ...mockOtpRecord,
        expires_at: new Date(Date.now() - 1000),
      });

      await expect(service.verifyOtp(mockUserId, mockOtp)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for used OTP', async () => {
      usersService.verifyOtp.mockResolvedValue({
        ...mockOtpRecord,
        is_used: true,
      });

      await expect(service.verifyOtp(mockUserId, mockOtp)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for maximum OTP attempts', async () => {
      usersService.verifyOtp.mockResolvedValue({
        ...mockOtpRecord,
        attempts: 5,
      });

      await expect(service.verifyOtp(mockUserId, mockOtp)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should increment attempts for wrong OTP', async () => {
      usersService.verifyOtp.mockResolvedValue({
        ...mockOtpRecord,
        otp_code: 'wrong-otp',
      });

      await expect(service.verifyOtp(mockUserId, mockOtp)).rejects.toThrow(
        BadRequestException,
      );
      expect(usersService.incrementOtpAttempts).toHaveBeenCalledWith(
        mockOtpRecord.id,
      );
    });
  });

  describe('updatePassword', () => {
    const mockOldPassword = 'oldpassword';
    const mockNewPassword = 'newpassword';

    beforeEach(() => {
      usersService.findById.mockResolvedValue(mockUser);
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockImplementation(async (a, b) => a === 'oldpassword');
    });

    it('should update password successfully', async () => {
      const result = await service.updatePassword(
        mockUserId,
        mockOldPassword,
        mockNewPassword,
      );

      expect(result.message).toBe(
        'Password updated successfully. Please log in again.',
      );
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
      );
      expect(usersService.clearRefreshToken).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw BadRequestException if user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.updatePassword(mockUserId, mockOldPassword, mockNewPassword),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if old password is incorrect', async () => {
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockImplementation(async (a: string, b: string) => false);

      await expect(
        service.updatePassword(mockUserId, 'wrong', mockNewPassword),
      ).rejects.toThrow(BadRequestException);

      bcrypt.compare.mockImplementation(
        async (a: string, b: string) => a === 'valid' || a === b,
      );
    });

    it('should throw BadRequestException if new password is same as old', async () => {
      await expect(
        service.updatePassword(mockUserId, mockOldPassword, mockOldPassword),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('forgotPassword', () => {
    const mockOtp = '123456';
    const mockNewPassword = 'newpassword';
    const mockOtpRecord = {
      id: 'otp-123',
      user_id: mockUserId,
      otp_code: mockOtp,
      expires_at: new Date(Date.now() + 15 * 60 * 1000),
      is_used: false,
      attempts: 0,
      purpose: 'password_reset' as OtpPurpose,
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.verifyOtp.mockResolvedValue(mockOtpRecord);
    });

    it('should reset password successfully', async () => {
      const result = await service.forgotPassword(
        mockEmail,
        mockOtp,
        mockNewPassword,
      );

      expect(result.message).toBe(
        'Password reset successfully. Please log in with your new password.',
      );
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        mockUserId,
        expect.any(String),
      );
      expect(usersService.markOtpAsUsed).toHaveBeenCalledWith(mockOtpRecord.id);
      expect(usersService.clearRefreshToken).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw BadRequestException if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword(mockEmail, mockOtp, mockNewPassword),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no OTP found', async () => {
      usersService.verifyOtp.mockResolvedValue(null);

      await expect(
        service.forgotPassword(mockEmail, mockOtp, mockNewPassword),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired OTP', async () => {
      usersService.verifyOtp.mockResolvedValue({
        ...mockOtpRecord,
        expires_at: new Date(Date.now() - 1000),
      });

      await expect(
        service.forgotPassword(mockEmail, mockOtp, mockNewPassword),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for wrong OTP', async () => {
      usersService.verifyOtp.mockResolvedValue({
        ...mockOtpRecord,
        otp_code: 'wrong-otp',
      });

      await expect(
        service.forgotPassword(mockEmail, mockOtp, mockNewPassword),
      ).rejects.toThrow(BadRequestException);
      expect(usersService.incrementOtpAttempts).toHaveBeenCalledWith(
        mockOtpRecord.id,
      );
    });

    it('should throw BadRequestException for used OTP', async () => {
      usersService.verifyOtp.mockResolvedValue({
        ...mockOtpRecord,
        is_used: true,
      });

      await expect(
        service.forgotPassword(mockEmail, mockOtp, mockNewPassword),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if new password is same as old', async () => {
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockImplementation(async (a, b) => a === 'samepassword');

      await expect(
        service.forgotPassword(mockEmail, mockOtp, 'samepassword'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendOtp', () => {
    const mockOtp = '123456';
    const mockExpiryTime = new Date();

    beforeEach(() => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      otpService.generateOtp.mockReturnValue(mockOtp);
      otpService.generateOtpExpiry.mockReturnValue(mockExpiryTime);
    });

    it('should resend OTP successfully', async () => {
      const result = await service.resendOtp(mockEmail);

      expect(result.userId).toBe(mockUserId);
      expect(result.message).toBe('OTP resent successfully to your email');
      expect(usersService.setOtp).toHaveBeenCalledWith(
        mockUserId,
        mockOtp,
        mockExpiryTime,
        'email_verification',
      );
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
        mockEmail,
        mockOtp,
        'email_verification',
      );
    });

    it('should throw BadRequestException if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.resendOtp(mockEmail)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user is already verified for email verification', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        is_verified: true,
      });

      await expect(
        service.resendOtp(mockEmail, 'email_verification'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow OTP resend for password reset even if user is verified', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        is_verified: true,
      });

      const result = await service.resendOtp(mockEmail, 'password_reset');

      expect(result.message).toBe('OTP resent successfully to your email');
    });
  });

  describe('sendCredentialsEmail', () => {
    const mockRole = 'organization';

    it('should send credentials email successfully', async () => {
      await service.sendCredentialsEmail(mockEmail, mockPassword, mockRole);

      expect(emailService.sendCredentialsEmail).toHaveBeenCalledWith(
        mockEmail,
        mockPassword,
        mockRole,
        undefined,
      );
    });
  });

  describe('JWT configuration errors', () => {
    it('should throw error for missing JWT secret', () => {
      configService.get.mockImplementation((key) => {
        if (key === 'JWT_SECRET') return 'change-me';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        return undefined;
      });

      expect(() => service.login(mockPublicUser)).rejects.toThrow(
        'JWT_SECRET environment variable is not set',
      );
    });

    it('should throw error for missing JWT refresh secret', () => {
      configService.get.mockImplementation((key) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'change-me-refresh';
        return undefined;
      });

      expect(() => service.login(mockPublicUser)).rejects.toThrow(
        'JWT_REFRESH_SECRET environment variable is not set',
      );
    });
  });
});
