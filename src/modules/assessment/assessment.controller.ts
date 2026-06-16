import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AssessmentService } from './services/assessment.service';
import { AssessmentAdminService } from './services/assessment-admin.service';
import { AdminAssessmentActionsService } from './services/admin-assessment-actions.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { SubmitAnswersDto, UpdateAnswerDto } from './dto/submit-answer.dto';
import {
  ImproveAndResolveDto,
  ApproveAssessmentDto,
  EscalateAssessmentDto,
  SubmitImprovedAnswersDto,
} from './dto/admin-actions.dto';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { Logger } from '@nestjs/common';
import {
  SwaggerCreateAssessment,
  SwaggerGetAssessments,
  SwaggerGetPendingAssessments,
  SwaggerGetAssessmentById,
  SwaggerGetQuestionsWithProgress,
  SwaggerSubmitAnswers,
  SwaggerUpdateAnswer,
  SwaggerSubmitAssessment,
  SwaggerGetAssessmentScore,
  SwaggerGetAdminAssessmentMetrics,
  SwaggerGetAdminAssessments,
  SwaggerGetAdminAssessmentDetails,
  SwaggerGetSelfDisclosureStatus,
  SwaggerSetCertificateBlockStatus,
  SwaggerImproveAndResolve,
  SwaggerGetFlaggedQuestions,
  SwaggerSubmitImprovements,
  SwaggerApproveAssessment,
  SwaggerEscalateAssessment,
  SwaggerGetReviewOverview,
  SwaggerGetSubmittedAssessmentView,
  SwaggerGetAssessmentStages,
  SwaggerGetAdminDashboardStats,
  SwaggerGetNextQuestion,
} from './swagger/assessment.swagger';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

@ApiTags('📋 Assessments')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(AuthGuard('jwt'), RoleGuard)
export class AssessmentController {
  private readonly logger = new Logger(AssessmentController.name);

  constructor(
    private readonly assessmentService: AssessmentService,
    private readonly assessmentAdminService: AssessmentAdminService,
    private readonly adminActionsService: AdminAssessmentActionsService,
  ) {}

  @Post('assessments')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerCreateAssessment()
  async createAssessment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAssessmentDto,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.createAssessment(
      userId,
      userRole,
      dto,
    );

