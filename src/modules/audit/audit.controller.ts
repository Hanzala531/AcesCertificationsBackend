import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';
import {
  UpdateReviewerNotesDto,
  UpdateAuditorNotesDto,
  UpsertAuditDto,
  UpsertReviewDto,
  BlockCertificateDto,
  ComplianceActionDto,
  GetAuditorAuditsQueryDto,
} from './dto/audit.dto';
import {
  SwaggerGetAuditorAudits,
  SwaggerGetAuditView,
  SwaggerUpdateReviewerNotes,
  SwaggerUpdateAuditorNotes,
  SwaggerUpsertAudit,
  SwaggerUpsertReview,
  SwaggerIssueCertificate,
  SwaggerBlockCertificate,
  SwaggerReauditAssessment,
  SwaggerPostComplianceAction,
  SwaggerGetAiAuditScore,
} from './swagger/audit.swagger';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    role: string;
    auditor_id?: string;
    reviewer_id?: string;
  };
}

@ApiTags('🔍 Audits')
@ApiBearerAuth('JWT-auth')
@Controller('audits')
@UseGuards(AuthGuard('jwt'))
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('admin', 'subadmin', 'auditor')
  @UseGuards(RoleGuard)
  @SwaggerGetAuditorAudits()
  async getAuditorAudits(
    @Request() req: RequestWithUser,
    @Query() query: GetAuditorAuditsQueryDto,
  ) {
    const data = await this.auditService.getAuditorAudits(
      req.user.sub,
      req.user.role,
      query.auditorProfileId,
      query.lifecycleStatus,
      query.page ?? 1,
      query.limit ?? 10,
    );
    return {
      success: true,
      message: 'Audits retrieved successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  
  @Get('assessment/:assessmentId')
  @Roles('admin', 'subadmin', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerGetAuditView()
  async getAuditView(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Query('questionType') questionType?: 'pdf' | 'text' | 'boolean',
    @Query('flaggedOnly') flaggedOnly?: string,
  ) {
    const data = await this.auditService.getAuditView(assessmentId, {
      questionType,
      flaggedOnly: flaggedOnly === 'true',
    });
    return {
      success: true,
      message: 'Audit view retrieved successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('assessment/:assessmentId/questions/:questionId/reviewer-notes')
  @Roles('reviewer')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateReviewerNotes()
  async updateReviewerNotes(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: UpdateReviewerNotesDto,
  ) {
    const data = await this.auditService.updateReviewerNotes(
      assessmentId,
      questionId,
      dto.reviewerNotes,
      req.user.sub,
      req.user.reviewer_id,
    );
    return {
      success: true,
      message: 'Reviewer notes updated successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('assessment/:assessmentId/questions/:questionId/auditor-notes')
  @Roles('auditor')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateAuditorNotes()
  async updateAuditorNotes(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: UpdateAuditorNotesDto,
  ) {
    const data = await this.auditService.updateAuditorNotes(
      assessmentId,
      questionId,
      dto.auditorNotes,
      req.user.sub,
      req.user.auditor_id,
    );
    return {
      success: true,
      message: 'Auditor notes updated successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('assessment/:assessmentId')
  @Roles('admin', 'subadmin', 'auditor')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerUpsertAudit()
  async upsertAudit(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: UpsertAuditDto,
  ) {
    const data = await this.auditService.upsertAudit(
      assessmentId,
      dto,
      req.user.sub,
      req.user.role,
      req.user.auditor_id,
    );
    return {
      success: true,
      message: 'Audit record saved successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('assessment/:assessmentId/review')
  @Roles('reviewer')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerUpsertReview()
  async upsertReview(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: UpsertReviewDto,
  ) {
    const data = await this.auditService.upsertReview(
      assessmentId,
      dto,
      req.user.sub,
      req.user.reviewer_id,
    );
    return {
      success: true,
      message: 'Review record saved successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('assessment/:assessmentId/issue-certificate')
  @Roles('reviewer')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @SwaggerIssueCertificate()
  async issueCertificate(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const data = await this.auditService.issueCertificate(
      assessmentId,
      req.user.sub,
      req.user.reviewer_id,
    );
    return {
      success: true,
      message: 'Certificate issued successfully',
      data,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('assessment/:assessmentId/block-certificate')
  @Roles('admin', 'subadmin', 'reviewer')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerBlockCertificate()
  async blockCertificate(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: BlockCertificateDto,
  ) {
    const data = await this.auditService.blockCertificate(
      assessmentId,
      dto,
      req.user.sub,
    );
    return {
      success: true,
      message: 'Certificate blocked successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('assessment/:assessmentId/reaudit')
  @Roles('admin', 'subadmin')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerReauditAssessment()
  async reauditAssessment(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const data = await this.auditService.reauditAssessment(
      assessmentId,
      req.user.sub,
    );
    return {
      success: true,
      message:
        'Re-audit initiated. Previous audit archived and new audit record created.',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('assessment/:assessmentId/questions/:questionId/compliance-action')
  @Roles('auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @SwaggerPostComplianceAction()
  async postComplianceAction(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: ComplianceActionDto,
  ) {
    const data = await this.auditService.postComplianceAction(
      assessmentId,
      questionId,
      dto.action,
      dto.message,
      req.user.sub,
      req.user.role,
      req.user.auditor_id,
      req.user.reviewer_id,
      dto.clarificationTarget,
    );
    return {
      success: true,
      message: 'Compliance action recorded successfully',
      data,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('assessment/:assessmentId/ai-score')
  @Roles('admin', 'subadmin', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerGetAiAuditScore()
  async getAiAuditScore(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const data = await this.auditService.getAiAuditScore(assessmentId);
    return {
      success: true,
      message: 'AI audit score retrieved successfully',
      data,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }
}
