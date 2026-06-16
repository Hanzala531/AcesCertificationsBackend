import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  UseGuards,
  BadRequestException,
  Logger,
  Request,
  Body,
  Param,
  Query,
  NotFoundException,
  InternalServerErrorException,
  Inject,
  HttpException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { AuditorService } from './auditor.service';
import { AuthService } from '../auth/auth.service';
import type { RequestWithUser } from '../auth/types/auth.types';
import {
  UpdateProfileDto,
  UpdateEmailDto,
  UpdatePasswordDto,
  AssignCertificateDto,
  UnassignCertificateDto,
  UpdateStatusDto,
  UpdateAccountStatusDto,
} from './dto/update-profile.dto';
import { UsersService } from '../users/users.service';
import { isErrorWithStack } from '../../common/utils/error.util';
import { AssignedByRole } from '../../common/enums/assigned-by-role.enum';
import {
  SwaggerGetAuditorProfile,
  SwaggerUpdateAuditorProfile,
  SwaggerUpdateAuditorEmail,
  SwaggerUpdateAuditorPassword,
  SwaggerDeleteAuditorProfile,
  SwaggerListAuditors,
  SwaggerAssignCertificates,
  SwaggerUnassignCertificates,
  SwaggerUpdateAuditorStatus,
  SwaggerUpdateAuditorAccountStatus,
  SwaggerAssignAuditorToAssessment,
  SwaggerUpdateAuditorAuditDate,
  SwaggerGetAuditorAssignedAssessments,
} from './swagger/auditor.swagger';
import {
  AssignAssessmentDto,
  AssignAssessmentResponseDto,
} from './dto/assign-assessment.dto';
import {
  UpdateAuditDateDto,
  UpdateAuditDateResponseDto,
} from './dto/update-audit-date.dto';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { AssessmentWithDetails } from '../assessment/assessment.repository';

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

interface Certificate {
  id: string;
  certificate_id: string;
  name: string;
}

interface ListAuditorsResponse {
  message: string;
  data: Array<{
    id: string;
    name: string;
    email: string;
    country?: string;
    state?: string;
    city?: string;
    assigned_certificates?: string[];
    status: string;
    accountStatus: boolean;
  }>;
}

interface CertificateInfo {
  id: string;
  certificate_id: string;
  name: string;
}

interface AssignCertificateResponse {
  message: string;
  data: {
    assigned_certificates: CertificateInfo[];
  };
}

interface UnassignCertificateResponse {
  message: string;
  data: Record<string, unknown>;
}

interface AssignedAssessmentsResponse {
  message: string;
  data: Array<Record<string, unknown> | AssessmentWithDetails>;
  total: number;
  page: number;
  limit: number;
}

