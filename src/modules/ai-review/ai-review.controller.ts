import {
  Controller,
  Get,
  Param,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Req,
  Query,
  Patch,
  Body,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AiReviewService } from './services/ai-review.service';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { Logger } from '@nestjs/common';
import {
  SwaggerGetAiReview,
  SwaggerGetFlaggedResponses,
  SwaggerGetQuestionGuidance,
  SwaggerApproveQuestion,
  SwaggerGetAllAiFlags,
  SwaggerGetAiFlagDetails,
  SwaggerUpdateFlagStatus,
  SwaggerListAvailableModels,
  SwaggerDebugRetryAiReview,
} from './swagger/ai-review.swagger';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

@ApiTags('🤖 AI Reviews')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(AuthGuard('jwt'), RoleGuard)
export class AiReviewController {
  private readonly logger = new Logger(AiReviewController.name);

  constructor(private readonly aiReviewService: AiReviewService) {}

  @Get('ai-reviews/:assessmentId')
  @Roles('organization', 'organization_member', 'admin', 'subadmin')
  @SwaggerGetAiReview()
  async getAiReview(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.aiReviewService.getAiReviewForAssessment(
      userId,
      userRole,
      assessmentId,
    );

    return {
      success: true,
      message: 'AI review retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ai-reviews/:assessmentId/flags')
  @Roles('organization', 'organization_member', 'admin', 'subadmin')
  @SwaggerGetFlaggedResponses()
  async getFlaggedResponses(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const userId = req.user.sub;
    const userRole = req.user.role;
    const result = await this.aiReviewService.getFlaggedResponses(
      userId,
      userRole,
      assessmentId,
    );

    return {
      success: true,
      message: 'Flagged responses retrieved successfully',
      data: {
        total_flags: result.length,
        flags: result,
      },
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('questions/:questionId/guidance')
  @Roles('organization', 'organization_member')
  @SwaggerGetQuestionGuidance()
  async getQuestionGuidance(
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    const result = await this.aiReviewService.getQuestionGuidance(questionId);

    return {
      success: true,
      message: 'Question guidance retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ai-flags')
  @Roles('admin', 'subadmin')
  @SwaggerGetAllAiFlags()
  async getAllAiFlags(
    @Query('status') status?: 'open' | 'pending' | 'escalated' | 'resolved',
    @Query('limit') limit?: number,
    @Query('pageNumber') pageNumber?: number,
  ) {
    const pageLimit = limit ? parseInt(String(limit), 10) : 25;
    const page = pageNumber ? parseInt(String(pageNumber), 10) : 1;
    const offset = (page - 1) * pageLimit;

    const result = await this.aiReviewService.getAllAiFlags({
      status,
      limit: pageLimit,
      offset: offset,
    });

    return {
      success: true,
      message: 'AI flags retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ai-flags/:reviewId')
  @Roles('admin', 'subadmin')
  @SwaggerGetAiFlagDetails()
  async getAiFlagDetails(@Param('reviewId', ParseUUIDPipe) reviewId: string) {
    const result = await this.aiReviewService.getAiFlagDetails(reviewId);

    return {
      success: true,
      message: 'AI flag details retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('ai-flags/:reviewId/status')
  @Roles('admin', 'subadmin')
  @SwaggerUpdateFlagStatus()
  async updateFlagStatus(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body('status') status: 'open' | 'pending' | 'escalated' | 'resolved',
  ) {
    const result = await this.aiReviewService.updateFlagStatus(
      reviewId,
      status,
    );

    return {
      success: true,
      message: 'Flag status updated successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('ai-flags/:reviewId/responses/:responseId/approve')
  @Roles('admin', 'subadmin')
  @SwaggerApproveQuestion()
  async approveQuestion(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
  ) {
    const result = await this.aiReviewService.approveQuestion(
      reviewId,
      responseId,
    );

    return {
      success: true,
      message: result.reviewClosed
        ? 'Question approved — all flags resolved'
        : 'Question approved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ai-models')
  @Roles('admin', 'subadmin')
  @SwaggerListAvailableModels()
  async listAvailableModels() {
    const result = await this.aiReviewService.listAvailableModels();

    return {
      success: true,
      message: 'Available AI models retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('ai-reviews/:assessmentId/debug-retry')
  @Roles('admin', 'subadmin')
  @SwaggerDebugRetryAiReview()
  async debugRetryAiReview(
    @Req() req: AuthenticatedRequest,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    try {
      this.logger.log(`Debug retry AI review requested for assessment: ${assessmentId} by user: ${req.user.sub}`);

      const result = await this.aiReviewService.triggerAiReview(assessmentId);

      return {
        success: true,
        message: 'AI review debug retry initiated successfully',
        data: {
          reviewId: result.id,
          assessmentId,
          status: result.review_status,
          triggeredAt: new Date().toISOString(),
        },
        statusCode: HttpStatus.OK,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Debug retry AI review failed for assessment ${assessmentId}:`, error);

      return {
        success: false,
        message: 'AI review debug retry failed',
        error: error instanceof Error ? error.message : String(error),
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