    return {
      success: true,
      message: 'Assessment created successfully',
      data: result,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments')
  @Roles('organization', 'organization_member')
  @SwaggerGetAssessments()
  async getAssessments(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.getAssessments(
      userId,
      userRole,
      page || 1,
      limit || 10,
    );

    return {
      success: true,
      message: 'Assessments retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/pending')
  @Roles('organization', 'organization_member')
  @SwaggerGetPendingAssessments()
  async getPendingAssessments(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.getPendingAssessments(
      userId,
      userRole,
      page || 1,
      limit || 10,
    );

    return {
      success: true,
      message: 'Pending assessments retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/:assessmentId/stages')
  @Roles('organization', 'organization_member', 'admin', 'subadmin')
  @SwaggerGetAssessmentStages()
  async getAssessmentStages(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result =
      await this.assessmentService.getAssessmentStages(userId, userRole, assessmentId);

    return {
      success: true,
      message: 'Assessment stages retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/:assessmentId')
  @Roles('organization', 'organization_member', 'admin', 'subadmin')
  @SwaggerGetAssessmentById()
  async getAssessmentById(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.getAssessmentById(
      userId,
      userRole,
      assessmentId,
    );

    return {
      success: true,
      message: 'Assessment retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/:assessmentId/questions')
  @Roles('organization', 'organization_member', 'admin', 'subadmin')
  @SwaggerGetQuestionsWithProgress()
  async getQuestionsWithProgress(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.getQuestionsWithProgress(
      userId,
      userRole,
      assessmentId,
    );

    return {
      success: true,
      message: 'Questions retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }


  @Get('assessments/:assessmentId/next-question')
  @Roles('organization', 'organization_member', 'admin', 'subadmin')
  @SwaggerGetNextQuestion()
  async getNextQuestion(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Query('current_question_id') currentQuestionId?: string,
    @Query('answer') answer?: string,
  ) {
    const result = await this.assessmentService.getNextQuestion(
      assessmentId,
      currentQuestionId,
      answer,
    );

    return {
      success: true,
      message: 'Next question retrieved',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/:assessmentId/review-overview')
  @Roles('organization', 'organization_member')
  @SwaggerGetReviewOverview()
  async getReviewOverview(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const result = await this.assessmentService.getReviewOverview(
      req.user.sub,
      req.user.role,
      assessmentId,
    );

    return {
      success: true,
      message: 'Review overview retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/:assessmentId/submitted-view')
  @Roles('organization', 'organization_member')
  @SwaggerGetSubmittedAssessmentView()
  async getSubmittedAssessmentView(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const result = await this.assessmentService.getSubmittedAssessmentView(
      req.user.sub,
      req.user.role,
      assessmentId,
    );

    return {
      success: true,
      message: 'Submitted assessment retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('assessments/:assessmentId/answers')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerSubmitAnswers()
  async submitAnswers(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: SubmitAnswersDto,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.submitAnswers(
      userId,
      userRole,
      assessmentId,
      dto,
    );

    return {
      success: true,
      message: `${result.length} answer(s) saved successfully`,
      data: result,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('assessments/:assessmentId/answers/:answerId')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateAnswer()
  async updateAnswer(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Param('answerId', ParseUUIDPipe) answerId: string,
    @Body() dto: UpdateAnswerDto,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.updateAnswer(
      userId,
      userRole,
      assessmentId,
      answerId,
      dto,
    );

    return {
      success: true,
      message: 'Answer updated successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/:assessmentId/debug-status')
  @Roles('admin', 'subadmin', 'organization', 'organization_member')
  async debugAssessmentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    
    try {
      const assessment = await this.assessmentService.getAssessmentById(
        userId,
        userRole,
        assessmentId,
      );
      
      const aiReviewService = this.assessmentService['aiReviewService'];
      
      let aiReviewStatus: {
        id: string;
        status: string;
        totalFlags: number;
        score: number | null;
        startedAt: Date | null;
        completedAt: Date | null;
      } | null = null;
      
      try {
        const aiReview = await aiReviewService['aiReviewRepo'].findAiReviewByAssessmentId(assessmentId);
        aiReviewStatus = aiReview ? {
          id: aiReview.id,
          status: aiReview.review_status,
          totalFlags: aiReview.total_flags,
          score: aiReview.score,
          startedAt: aiReview.started_at,
          completedAt: aiReview.completed_at,
        } : null;
      } catch (aiError) {
        this.logger.warn(`Could not fetch AI review for debug: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
      }
      
      return {
        success: true,
        message: 'Assessment debug status retrieved',
        data: {
          assessment: {
            id: assessment.id,
            status: assessment.status,
            is_submitted: assessment.is_submitted,
            submitted_at: assessment.submitted_at,
            completed_at: assessment.completed_at,
          },
          aiReview: aiReviewStatus,
          canResubmit: !assessment.is_submitted || (assessment.is_submitted && !aiReviewStatus),
          timestamp: new Date().toISOString(),
        },
        statusCode: HttpStatus.OK,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Debug status failed for assessment ${assessmentId}:`, error);
      
      return {
        success: false,
        message: 'Failed to retrieve debug status',
        error: error instanceof Error ? error.message : String(error),
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('assessments/:assessmentId/force-reset')
  @Roles('admin', 'subadmin')
  async forceResetAssessment(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    try {
      this.logger.log(`Force reset requested for assessment ${assessmentId} by user ${req.user.sub}`);
      const result = await this.assessmentService.revertAssessmentSubmission(
        assessmentId,
        'Force reset by admin'
      );
      
      return {
        success: true,
        message: 'Assessment forcefully reset to in-progress state',
        data: {
          assessmentId,
          status: result.status,
          is_submitted: result.is_submitted,
          resetAt: new Date().toISOString(),
        },
        statusCode: HttpStatus.OK,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Force reset failed for assessment ${assessmentId}:`, error);
      
      return {
        success: false,
        message: 'Force reset failed',
        error: error instanceof Error ? error.message : String(error),
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('assessments/:assessmentId/submit')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.OK)
  @SwaggerSubmitAssessment()
  async submitAssessment(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.submitAssessment(
      userId,
      userRole,
      assessmentId,
    );

    return {
      success: true,
      message: 'Assessment submitted successfully. AI review in progress.',
      data: {
        assessment_id: result.id,
        status: 'ai_reviewing',
        submitted_at: result.submitted_at,
      },
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/:assessmentId/score')
  @Roles('organization', 'organization_member')
  @SwaggerGetAssessmentScore()
  async getAssessmentScore(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.assessmentService.getAssessmentScore(
      userId,
      userRole,
      assessmentId,
    );

    return {
      success: true,
      message: 'Score retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('certificates/:certificateId/self-disclosure-status')
  @Roles('organization', 'organization_member')
  @SwaggerGetSelfDisclosureStatus()
  async getSelfDisclosureStatus(
    @Req() req: AuthenticatedRequest,
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Query('branchId', new ParseUUIDPipe({ version: '4', optional: true }))
    branchId?: string,
  ) {
    const status = await this.assessmentService.getSelfDisclosureStatus(
      req.user.sub,
      req.user.role,
      certificateId,
      branchId,
    );

    return {
      success: true,
      message: 'Self disclosure status retrieved successfully',
      data: {
        certificateId: status.certificateId,
        hasSelfDisclosure: status.hasSelfDisclosure,
        hasBadgeInSelfDisclosure: status.hasBadgeInSelfDisclosure,
        badgeId: status.badgeId,
        badgeName: status.badgeName,
        eligible: status.eligible,
        canStartAssured: status.canStartAssured,
        isAssuredApplied: status.isAssuredApplied,
        assessmentId: status.assessmentId,
        status: status.status,
        submittedAt: status.submittedAt
          ? status.submittedAt.toISOString()
          : null,
        createdAt: status.createdAt ? status.createdAt.toISOString() : null,
        isSubmitted: status.isSubmitted,
      },
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/assessments/metrics')
  @Roles('admin', 'subadmin')
  @SwaggerGetAdminAssessmentMetrics()
  async getAdminAssessmentMetrics() {
    const metrics =
      await this.assessmentAdminService.getAdminAssessmentMetrics();

    return {
      success: true,
      message: 'Assessment metrics retrieved successfully',
      data: metrics,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/dashboard-stats')
  @Roles('admin', 'subadmin')
  @SwaggerGetAdminDashboardStats()
  async getAdminDashboardStats() {
    const stats =
      await this.assessmentAdminService.getAdminDashboardStats();

    return {
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: stats,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/dashboard-chart-stats')
  @Roles('admin', 'subadmin')
  async getAdminDashboardChartStats() {
    const stats =
      await this.assessmentAdminService.getAdminDashboardChartStats();

    return {
      success: true,
      message: 'Dashboard chart statistics retrieved successfully',
      data: stats,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/assessments')
  @Roles('admin', 'subadmin')
  @SwaggerGetAdminAssessments()
  async getAdminAssessments(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
    @Query('assessmentType') assessmentType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: 'date' | 'score',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const startDateObj = startDate ? new Date(startDate) : undefined;
    const endDateObj = endDate ? new Date(endDate) : undefined;

    const normalizedOrganizationId =
      organizationId && organizationId.trim()
        ? organizationId.trim()
        : undefined;
    const normalizedStatus =
      status && status.trim() ? status.trim() : undefined;
    const normalizedAssessmentType =
      assessmentType && assessmentType.trim()
        ? assessmentType.trim()
        : undefined;

    const result = await this.assessmentAdminService.getAdminAssessments({
      page: page || 1,
      limit: limit || 10,
      organizationId: normalizedOrganizationId,
      status: normalizedStatus,
      assessmentType: normalizedAssessmentType,
      startDate: startDateObj,
      endDate: endDateObj,
      sortBy: sortBy || 'date',
      sortOrder: sortOrder || 'desc',
    });

    return {
      success: true,
      message: 'Assessments retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/assessments/:assessmentId')
  @Roles('admin', 'subadmin')
  @SwaggerGetAdminAssessmentDetails()
  async getAdminAssessmentDetails(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const details =
      await this.assessmentAdminService.getAdminAssessmentDetails(assessmentId);

    return {
      success: true,
      message: 'Assessment details retrieved successfully',
      data: details,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('admin/assessments/:assessmentId/certificate-block')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerSetCertificateBlockStatus()
  async setCertificateBlockStatus(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() body: { isBlocked?: boolean; reason?: string },
  ) {
    if (typeof body?.isBlocked !== 'boolean') {
      throw new BadRequestException('isBlocked must be provided as boolean');
    }

    const result = await this.assessmentAdminService.setCertificateBlockStatus(
      assessmentId,
      body.isBlocked,
      body.reason,
      req.user.sub,
      req.user.role,
    );

    return {
      success: true,
      message: result.isBlocked
        ? 'Certificate allocation blocked for this assessment'
        : 'Certificate allocation unblocked for this assessment',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }


  @Patch('admin/assessments/:assessmentId/improve-and-resolve')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerImproveAndResolve()
  async improveAndResolve(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: ImproveAndResolveDto,
  ) {
    const result = await this.adminActionsService.improveAndResolve(
      assessmentId,
      req.user.sub,
      dto.message,
    );

    return {
      success: true,
      message: 'Improvement requested successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessments/:assessmentId/flagged-questions')
  @Roles('organization', 'organization_member', 'admin', 'subadmin')
  @SwaggerGetFlaggedQuestions()
  async getFlaggedQuestions(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const result =
      await this.adminActionsService.getFlaggedQuestions(assessmentId);

    return {
      success: true,
      message: 'Flagged questions retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('assessments/:assessmentId/submit-improvements')
  @Roles('organization', 'organization_member')
  @HttpCode(HttpStatus.OK)
  @SwaggerSubmitImprovements()
  async submitImprovements(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: SubmitImprovedAnswersDto,
  ) {
    await this.adminActionsService.submitImprovements(
      assessmentId,
      dto.answers,
    );

    return {
      success: true,
      message: 'Improvements submitted and re-review triggered successfully',
      data: { assessmentId },
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('admin/assessments/:assessmentId/approve')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerApproveAssessment()
  async approveAssessment(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: ApproveAssessmentDto,
  ) {
    const result = await this.adminActionsService.approveAssessment(
      assessmentId,
      req.user.sub,
      dto.reason,
    );

    return {
      success: true,
      message: 'Assessment approved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('admin/assessments/:assessmentId/escalate')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerEscalateAssessment()
  async escalateAssessment(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: EscalateAssessmentDto,
  ) {
    const result = await this.adminActionsService.escalateAssessment(
      assessmentId,
      req.user.sub,
      dto.reason,
    );

    return {
      success: true,
      message: 'Assessment escalated successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }
}
