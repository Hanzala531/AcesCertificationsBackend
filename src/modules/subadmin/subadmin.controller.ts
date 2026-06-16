import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  UseGuards,
  Request,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Body,
  NotFoundException,
  Inject,
  HttpException,
  Query,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import { SubadminService } from './subadmin.service';
import { AuthService } from '../auth/auth.service';
import type { RequestWithUser } from '../auth/types/auth.types';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import {
  UpdateProfileDto,
  UpdateEmailDto,
  UpdatePasswordDto,
  UpdateAccountStatusDto,
} from './dto/update-profile.dto';
import { PermissionArrayDto } from '../employee/dto/permission.dto';
import { UsersService } from '../users/users.service';
import { isErrorWithStack } from '../../common/utils/error.util';
import {
  SwaggerGetSubadminProfile,
  SwaggerGetSubadminProfileById,
  SwaggerUpdateSubadminProfile,
  SwaggerUpdateSubadminEmail,
  SwaggerUpdateSubadminPassword,
  SwaggerDeleteSubadminProfile,
  SwaggerListSubadmins,
  SwaggerUpdateSubadminAccountStatus,
  SwaggerGrantSubadminPermissions,
  SwaggerRemoveSubadminPermissions,
} from './swagger/subadmin.swagger';

const BCRYPT_ROUNDS = 12;

interface GetProfileResponse {
  message: string;
  data: Record<string, unknown>;
}

interface UpdateProfileResponse {
  message: string;
  data: Record<string, unknown>;
}

interface DeleteProfileResponse {
  message: string;
  data: null;
}

interface UpdateEmailResponse {
  message: string;
  userId: string;
  email: string;
}

interface UpdatePasswordResponse {
  message: string;
  userId: string;
}