@ApiTags('👨‍⚖️ Auditor Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@Controller('auditors')
export class AuditorController {
  private readonly logger = new Logger(AuditorController.name);

  constructor(
    private auditorService: AuditorService,
    private usersService: UsersService,
    @Inject(AuthService) private authService: AuthService,
  ) {}

  @Get('profile')
  @Roles('auditor')
  @SwaggerGetAuditorProfile()
  async getProfile(
    @Request() req: RequestWithUser,
  ): Promise<GetProfileResponse> {
    const userId = req.user.sub;
    const auditor = await this.auditorService.findByUserId(userId);

    if (!auditor) {
      throw new NotFoundException('Auditor profile not found');
    }

    return {
      message: 'Profile retrieved successfully',
      data: auditor,
    };
  }

  @Get('list')
  @SwaggerListAuditors()
  async listAuditors(
    @Query('limit') limit?: number,
    @Query('pageNumber') pageNumber?: number,
  ): Promise<{
    message: string;
    data: Array<{
      id: string;
      name: string;
      email: string;
      profile_picture?: string | null;
      country?: string;
      state?: string;
      city?: string;
      assigned_certificates?: string[];
      status: string;
      accountStatus: boolean;
    }>;
    total: number;
  }> {
    const pageLimit = limit ? parseInt(String(limit), 10) : 25;
    const page = pageNumber ? parseInt(String(pageNumber), 10) : 1;
    const offset = (page - 1) * pageLimit;

    const result = await this.auditorService.findAll({
      limit: pageLimit,
      offset: offset,
    });

    const formattedAuditors = result.auditors.map((auditor) => {
      const firstName = auditor.first_name as string | null | undefined;
      const lastName = auditor.last_name as string | null | undefined;
      const nameParts = [firstName, lastName].filter(Boolean) as string[];
      const name = nameParts.length
        ? nameParts.join(' ')
        : (auditor.email as string) || '';
      const id = (auditor.id as string) || (auditor.user_id as string);

      const accountStatusValue = auditor.accountStatus as boolean;

      return {
        id,
        name,
        email: auditor.email as string,
        profile_picture: (auditor.profile_picture as string | null) || null,
        country: (auditor.country as string | null) || undefined,
        state: (auditor.state as string | null) || undefined,
        city: (auditor.city as string | null) || undefined,
        assigned_certificates:
          (auditor.assigned_certificates as string[]) || [],
        status: auditor.status as string,
        accountStatus: accountStatusValue,
      };
    });

    return {
      message: 'Auditors retrieved successfully',
      data: formattedAuditors,
      total: result.total,
    };
  }

  @Patch('profile')
  @Roles('auditor', 'admin', 'subadmin')
  @SwaggerUpdateAuditorProfile()
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
    @Query('auditorId') auditorId?: string,
  ): Promise<UpdateProfileResponse> {
    const userId = req.user.sub;
    let auditorIdToUpdate: string;

    if (req.user.role === 'admin' && auditorId) {
      const targetAuditor = await this.auditorService.findById(auditorId);
      if (!targetAuditor) {
        throw new NotFoundException('Auditor profile not found');
      }
      auditorIdToUpdate = targetAuditor.id as string;
    } else {
      const auditor = await this.auditorService.findByUserId(userId);
      if (!auditor) {
        throw new NotFoundException('Auditor profile not found');
      }
      auditorIdToUpdate = auditor.id as string;
    }

    if (
      dto.profile_picture_url &&
      !this.isCloudinaryUrl(dto.profile_picture_url)
    ) {
      throw new BadRequestException(
        'Profile picture URL must be from Cloudinary',
      );
    }

    if (dto.signature_url && !this.isCloudinaryUrl(dto.signature_url)) {
      throw new BadRequestException('Signature URL must be from Cloudinary');
    }

    if (dto.accountStatus !== undefined && req.user.role !== 'admin') {
      throw new BadRequestException('Only admin can update account status');
    }

    const updateFields: Record<string, unknown> = {};
    if (dto.first_name) updateFields.first_name = dto.first_name;
    if (dto.last_name) updateFields.last_name = dto.last_name;
    if (dto.profile_picture_url)
      updateFields.profile_picture = dto.profile_picture_url;
    if (dto.signature_url) updateFields.signature = dto.signature_url;
    if (dto.country !== undefined) updateFields.country = dto.country;
    if (dto.state !== undefined) updateFields.state = dto.state;
    if (dto.city !== undefined) updateFields.city = dto.city;
    if (dto.assigned_certificates !== undefined)
      updateFields.assigned_certificates = dto.assigned_certificates;
    if (dto.accountStatus !== undefined && req.user.role === 'admin') {
      updateFields.accountStatus = dto.accountStatus;
    }

    const updatedProfile = await this.auditorService.update(
      auditorIdToUpdate,
      updateFields,
    );

    return {
      message: 'Profile updated successfully',
      data: updatedProfile || {},
    };
  }

  private isCloudinaryUrl(url: string): boolean {
    return /^https:\/\/res\.cloudinary\.com\/.+/.test(url);
  }

  @Patch('email')
  @SwaggerUpdateAuditorEmail()
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
  @SwaggerUpdateAuditorPassword()
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

  @Post(':auditorId/certificates/assign')
  @Roles('admin', 'subadmin')
  @SwaggerAssignCertificates()
  async assignCertificates(
    @Request() req: RequestWithUser,
    @Body() dto: AssignCertificateDto,
    @Param('auditorId') auditorId: string,
  ): Promise<AssignCertificateResponse> {
    const auditor = await this.auditorService.findById(auditorId);

    if (!auditor) {
      throw new NotFoundException('Auditor profile not found');
    }

    if (!dto.certificate_ids || dto.certificate_ids.length === 0) {
      throw new BadRequestException('Certificate IDs are required');
    }

    const updated = await this.auditorService.assignCertificates(
      auditor.id as string,
      dto.certificate_ids,
    );

    if (!updated) {
      throw new InternalServerErrorException('Failed to assign certificates');
    }

    return {
      message: 'Certificates assigned successfully',
      data: {
        assigned_certificates:
          (updated.assigned_certificates as CertificateInfo[]) || [],
      },
    };
  }

  @Post(':auditorId/certificates/unassign')
  @Roles('admin', 'subadmin')
  @SwaggerUnassignCertificates()
  async unassignCertificates(
    @Request() req: RequestWithUser,
    @Body() dto: UnassignCertificateDto,
    @Param('auditorId') auditorId: string,
  ): Promise<UnassignCertificateResponse> {
    const auditor = await this.auditorService.findById(auditorId);

    if (!auditor) {
      throw new NotFoundException('Auditor profile not found');
    }

    if (!dto.certificate_ids || dto.certificate_ids.length === 0) {
      throw new BadRequestException('Certificate IDs are required');
    }

    const updated = await this.auditorService.unassignCertificates(
      auditor.id as string,
      dto.certificate_ids,
    );

    return {
      message: 'Certificates unassigned successfully',
      data: updated || {},
    };
  }

  @Patch('status')
  @Roles('auditor')
  @SwaggerUpdateAuditorStatus()
  async updateStatus(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateStatusDto,
  ): Promise<UpdateProfileResponse> {
    const userId = req.user.sub;
    const auditor = await this.auditorService.findByUserId(userId);

    if (!auditor) {
      throw new NotFoundException('Auditor profile not found');
    }

    const updatedProfile = await this.auditorService.update(
      auditor.id as string,
      { status: dto.status },
    );

    return {
      message: 'Status updated successfully',
      data: updatedProfile || {},
    };
  }

  @Patch(':auditorId/account-status')
  @Roles('admin', 'subadmin')
  @SwaggerUpdateAuditorAccountStatus()
  async updateAccountStatus(
    @Request() req: RequestWithUser,
    @Param('auditorId') auditorId: string,
    @Body() dto: UpdateAccountStatusDto,
  ): Promise<UpdateProfileResponse> {
    const auditor = await this.auditorService.findById(auditorId);

    if (!auditor) {
      throw new NotFoundException('Auditor profile not found');
    }

    const updatedProfile = await this.auditorService.update(
      auditor.id as string,
      { accountStatus: dto.accountStatus },
    );

    return {
      message: 'Account status updated successfully',
      data: updatedProfile || {},
    };
  }

  @Get('assigned-assessments')
  @Get('assigned-assessments')
  @Roles('auditor', 'admin')
  @ApiQuery({
    name: 'assignedByRole',
    enum: AssignedByRole,
    enumName: 'AssignedByRole',
    required: false,
    description:
      'Filter assessments by the role of who assigned them (admin or reviewer)',
  })
  @SwaggerGetAuditorAssignedAssessments()
  async getAssignedAssessments(
    @Request() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('auditorId') auditorId?: string,
    @Query('assignedByRole') assignedByRole?: AssignedByRole,
  ): Promise<AssignedAssessmentsResponse> {
    const pageNumber = page ? parseInt(String(page), 10) : 1;
    const pageLimit = limit ? parseInt(String(limit), 10) : 10;

    let auditorUserId = req.user.sub;

    if (req.user.role === 'admin') {
      if (!auditorId) {
        throw new BadRequestException(
          'auditorId query parameter is required for admin',
        );
      }
      const auditor = await this.auditorService.findById(auditorId);
      auditorUserId = auditor.user_id as string;
    }

    const result = await this.auditorService.getAssignedAssessments(
      auditorUserId,
      pageNumber,
      pageLimit,
      status,
      assignedByRole,
    );

    return {
      message: 'Assigned assessments retrieved successfully',
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('dashboard-stats')
  @Roles('auditor')
  @HttpCode(HttpStatus.OK)
  async getDashboardStats(@Request() req: RequestWithUser) {
    const stats = await this.auditorService.getDashboardStats(req.user.sub);

    return {
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: stats,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('upcoming-audits')
  @Roles('auditor')
  @HttpCode(HttpStatus.OK)
  async getUpcomingAudits(
    @Request() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const pageNumber = page ? parseInt(String(page), 10) : 1;
    const pageLimit = limit ? parseInt(String(limit), 10) : 10;

    const result = await this.auditorService.getUpcomingAudits(
      req.user.sub,
      pageNumber,
      pageLimit,
    );

    return {
      success: true,
      message: 'Upcoming audits retrieved successfully',
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('profile')
  @SwaggerDeleteAuditorProfile()
  async deleteProfile(
    @Request() req: RequestWithUser,
  ): Promise<DeleteProfileResponse> {
    const userId = req.user.sub;
    const auditor = await this.auditorService.findByUserId(userId);

    if (!auditor) {
      throw new NotFoundException('Auditor profile not found');
    }

    await this.auditorService.delete(auditor.id as string);

    await this.usersService.markAsDeleted(userId);

    return {
      message: 'Profile deleted successfully',
      data: null,
    };
  }

  @Post('assign-assessment')
  @Roles('subadmin', 'reviewer', 'admin')
  @HttpCode(HttpStatus.OK)
  @SwaggerAssignAuditorToAssessment()
  async assignToAssessment(
    @Request() req: RequestWithUser,
    @Body() dto: AssignAssessmentDto,
  ): Promise<AssignAssessmentResponseDto> {
    const result = await this.auditorService.assignToAssessment(
      dto.assessmentId,
      dto.auditorId,
      dto.auditDate,
      req.user.sub,
      req.user.role,
    );

    let message: string;
    if (result.invited) {
      message = 'Invitation sent to auditor successfully';
    } else if (dto.auditorId) {
      message = 'Auditor assigned successfully';
    } else {
      message = 'Auditor unassigned successfully';
    }

    return {
      success: true,
      message,
      data: result,
    };
  }

  @Patch('assessments/:assessmentId/audit-date')
  @Roles('auditor')
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateAuditorAuditDate()
  async updateAuditDate(
    @Request() req: RequestWithUser,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UpdateAuditDateDto,
  ): Promise<UpdateAuditDateResponseDto> {
    const result = await this.auditorService.updateAuditDate(
      assessmentId,
      req.user.sub,
      dto.auditDate,
    );

    return {
      success: true,
      message: 'Audit date updated successfully',
      data: result,
    };
  }
}
