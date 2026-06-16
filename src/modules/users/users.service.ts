import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository, CreatedUser } from './users.repository';
import {
  UserEntity,
  UserRole,
  OtpEntity,
  OtpPurpose,
  OrganizationEntity,
  EmployeeEntity,
  AuditorEntity,
  ReviewerEntity,
  LoginLogEntity,
} from '../../common/types/database.types';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private usersRepo: UsersRepository) {}

  async create(dto: {
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<CreatedUser> {
    if (!dto.email) throw new BadRequestException('Email is required');
    if (!dto.password) throw new BadRequestException('Password is required');

    const existing = await this.usersRepo.findByEmail(dto.email);
    if (existing)
      throw new ConflictException('User with this email already exists');

    if (dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    if (dto.password.length > 20) {
      throw new BadRequestException('Password must be at most 20 characters');
    }

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.usersRepo.create(dto.email, hashed, dto.role ?? 'organization');
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepo.findByEmail(email);
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.usersRepo.findById(id);
  }

  async setRefreshToken(userId: string, hashed: string): Promise<void> {
    return this.usersRepo.setRefreshToken(userId, hashed);
  }

  async clearRefreshToken(userId: string): Promise<void> {
    return this.usersRepo.clearRefreshToken(userId);
  }

  async setLastLogin(userId: string): Promise<void> {
    return this.usersRepo.setLastLogin(userId);
  }

  async insertLoginLog(
    userId: string,
    email?: string | null,
    device?: string | null,
    location?: string | null,
  ): Promise<void> {
    // Ensure we have an email to insert (login_logs.email is NOT NULL in schema)
    let emailToInsert = email ?? null;
    if (!emailToInsert) {
      const user = await this.findById(userId);
      if (!user || !user.email) {
        // Nothing sensible to insert; skip gracefully
        return;
      }
      emailToInsert = user.email;
    }

    return this.usersRepo.insertLoginLog(
      userId,
      emailToInsert,
      device,
      location,
    );
  }

  async setOtp(
    userId: string,
    otp: string,
    expiryTime: Date,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<void> {
    return this.usersRepo.setOtp(userId, otp, expiryTime, purpose);
  }

  async clearOtp(
    userId: string,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<void> {
    return this.usersRepo.clearOtp(userId, purpose);
  }

  async verifyUser(userId: string): Promise<void> {
    return this.usersRepo.verifyUser(userId);
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    return this.usersRepo.updatePassword(userId, hashedPassword);
  }

  async updatePasswordWithPlaintext(
    userId: string,
    plainPassword: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    return this.updatePassword(userId, hashed);
  }

  async updateEmail(userId: string, newEmail: string): Promise<UserEntity> {
    const updated = await this.usersRepo.updateEmail(userId, newEmail);
    if (!updated) throw new BadRequestException('Failed to update email');
    return updated;
  }

  async markAsDeleted(userId: string): Promise<void> {
    return this.usersRepo.markAsDeleted(userId);
  }

  async findByIdOrThrow(userId: string): Promise<UserEntity> {
    const user = await this.findById(userId);
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async markAsVerified(userId: string): Promise<void> {
    return this.usersRepo.verifyUser(userId);
  }

  async incrementLoginAttempts(
    userId: string,
    lockoutMinutes: number = 30,
  ): Promise<void> {
    return this.usersRepo.incrementLoginAttempts(userId, lockoutMinutes);
  }

  async resetLoginAttempts(userId: string): Promise<void> {
    return this.usersRepo.resetLoginAttempts(userId);
  }

  async verifyOtp(
    userId: string,
    otpCode: string,
    purpose: OtpPurpose = 'email_verification',
  ): Promise<OtpEntity | null> {
    return this.usersRepo.verifyOtp(userId, otpCode, purpose);
  }

  async incrementOtpAttempts(otpId: string): Promise<void> {
    return this.usersRepo.incrementOtpAttempts(otpId);
  }

  async markOtpAsUsed(otpId: string): Promise<void> {
    return this.usersRepo.markOtpAsUsed(otpId);
  }

  async getOrganizationByUserId(
    userId: string,
  ): Promise<OrganizationEntity | null> {
    return this.usersRepo.getOrganizationByUserId(userId);
  }

  async getEmployeeByUserId(userId: string): Promise<EmployeeEntity | null> {
    return this.usersRepo.getEmployeeByUserId(userId);
  }

  async getAuditorByUserId(userId: string): Promise<AuditorEntity | null> {
    return this.usersRepo.getAuditorByUserId(userId);
  }

  async getReviewerByUserId(userId: string): Promise<ReviewerEntity | null> {
    return this.usersRepo.getReviewerByUserId(userId);
  }

  async getLoginLogs(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    items: LoginLogEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { items, total } = await this.usersRepo.getLoginLogs(
      userId,
      page,
      limit,
    );
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
