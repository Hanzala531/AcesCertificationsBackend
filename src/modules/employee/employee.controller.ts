import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Query,
  Logger,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  SwaggerInviteEmployee,
  SwaggerListEmployees,
  SwaggerGetEmployee,
  SwaggerDeleteEmployee,
  SwaggerGetMyProfile,
  SwaggerGrantPermissions,
  SwaggerRemovePermissions,
  SwaggerUpdateEmployeeProfile,
  SwaggerUpdateEmployeeEmail,
  SwaggerUpdateEmployeePassword,
  SwaggerResendInvite,
} from './swagger/employee.swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { FileUploadService } from '../../common/services/file-upload.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import {
  UpdateProfileDto,
  UpdateEmailDto,
  UpdatePasswordDto,
} from './dto/update-profile.dto';
import { isErrorWithStack } from '../../common/utils/error.util';

import type { RequestWithUser } from '../auth/types/auth.types';

const BCRYPT_ROUNDS = 12;

@ApiTags('👥 Employee Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('employee')
export class EmployeeController {
  private readonly logger = new Logger(EmployeeController.name);

  constructor(
    private employeeService: EmployeeService,
    private fileUploadService: FileUploadService,
    private usersService: UsersService,
  ) {}

  @Post('create-account')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerInviteEmployee()
  async inviteEmployee(
    @Body() dto: CreateEmployeeDto,
    @Request() req: RequestWithUser,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID not found in token. Please ensure your organization is properly set up before inviting employees.',
      );
    }
    const employee = await this.employeeService.createEmployee(
      organizationId,
      req.user.sub,
      dto,
    );

    return {
      message:
        'Employee account created successfully. Login credentials sent to email.',
      data: employee,
    };
  }

  @Post('resend-invite')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerResendInvite()
  async resendInvite(
    @Body('email') email: string,
    @Request() req: RequestWithUser,
  ) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      );
    }

    await this.employeeService.resendInvite(
      organizationId,
      req.user.sub,
      email,
    );

    return {
      message: 'Invite resent successfully. New credentials have been sent to the employee email.',
    };
  }

  @Get('list')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerListEmployees()
  async getEmployees(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('all') all?: string,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      );
    }

    const returnAll = all === 'true' || all === '1' || all === 'yes';

    const validLimit = Math.min(parseInt(limit || '10', 10), 100);
    const validPage = Math.max(parseInt(page || '1', 10), 1);
    const offset = (validPage - 1) * validLimit;

    const result = await this.employeeService.getEmployeesByOrganization(
      organizationId,
      validLimit,
      offset,
      returnAll,
    );

    const dataWithImage = result.data.map((employee) => ({
      ...employee,
      image: employee.profile_picture ?? null,
    }));

    return {
      message: 'Employees retrieved successfully',
      data: dataWithImage,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
  }

  @Get('my-profile')
  @Roles('organization_member')
  @UseGuards(RoleGuard)
  @SwaggerGetMyProfile()
  async getMyProfile(@Request() req: RequestWithUser) {
    const employee = await this.employeeService.getMyProfile(req.user.sub);

    return {
      message: 'Employee profile retrieved successfully',
      data: employee,
    };
  }

  @Patch('profile')
  @Roles('organization_member', 'organization')
  @UseGuards(RoleGuard)
  @SwaggerUpdateEmployeeProfile()
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
    @Query('employeeId') employeeId?: string,
  ) {
    if (
      dto.profile_picture_url &&
      !this.isCloudinaryUrl(dto.profile_picture_url)
    ) {
      throw new BadRequestException(
        'Profile picture URL must be from Cloudinary',
      );
    }

    const updateFields: Partial<{
      first_name: string;
      last_name: string;
      position: string | null;
      department: string | null;
      profile_picture: string | null;
      phone_number: string | null;
      branch_id: string | null;
      permissions: unknown[] | null;
      status: 'pending' | 'active';
    }> = {};

    if (dto.first_name !== undefined) updateFields.first_name = dto.first_name;
    if (dto.last_name !== undefined) updateFields.last_name = dto.last_name;
    if (dto.position !== undefined) updateFields.position = dto.position;
    if (dto.department !== undefined) updateFields.department = dto.department;
    if (dto.profile_picture_url !== undefined) {
      updateFields.profile_picture = dto.profile_picture_url;
    }
    if (dto.phone_number !== undefined) {
      updateFields.phone_number = dto.phone_number;
    }
    if (dto.branch_id !== undefined) {
      updateFields.branch_id = dto.branch_id;
    }
    if (
      (req.user.role === 'organization' ||
        req.user.role === 'organization_member') &&
      dto.permissions !== undefined
    ) {
      updateFields.permissions = dto.permissions;
    }
    if (
      (req.user.role === 'organization' ||
        req.user.role === 'organization_member') &&
      dto.status !== undefined
    ) {
      updateFields.status = dto.status;
    }

    const updated = employeeId
      ? await this.employeeService.updateEmployeeProfileByOrganization(
          employeeId,
          req.user.sub,
          updateFields,
        )
      : await this.employeeService.updateMyProfile(
          req.user.sub,
          updateFields,
        );

    return {
      message: 'Profile updated successfully',
      data: updated,
    };
  }

  private async updateEmployeeProfileAsOrganization(
    organizationUserId: string,
    employeeId: string | undefined,
    fields: Partial<{
      first_name: string;
      last_name: string;
      position: string | null;
      department: string | null;
      profile_picture: string | null;
      phone_number: string | null;
      branch_id: string | null;
      permissions: unknown[] | null;
      status: 'pending' | 'active';
    }>,
  ) {
    if (!employeeId) {
      throw new BadRequestException(
        'employeeId query parameter is required for organization profile updates',
      );
    }

    return this.employeeService.updateEmployeeProfileByOrganization(
      employeeId,
      organizationUserId,
      fields,
    );
  }

  @Patch('email')
  @Roles('organization_member')
  @UseGuards(RoleGuard)
  @SwaggerUpdateEmployeeEmail()
  async updateEmail(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateEmailDto,
  ) {
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
  @Roles('organization_member')
  @UseGuards(RoleGuard)
  @SwaggerUpdateEmployeePassword()
  async updatePassword(
    @Request() req: RequestWithUser,
    @Body() dto: UpdatePasswordDto,
  ) {
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

  @Get(':employeeId')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerGetEmployee()
  async getEmployee(
    @Param('employeeId') employeeId: string,
    @Request() req: RequestWithUser,
  ) {
    const employee = await this.employeeService.getEmployeeById(
      employeeId,
      req.user.sub,
    );

    return {
      message: 'Employee details retrieved successfully',
      data: employee,
    };
  }

  @Delete(':employeeId')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerDeleteEmployee()
  async deleteEmployee(
    @Param('employeeId') employeeId: string,
    @Request() req: RequestWithUser,
  ) {
    await this.employeeService.deleteEmployee(employeeId, req.user.sub);

    return {
      message: 'Employee deleted successfully',
    };
  }

  @Post(':employeeId/permissions/grant')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerGrantPermissions()
  async grantPermissions(
    @Param('employeeId') employeeId: string,
    @Body() body: import('./dto/permission.dto').PermissionArrayDto,
  ) {
    const result = await this.employeeService.grantPermissions(
      employeeId,
      body.permissions || [],
    );
    return { message: 'Permissions granted', data: result };
  }

  @Post(':employeeId/permissions/remove')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerRemovePermissions()
  async removePermissions(
    @Param('employeeId') employeeId: string,
    @Body() body: import('./dto/permission.dto').PermissionArrayDto,
  ) {
    const result = await this.employeeService.removePermissions(
      employeeId,
      body.permissions || [],
    );
    return { message: 'Permissions removed', data: result };
  }

  private isCloudinaryUrl(url: string): boolean {
    return /^https:\/\/res\.cloudinary\.com\/.+/.test(url);
  }
}
