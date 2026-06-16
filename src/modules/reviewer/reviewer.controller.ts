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
  NotFoundException,
  InternalServerErrorException,
  Inject,
  HttpException,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { ReviewerService } from './reviewer.service';
import { AuthService } from '../auth/auth.service';
import type { RequestWithUser } from '../auth/types/auth.types';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import {
  UpdateProfileDto,
  UpdateEmailDto,
  UpdatePasswordDto,
  AddTagsDto,
  RemoveTagsDto,
  UpdateAccountStatusDto,
} from './dto/update-profile.dto';
import { UsersService } from '../users/users.service';
import { isErrorWithStack } from '../../common/utils/error.util';
import {
  SwaggerGetReviewerProfile,
  SwaggerUpdateReviewerProfile,
  SwaggerUpdateReviewerEmail,
  SwaggerUpdateReviewerPassword,
  SwaggerDeleteReviewerProfile,
  SwaggerAddTags,
  SwaggerRemoveTags,
  SwaggerUpdateReviewerAccountStatus,
  SwaggerListReviewers,
  SwaggerAssignReviewerToAssessment,
  SwaggerGetReviewerAssignedAssessments,
  SwaggerGetCertificateAssessments,
  SwaggerGetReviewerAudits,
  SwaggerGetDashboardAnalytics,
  SwaggerGetAssignedAiFlags,
  SwaggerGetAiFlagDetails,
  SwaggerReviewFlaggedResponse,
  SwaggerSubmitReviewerReview,
  SwaggerAssignReviewerToFlagged,
} from './swagger/reviewer.swagger';
import {
  AssignAssessmentDto,
  AssignAssessmentResponseDto,
} from './dto/assign-assessment.dto';
import {
  CertificateAssessmentsPaginatedResponseDto,
  GetReviewerAuditsQueryDto,
} from './dto/certificate-assessments-query.dto';
import {
  ReviewerAiFlagsQueryDto,
  ReviewFlagActionDto,
  SubmitReviewerReviewDto,
  AssignReviewerToFlaggedDto,
} from './dto/reviewer-ai-flags.dto';
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

interface ListReviewersResponse {
  message: string;
  data: Array<{
    id: string;
    name: string;
    email: string;
    tags?: string[];
    accountStatus: boolean;
  }>;
}

interface AddTagsResponse {
  message: string;
  data: Record<string, unknown>;
}