@ApiTags('👤 Subadmin Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@Controller('subadmins')
export class SubadminController {
  private readonly logger = new Logger(SubadminController.name);

  constructor(
    private subadminService: SubadminService,
    private usersService: UsersService,
    @Inject(AuthService) private authService: AuthService,
  ) {}

  @Get('profile')
  @SwaggerGetSubadminProfile()
  async getProfile(
    @Request() req: RequestWithUser,
  ): Promise<GetProfileResponse> {
    const userId = req.user.sub;
    const subadmin = await this.subadminService.findByUserId(userId);

    if (!subadmin) {
      throw new NotFoundException('Subadmin profile not found');
    }

    return {
      message: 'Profile retrieved successfully',
      data: subadmin,
    };
  }

  @Get('list')
  @Roles('admin', 'subadmin')
  @SwaggerListSubadmins()
  async listSubadmins(
    @Query('limit') limit?: number,
    @Query('pageNumber') pageNumber?: number,
  ): Promise<{
    message: string;
    data: Array<{
      id: string;
      name: string;
      email: string;
      profile_picture?: string | null;
      accountStatus: boolean;
      permissions?: unknown[];
    }>;
    total: number;
  }> {
    const pageLimit = limit ? parseInt(String(limit), 10) : 25;
    const page = pageNumber ? parseInt(String(pageNumber), 10) : 1;
    const offset = (page - 1) * pageLimit;

    const result = await this.subadminService.findAll({
      limit: pageLimit,
      offset: offset,
    });

    const formattedSubadmins = result.subadmins.map((subadmin) => {
      const firstName =
        typeof subadmin.first_name === 'string' ? subadmin.first_name : '';
      const lastName =
        typeof subadmin.last_name === 'string' ? subadmin.last_name : '';
      const email = typeof subadmin.email === 'string' ? subadmin.email : '';

      const accountStatusValue = subadmin.accountStatus as boolean;

      return {
        id: subadmin.id as string,
        name: `${firstName} ${lastName}`.trim(),
        email,
        profile_picture: (subadmin.profile_picture as string | null) || null,
        accountStatus: accountStatusValue,
        permissions: (subadmin.permissions as unknown[]) || [],
      };
    });

    return {
      message: 'Subadmins retrieved successfully',
      data: formattedSubadmins,
      total: result.total,
    };
  }

  @Patch('profile')
  @Roles('subadmin', 'admin')
  @SwaggerUpdateSubadminProfile()
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
    @Query('subadminId') subadminId?: string,
  ): Promise<UpdateProfileResponse> {
    let targetSubadminId: string;
    if (req.user.role === 'admin' && subadminId) {
      targetSubadminId = subadminId;
    } else {
      const userId = req.user.sub;
      const subadmin = await this.subadminService.findByUserId(userId);
      if (!subadmin) {
        throw new NotFoundException('Subadmin profile not found');
      }
      targetSubadminId = subadmin.id as string;
    }

    const subadmin = await this.subadminService.findById(targetSubadminId);
    if (!subadmin) {
      throw new NotFoundException('Subadmin profile not found');
    }

    if (
      dto.profile_picture_url &&
      !this.isCloudinaryUrl(dto.profile_picture_url)
    ) {
      throw new BadRequestException(
        'Profile picture URL must be from Cloudinary',
      );
    }

    if (dto.accountStatus !== undefined && req.user.role !== 'admin') {
      throw new BadRequestException('Only admin can update account status');
    }

    const updateFields: Record<string, unknown> = {};
    if (dto.first_name) updateFields.first_name = dto.first_name;
    if (dto.last_name) updateFields.last_name = dto.last_name;
    if (dto.profile_picture_url) {
      updateFields.profile_picture = dto.profile_picture_url;
    }
    if (dto.accountStatus !== undefined && req.user.role === 'admin') {
      updateFields.accountStatus = dto.accountStatus;
    }

    const updatedProfile = await this.subadminService.update(
      subadmin.id as string,
      updateFields,
    );

    return {
      message: 'Profile updated successfully',
      data: updatedProfile || {},
    };
  }

  @Get(':subadminId/profile')
  @Roles('admin', 'subadmin')
  @SwaggerGetSubadminProfileById()
  async getSubadminProfileById(
    @Param('subadminId') subadminId: string,
  ): Promise<GetProfileResponse> {
    const subadmin = await this.subadminService.findById(subadminId);
    if (!subadmin) {
      throw new NotFoundException('Subadmin profile not found');
    }
    return {
      message: 'Profile retrieved successfully',
      data: subadmin,
    };
  }

  @Patch('email')
  @SwaggerUpdateSubadminEmail()
  async updateEmail(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateEmailDto,
  ): Promise<UpdateEmailResponse> {
    const userId = req.user.sub;
    const purpose = 'email_verification';

    try {
      const otpRecord = await this.usersService.verifyOtp(
        userId,
        dto.otp,
        purpose,
      );

      if (!otpRecord) {
        throw new BadRequestException(
          'Invalid or expired OTP for email verification',
        );
      }

      if (new Date(otpRecord.expires_at) < new Date()) {
        throw new BadRequestException(
          'OTP has expired. Please request a new OTP using send-otp endpoint.',
        );
      }

      if (otpRecord.is_used) {
        throw new BadRequestException(
          'OTP has already been used. Please request a new OTP.',
        );
      }

      const MAX_OTP_ATTEMPTS = 5;
      if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
        throw new BadRequestException(
          'Maximum OTP attempts exceeded. Please request a new OTP.',
        );
      }

      if (otpRecord.otp_code !== dto.otp) {
        await this.usersService.incrementOtpAttempts(otpRecord.id);
        throw new BadRequestException('Invalid OTP code');
      }

      await this.usersService.markOtpAsUsed(otpRecord.id);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.debug(
        'OTP verification failed',
        isErrorWithStack(error) ? error.stack : String(error),
      );
      throw new BadRequestException('OTP verification failed');
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException('Email already in use');
    }

    const updated = await this.usersService.updateEmail(
      userId,
      dto.email.toLowerCase(),
    );

    return {
      message: 'Email updated successfully',
      userId: updated.id,
      email: updated.email,
    };
  }

  @Patch('password')
  @SwaggerUpdateSubadminPassword()
  async updatePassword(
    @Request() req: RequestWithUser,
    @Body() dto: UpdatePasswordDto,
  ): Promise<UpdatePasswordResponse> {
    const userId = req.user.sub;
    const purpose = 'password_reset';

    try {
      const user = await this.usersService.findByIdOrThrow(userId);
      const isPasswordValid = await this.usersService.verifyPassword(
        dto.oldPassword,
        user.password,
      );
      if (!isPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      const otpRecord = await this.usersService.verifyOtp(
        userId,
        dto.otp,
        purpose,
      );

      if (!otpRecord) {
        throw new BadRequestException(
          'Invalid or expired OTP for password reset',
        );
      }

      if (new Date(otpRecord.expires_at) < new Date()) {
        throw new BadRequestException(
          'OTP has expired. Please request a new OTP using send-otp endpoint.',
        );
      }

      if (otpRecord.is_used) {
        throw new BadRequestException(
          'OTP has already been used. Please request a new OTP.',
        );
      }

      const MAX_OTP_ATTEMPTS = 5;
      if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
        throw new BadRequestException(
          'Maximum OTP attempts exceeded. Please request a new OTP.',
        );
      }

      if (otpRecord.otp_code !== dto.otp) {
        await this.usersService.incrementOtpAttempts(otpRecord.id);
        throw new BadRequestException('Invalid OTP code');
      }

      await this.usersService.markOtpAsUsed(otpRecord.id);

      const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

      await this.usersService.updatePassword(userId, hashedPassword);

      return {
        message: 'Password updated successfully',
        userId,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        'Error updating password',
        isErrorWithStack(error) ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to update password');
    }
  }

  @Delete('profile')
  @SwaggerDeleteSubadminProfile()
  async deleteProfile(
    @Request() req: RequestWithUser,
  ): Promise<DeleteProfileResponse> {
    const userId = req.user.sub;
    const subadmin = await this.subadminService.findByUserId(userId);

    if (!subadmin) {
      throw new NotFoundException('Subadmin profile not found');
    }

    await this.subadminService.delete(subadmin.id as string);

    await this.usersService.markAsDeleted(userId);

    return {
      message: 'Profile deleted successfully',
      data: null,
    };
  }

  @Patch(':subadminId/account-status')
  @Roles('admin', 'subadmin')
  @SwaggerUpdateSubadminAccountStatus()
  async updateAccountStatus(
    @Param('subadminId') subadminId: string,
    @Body() dto: UpdateAccountStatusDto,
  ): Promise<{
    message: string;
    data: Record<string, unknown>;
  }> {
    const subadmin = await this.subadminService.findById(subadminId);
    if (!subadmin) {
      throw new NotFoundException('Subadmin not found');
    }

    const updated = await this.subadminService.update(subadminId, {
      accountStatus: dto.accountStatus,
    });

    return {
      message: 'Account status updated successfully',
      data: updated || {},
    };
  }

  @Post(':subadminId/permissions/grant')
  @Roles('admin', 'subadmin')
  @SwaggerGrantSubadminPermissions()
  async grantPermissions(
    @Param('subadminId') subadminId: string,
    @Body() body: PermissionArrayDto,
  ): Promise<{
    message: string;
    data: unknown[] | null;
  }> {
    const result = await this.subadminService.grantPermissions(
      subadminId,
      body.permissions || [],
    );
    return { message: 'Permissions granted', data: result };
  }

  @Post(':subadminId/permissions/remove')
  @Roles('admin', 'subadmin')
  @SwaggerRemoveSubadminPermissions()
  async removePermissions(
    @Param('subadminId') subadminId: string,
    @Body() body: PermissionArrayDto,
  ): Promise<{
    message: string;
    data: unknown[] | null;
  }> {
    const result = await this.subadminService.removePermissions(
      subadminId,
      body.permissions || [],
    );
    return { message: 'Permissions removed', data: result };
  }

  private isCloudinaryUrl(url: string): boolean {
    return /^https:\/\/res\.cloudinary\.com\/.+/.test(url);
  }
}