interface RemoveTagsResponse {
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

@ApiTags('👁️ Reviewer Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@Controller('reviewers')
export class ReviewerController {
  private readonly logger = new Logger(ReviewerController.name);

  constructor(
    private reviewerService: ReviewerService,
    private usersService: UsersService,
    @Inject(AuthService) private authService: AuthService,
  ) {}

  @Get('profile')
  @Roles('reviewer')
  @SwaggerGetReviewerProfile()
  async getProfile(
    @Request() req: RequestWithUser,
  ): Promise<GetProfileResponse> {
    const userId = req.user.sub;
    const reviewer = await this.reviewerService.findByUserId(userId);

    if (!reviewer) {
      throw new NotFoundException('Reviewer profile not found');
    }

    return {
      message: 'Profile retrieved successfully',
      data: reviewer,
    };
  }

  @Get('list')
  @SwaggerListReviewers()
  async listReviewers(
    @Query('limit') limit?: number,
    @Query('pageNumber') pageNumber?: number,
  ): Promise<{
    message: string;
    data: Array<{
      id: string;
      name: string;
      email: string;
      profile_picture?: string | null;
      tags?: string[];
      accountStatus: boolean;
    }>;
    total: number;
  }> {
    const pageLimit = limit ? parseInt(String(limit), 10) : 25;
    const page = pageNumber ? parseInt(String(pageNumber), 10) : 1;
    const offset = (page - 1) * pageLimit;

    const result = await this.reviewerService.findAll({
      limit: pageLimit,
      offset,
    });

    const formattedReviewers = result.reviewers.map((reviewer) => {
      const firstName =
        typeof reviewer.first_name === 'string' ? reviewer.first_name : '';
      const lastName =
        typeof reviewer.last_name === 'string' ? reviewer.last_name : '';
      const email = typeof reviewer.email === 'string' ? reviewer.email : '';

      const accountStatusValue = reviewer.accountStatus as boolean;

      return {
        id: reviewer.id as string,
        name: `${firstName} ${lastName}`.trim(),
        email,
        profile_picture: (reviewer.profile_picture as string | null) || null,
        tags: (reviewer.tags as string[]) || [],
        accountStatus: accountStatusValue,
      };
    });

    return {
      message: 'Reviewers retrieved successfully',
      data: formattedReviewers,
      total: result.total,
    };
  }

  @Patch('profile')
  @Roles('reviewer', 'admin', 'subadmin')
  @SwaggerUpdateReviewerProfile()
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
    @Query('reviewerId') reviewerId?: string,
  ): Promise<UpdateProfileResponse> {
    let targetUserId: string;
    if (req.user.role === 'admin' && reviewerId) {
      const targetReviewer = await this.reviewerService.findById(reviewerId);
      if (!targetReviewer) {
        throw new NotFoundException('Reviewer profile not found');
      }
      targetUserId = targetReviewer.user_id as string;
    } else {
      targetUserId = req.user.sub;
    }

    const reviewer = await this.reviewerService.findByUserId(targetUserId);

    if (!reviewer) {
      throw new NotFoundException('Reviewer profile not found');
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
    if (dto.tags !== undefined) updateFields.tags = dto.tags;
    if (dto.accountStatus !== undefined && req.user.role === 'admin') {
      updateFields.accountStatus = dto.accountStatus;
    }

    const updatedProfile = await this.reviewerService.update(
      reviewer.id as string,
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
  @SwaggerUpdateReviewerEmail()
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
  @SwaggerUpdateReviewerPassword()
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

  @Post('tags/add')
  @Roles('reviewer')
  @SwaggerAddTags()
  async addTags(
    @Request() req: RequestWithUser,
    @Body() dto: AddTagsDto,
  ): Promise<AddTagsResponse> {
    const userId = req.user.sub;
    const reviewer = await this.reviewerService.findByUserId(userId);

    if (!reviewer) {
      throw new NotFoundException('Reviewer profile not found');
    }

    if (!dto.tags || dto.tags.length === 0) {
      throw new BadRequestException('Tags are required');
    }

    const updated = await this.reviewerService.addTags(
      reviewer.id as string,
      dto.tags,
    );

    return {
      message: 'Tags added successfully',
      data: updated || {},
    };
  }

  @Post('tags/remove')
  @Roles('reviewer')
  @SwaggerRemoveTags()
  async removeTags(
    @Request() req: RequestWithUser,
    @Body() dto: RemoveTagsDto,
  ): Promise<RemoveTagsResponse> {
    const userId = req.user.sub;
    const reviewer = await this.reviewerService.findByUserId(userId);

    if (!reviewer) {
      throw new NotFoundException('Reviewer profile not found');
    }

    if (!dto.tags || dto.tags.length === 0) {
      throw new BadRequestException('Tags are required');
    }

    const updated = await this.reviewerService.removeTags(
      reviewer.id as string,
      dto.tags,
    );

    return {
      message: 'Tags removed successfully',
      data: updated || {},
    };
  }

  @Get('dashboard-analytics')
  @Roles('reviewer')
  @SwaggerGetDashboardAnalytics()
  async getDashboardAnalytics(@Request() req: RequestWithUser) {
    const data = await this.reviewerService.getDashboardAnalytics(req.user.sub);
    return {
      success: true,
      message: 'Dashboard analytics retrieved successfully',
      data,
    };
  }

  @Get('certificate-assessments')
  @Roles('reviewer')
  @SwaggerGetCertificateAssessments()
  async getCertificateAssessments(
    @Request() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('assessmentType') assessmentType?: string,
  ): Promise<CertificateAssessmentsPaginatedResponseDto> {
    const pageNumber = page ? parseInt(String(page), 10) : 1;
    const pageLimit = limit ? parseInt(String(limit), 10) : 10;

    const result = await this.reviewerService.getCertificateAssessments(
      req.user.sub,
      pageNumber,
      pageLimit,
      assessmentType,
    );

    return {
      message: 'Certificate assessments retrieved successfully',
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get('audits')
  @Roles('reviewer')
  @SwaggerGetReviewerAudits()
  async getReviewerAudits(
    @Request() req: RequestWithUser,
    @Query() query: GetReviewerAuditsQueryDto,
  ) {
    const data = await this.reviewerService.getReviewerAudits(
      req.user.sub,
      query.lifecycleStatus,
      query.page ?? 1,
      query.limit ?? 10,
    );
    return {
      success: true,
      message: 'Reviewer audits retrieved successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assigned-assessments')
  @Roles('reviewer', 'admin')
  @SwaggerGetReviewerAssignedAssessments()
  async getAssignedAssessments(
    @Request() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('reviewerId') reviewerId?: string,
    @Query('assignedByRole') assignedByRole?: string,
    @Query('assessmentType') assessmentType?: string,
  ): Promise<AssignedAssessmentsResponse> {
    const pageNumber = page ? parseInt(String(page), 10) : 1;
    const pageLimit = limit ? parseInt(String(limit), 10) : 10;
    let userId = req.user.sub;

    if (req.user.role === 'admin') {
      if (!reviewerId) {
        throw new BadRequestException(
          'reviewerId query parameter is required for admin',
        );
      }
      const reviewer = await this.reviewerService.findById(reviewerId);
      userId = reviewer.user_id as string;
    }

    const result = await this.reviewerService.getAssignedAssessments(
      userId,
      pageNumber,
      pageLimit,
      status,
      assignedByRole,
      assessmentType,
    );

    return {
      message: 'Assigned assessments retrieved successfully',
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Patch(':reviewerId/account-status')
  @Roles('admin', 'subadmin')
  @SwaggerUpdateReviewerAccountStatus()
  async updateAccountStatus(
    @Param('reviewerId') reviewerId: string,
    @Body() dto: UpdateAccountStatusDto,
  ): Promise<{ message: string; data: Record<string, unknown> }> {
    const reviewer = await this.reviewerService.findById(reviewerId);
    if (!reviewer) {
      throw new NotFoundException('Reviewer profile not found');
    }

    const updated = await this.reviewerService.update(reviewerId, {
      accountStatus: dto.accountStatus,
    });

    return {
      message: 'Account status updated successfully',
      data: updated || {},
    };
  }

  @Delete('profile')
  @SwaggerDeleteReviewerProfile()
  async deleteProfile(
    @Request() req: RequestWithUser,
  ): Promise<DeleteProfileResponse> {
    const userId = req.user.sub;
    const reviewer = await this.reviewerService.findByUserId(userId);

    if (!reviewer) {
      throw new NotFoundException('Reviewer profile not found');
    }

    await this.reviewerService.delete(reviewer.id as string);

    await this.usersService.markAsDeleted(userId);

    return {
      message: 'Profile deleted successfully',
      data: null,
    };
  }

  // ── Reviewer Flagged Assessment Endpoints ──

  @Get('flagged-assessments')
  @Roles('reviewer')
  @SwaggerGetAssignedAiFlags()
  async getAssignedFlaggedAssessments(
    @Request() req: RequestWithUser,
    @Query() query: ReviewerAiFlagsQueryDto,
  ) {
    const result = await this.reviewerService.getAssignedAiFlags(
      req.user.sub,
      {
        status: query.status,
        page: query.page,
        limit: query.limit,
      },
    );

    return {
      success: true,
      message: 'Assigned flagged assessments retrieved successfully',
      ...result,
    };
  }

  @Get('flagged-assessments/:reviewId')
  @Roles('reviewer')
  @SwaggerGetAiFlagDetails()
  async getFlaggedAssessmentDetails(
    @Request() req: RequestWithUser,
    @Param('reviewId') reviewId: string,
  ) {
    const result = await this.reviewerService.getAiFlagDetails(
      req.user.sub,
      reviewId,
    );

    return {
      success: true,
      message: 'Flagged assessment details retrieved successfully',
      data: result,
    };
  }

  @Patch('flagged-assessments/:reviewId/responses/:responseId')
  @Roles('reviewer')
  @SwaggerReviewFlaggedResponse()
  async reviewFlaggedResponse(
    @Request() req: RequestWithUser,
    @Param('reviewId') reviewId: string,
    @Param('responseId') responseId: string,
    @Body() dto: ReviewFlagActionDto,
  ) {
    const result = await this.reviewerService.reviewFlag(
      req.user.sub,
      reviewId,
      responseId,
      dto.action,
      dto.notes,
    );

    return {
      success: true,
      message: `Flag ${dto.action} successfully`,
      reviewClosed: result.reviewClosed,
    };
  }

  @Post('flagged-assessments/:reviewId/submit')
  @Roles('reviewer')
  @HttpCode(HttpStatus.OK)
  @SwaggerSubmitReviewerReview()
  async submitReviewerReview(
    @Request() req: RequestWithUser,
    @Param('reviewId') reviewId: string,
    @Body() dto: SubmitReviewerReviewDto,
  ) {
    const result = await this.reviewerService.submitReviewerReview(
      req.user.sub,
      reviewId,
      dto.adjustedScore,
    );

    return {
      success: true,
      ...result,
    };
  }

  @Post('assign-assessment')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerAssignReviewerToAssessment()
  async assignToAssessment(
    @Request() req: RequestWithUser,
    @Body() dto: AssignAssessmentDto,
  ): Promise<AssignAssessmentResponseDto> {
    const result = await this.reviewerService.assignToAssessment(
      dto.assessmentId,
      dto.reviewerId,
      req.user.sub,
    );

    return {
      success: true,
      message: dto.reviewerId
        ? 'Reviewer assigned successfully'
        : 'Reviewer unassigned successfully',
      data: result,
    };
  }

  @Post('flagged-assessments/:assessmentId/assign-reviewer')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerAssignReviewerToFlagged()
  async assignReviewerToFlaggedAssessment(
    @Request() req: RequestWithUser,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: AssignReviewerToFlaggedDto,
  ) {
    const result = await this.reviewerService.assignToAssessment(
      assessmentId,
      dto.reviewerId,
      req.user.sub,
    );

    return {
      success: true,
      message: 'Reviewer assigned to flagged assessment successfully',
      data: result,
    };
  }
}
