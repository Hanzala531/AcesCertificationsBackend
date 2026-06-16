import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Query,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { CertificateService } from './services/certificate.service';
import { CertificateStructureService } from './services/certificate-structure.service';
import { CertificateQueryService } from './services/certificate-query.service';
import { CertificateDuplicateService } from './services/certificate-duplicate.service';
import { CertificateDevService } from './services/certificate-dev.service';
import { CertificationOverviewService } from './services/certification-overview.service';
import type { RequestWithUser } from '../auth/types/auth.types';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { UpdateMainSectionDto } from './dto/update-main-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { UpdateSubsectionDto } from './dto/update-subsection.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateMainSectionsDto } from './dto/create-main-sections.dto';
import { CreateSubsectionsDto } from './dto/create-subsections.dto';
import { AddQuestionsDto } from './dto/add-questions.dto';
import { BulkAddQuestionsDto } from './dto/bulk-add-questions.dto';
import {
  DevCreateCertificateDto,
  DevBulkQuestionsDto,
} from './dto/dev-create-certificate.dto';
import { CertificationOverviewQueryDto } from './dto/certification-overview-query.dto';
import { SectionType } from './types/certificate.types';
import {
  SwaggerCreateCertificate,
  SwaggerCreateMainSections,
  SwaggerCreateSubsections,
  SwaggerAddQuestions,
  SwaggerBulkAddQuestions,
  SwaggerGetCertificates,
  SwaggerGetCertificatesLite,
  SwaggerGetCertificateById,
  SwaggerDeleteCertificate,
  SwaggerUpdateCertificate,
  SwaggerUpdateMainSection,
  SwaggerDeleteMainSection,
  SwaggerUpdateSection,
  SwaggerUpdateSubsection,
  SwaggerUpdateQuestion,
  SwaggerSetPublishCertificate,
  SwaggerReorderItem,
} from './swagger/certificate.swagger';
import { ReorderItemDto } from './dto/reorder-item.dto';
import { SwaggerGetRecommendedCertificates } from './swagger/recommended-certificates.swagger';
import { SwaggerGetCertificationOverview } from './swagger/certification-overview.swagger';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { Logger } from '@nestjs/common';

@ApiTags('Certificates')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard, RoleGuard)
export class CertificateController {
  private readonly logger = new Logger(CertificateController.name);
  constructor(
    private readonly certificateService: CertificateService,
    private readonly structureService: CertificateStructureService,
    private readonly queryService: CertificateQueryService,
    private readonly duplicateService: CertificateDuplicateService,
    private readonly devService: CertificateDevService,
    private readonly overviewService: CertificationOverviewService,
  ) {}

  @Get('certifications/overview')
  @Roles('organization', 'organization_member')
  @SwaggerGetCertificationOverview()
  async getCertificationOverview(
    @Request() req: RequestWithUser,
    @Query() query: CertificationOverviewQueryDto,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    const result = await this.overviewService.getOverview(organizationId, query);
    return {
      success: true,
      message: 'Certification overview retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('certificates')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerCreateCertificate()
  async createCertificate(
    @Request() req: RequestWithUser,
    @Body() dto: CreateCertificateDto,
  ) {
    const userId = req.user?.sub;
    const result = await this.certificateService.createCertificate(dto, userId);
    return {
      success: true,
      message: 'Certificate created successfully',
      data: result,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('certificates/search')
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query (min 2 chars)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOperation({ summary: 'Search certificates by name, description, or code' })
  async searchCertificates(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    const results = await this.queryService.searchCertificates(
      query,
      limit ? Number(limit) : 10,
    );
    return {
      success: true,
      message: 'Search results',
      data: results,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('certificates')
  @SwaggerGetCertificates()
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'industry_id', required: false, type: String })
  @ApiQuery({ name: 'min_price', required: false, type: Number, description: 'Minimum price (matches disclosure_price or assured_price)' })
  @ApiQuery({ name: 'max_price', required: false, type: Number, description: 'Maximum price (matches disclosure_price or assured_price)' })
  @ApiQuery({ name: 'date_from', required: false, type: String, description: 'Filter certificates created on or after this date (ISO format, e.g. 2025-01-01)' })
  @ApiQuery({ name: 'date_to', required: false, type: String, description: 'Filter certificates created on or before this date (ISO format, e.g. 2025-12-31)' })
  async getCertificates(
    @Request() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('industry_id') industryId?: string,
    @Query('min_price') minPrice?: number,
    @Query('max_price') maxPrice?: number,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const result = await this.certificateService.getCertificates({
      userId: req.user.sub,
      userRole: req.user.role,
      page: page || 1,
      limit: limit || 10,
      industryId,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      dateFrom,
      dateTo,
    });
    return {
      success: true,
      message: 'Certificates retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('certificates-lite')
  @Public()
  @SwaggerGetCertificatesLite()
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Number of certificates per page (default: 10)',
  })
  async getCertificatesLite(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.certificateService.getCertificatesLite({
      page: page || 1,
      limit: limit || 10,
    });
    return {
      success: true,
      message: 'Certificates retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('recommended-certificates')
  @Roles('organization', 'organization_member')
  @SwaggerGetRecommendedCertificates()
  async getRecommendedCertificates(
    @Request() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result =
      await this.queryService.getRecommendedCertificatesForUser(
        req.user.sub,
        req.user.role,
        page || 1,
        limit || 10,
      );

    return {
      success: true,
      message: 'Recommended certificates retrieved successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('certificates/:certificateId')
  @SwaggerGetCertificateById()
  @ApiQuery({
    name: 'include',
    required: false,
    type: String,
    description:
      'Comma-separated include flags: sections,subsections,questions (e.g. include=sections,subsections,questions)',
  })
  async getCertificateById(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Query('include') include?: string,
  ) {
    const result =
      await this.certificateService.getCertificateById(certificateId);

    const filteredData = this.filterCertificateIncludes(result, include);

    return {
      success: true,
      message: 'Certificate retrieved successfully',
      data: filteredData,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('certificates/:certificateId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateCertificate()
  async updateCertificate(
    @Request() req: RequestWithUser,
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Body() dto: UpdateCertificateDto,
  ) {
    const userId = req.user?.sub;
    const result = await this.certificateService.updateCertificate(
      certificateId,
      dto,
      userId,
    );
    return {
      success: true,
      message: 'Certificate updated successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('certificates/:certificateId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerDeleteCertificate()
  async deleteCertificate(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
  ) {
    await this.certificateService.deleteCertificate(certificateId);
    return {
      success: true,
      message: 'Certificate deleted successfully',
      deletedId: certificateId,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('certificates/:certificateId/duplicate')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.CREATED)
  async duplicateCertificate(
    @Request() req: RequestWithUser,
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
  ) {
    const userId = req.user?.sub;
    const result = await this.duplicateService.duplicateCertificate(
      certificateId,
      userId,
    );

    return {
      success: true,
      message: 'Certificate duplicated successfully',
      data: result,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('certificates/:certificateId/main-sections')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerCreateMainSections()
  async createMainSections(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Body() dto: CreateMainSectionsDto,
  ) {
    const result = await this.structureService.createMainSections(
      certificateId,
      dto,
    );
    return {
      success: true,
      message: `${result.length} main section(s) created successfully`,
      data: result,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sections/:parentId/subsections')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerCreateSubsections()
  async createSubsections(
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @Body() dto: CreateSubsectionsDto,
  ) {
    const result = await this.structureService.createSubsections(
      parentId,
      dto,
    );

    const maxLevel = Math.max(...result.map((r) => r.level || 0));
    let nextStep = '';

    if (maxLevel === 2) {
      nextStep = `✅ Created Level 2 sections. Next: Create Level 3 subsections using these IDs with parent_type: "SECTION", OR add questions directly to sections using section_type: "SECTION"`;
    } else if (maxLevel === 3) {
      nextStep = `✅ Created Level 3 subsections (final level). Next: Add questions to these subsections using section_type: "SUB_SECTION"`;
    }

    return {
      success: true,
      message: `${result.length} subsection(s) created successfully`,
      data: result,
      nextStep,
      hierarchy: {
        createdLevel: maxLevel,
        explanation:
          maxLevel === 2
            ? 'Level 2 (Sections) - can hold questions or subsections'
            : 'Level 3 (Subsections) - final level, can hold questions',
        note: 'Hierarchy: Certificate → Main Section → Section → Subsection. Questions can be added to Sections or Subsections.',
      },
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sections/:sectionId/questions')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerAddQuestions()
  async addQuestions(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: AddQuestionsDto,
  ) {
    const result = await this.structureService.addQuestions(sectionId, dto);
    const levelDescription =
      dto.section_type === SectionType.SECTION
        ? 'section (is_third_level: false)'
        : 'subsection (is_third_level: true)';

    return {
      success: true,
      message: `${result.length} question(s) added successfully to ${levelDescription}`,
      data: {
        created_count: result.length,
        questions: result,
      },
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('certificates/:certificateId/questions/bulk')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerBulkAddQuestions()
  async bulkAddQuestions(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Body() dto: BulkAddQuestionsDto,
  ) {
    const results = await this.structureService.bulkAddQuestions(
      certificateId,
      dto,
    );
    const totalQuestions = results.reduce(
      (sum, r) => sum + r.questions_added,
      0,
    );
    return {
      success: true,
      message: `${totalQuestions} question(s) added across ${results.length} section(s)`,
      data: results,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('certificates/:certificateId/publish')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerSetPublishCertificate()
  async setPublishStatus(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Body() body: { is_published?: boolean },
  ) {
    if (body.is_published === undefined) {
      throw new BadRequestException('is_published is required');
    }

    if (body.is_published) {
      await this.certificateService.publishCertificate(certificateId);
    } else {
      await this.certificateService.unpublishCertificate(certificateId);
    }

    return {
      success: true,
      message: `Certificate ${body.is_published ? 'published' : 'unpublished'} successfully`,
      data: {
        certificateId,
        is_published: body.is_published,
      },
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('certificates/:certificateId/reorder')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerReorderItem()
  async reorderItem(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Body() dto: ReorderItemDto,
  ) {
    await this.structureService.reorderItem(certificateId, dto);
    return {
      success: true,
      message: 'Item reordered successfully',
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
      data: null,
    };
  }

  @Delete('main-sections/:mainSectionId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerDeleteMainSection()
  async deleteMainSection(
    @Param('mainSectionId', ParseUUIDPipe) mainSectionId: string,
  ) {
    await this.structureService.deleteMainSection(mainSectionId);
    return {
      success: true,
      message: 'Main section and all its children deleted successfully',
      deletedId: mainSectionId,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('sections/:sectionId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  async deleteSection(@Param('sectionId', ParseUUIDPipe) sectionId: string) {
    await this.structureService.deleteSection(sectionId);
    return {
      success: true,
      message: 'Section and its children deleted successfully',
      deletedId: sectionId,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('subsections/:subSectionId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  async deleteSubSection(
    @Param('subSectionId', ParseUUIDPipe) subSectionId: string,
  ) {
    await this.structureService.deleteSubSection(subSectionId);
    return {
      success: true,
      message: 'Subsection and its questions deleted successfully',
      deletedId: subSectionId,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('questions/:questionId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  async deleteQuestion(@Param('questionId', ParseUUIDPipe) questionId: string) {
    await this.structureService.deleteQuestion(questionId);
    return {
      success: true,
      message: 'Question deleted successfully',
      deletedId: questionId,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('main-sections/:mainSectionId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateMainSection()
  async updateMainSection(
    @Param('mainSectionId', ParseUUIDPipe) mainSectionId: string,
    @Body() dto: UpdateMainSectionDto,
  ) {
    const result = await this.structureService.updateMainSection(
      mainSectionId,
      dto,
    );
    return {
      success: true,
      message: 'Main section updated successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('sections/:sectionId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateSection()
  async updateSection(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    const result = await this.structureService.updateSection(sectionId, dto);
    return {
      success: true,
      message: 'Section updated successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('subsections/:subSectionId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateSubsection()
  async updateSubSection(
    @Param('subSectionId', ParseUUIDPipe) subSectionId: string,
    @Body() dto: UpdateSubsectionDto,
  ) {
    const result = await this.structureService.updateSubSection(
      subSectionId,
      dto,
    );
    return {
      success: true,
      message: 'Subsection updated successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('questions/:questionId')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateQuestion()
  async updateQuestion(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    const result = await this.structureService.updateQuestion(
      questionId,
      dto,
    );
    return {
      success: true,
      message: 'Question updated successfully',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Dev-only endpoints ──────────────────────────────────────────────────

  @Post('certificates/dev/complete-structure')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.CREATED)
  async devCreateCompleteStructure(
    @Request() req: RequestWithUser,
    @Body() dto: DevCreateCertificateDto,
  ) {
    const result = await this.devService.devCreateCompleteStructure(
      dto,
      req.user?.sub,
    );
    return {
      success: true,
      message: 'Certificate with complete structure created successfully',
      data: result,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('certificates/:certificateId/dev/bulk-questions')
  @Roles('admin', 'subadmin')
  @HttpCode(HttpStatus.CREATED)
  async devBulkAddQuestions(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Body() dto: DevBulkQuestionsDto,
  ) {
    const result = await this.devService.devBulkAddQuestions(
      certificateId,
      dto,
    );
    return {
      success: true,
      message: 'Questions added successfully',
      data: result,
      statusCode: HttpStatus.CREATED,
      timestamp: new Date().toISOString(),
    };
  }

  private filterCertificateIncludes(result: any, include?: string): any {
    const includeSet = new Set(
      (include || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );

    const data: any = JSON.parse(JSON.stringify(result));

    const wantSections = includeSet.has('sections');
    const wantSubsections =
      includeSet.has('subsections') || includeSet.has('sub_sections');
    const wantQuestions = includeSet.has('questions');

    if (!data.main_sections || wantQuestions) return data;

    if (!wantSections && !wantSubsections) {
      data.main_sections = data.main_sections.map((ms: any) => ({
        id: ms.id,
        name: ms.name,
        rank: ms.rank,
        sections_count: ms.sections ? ms.sections.length : 0,
      }));
    } else if (wantSections && !wantSubsections) {
      data.main_sections = data.main_sections.map((ms: any) => ({
        ...ms,
        sections: ms.sections.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          questions_count: s.questions_count,
        })),
      }));
    } else if (!wantSections && wantSubsections) {
      data.main_sections = data.main_sections.map((ms: any) => ({
        id: ms.id,
        name: ms.name,
        rank: ms.rank,
        sections: ms.sections.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          sub_sections: s.sub_sections.map((ss: any) => ({
            id: ss.id,
            name: ss.name,
            rank: ss.rank,
            questions_count: ss.questions_count,
          })),
        })),
      }));
    } else {
      data.main_sections = data.main_sections.map((ms: any) => ({
        ...ms,
        sections: ms.sections.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          questions_count: s.questions_count,
          sub_sections: s.sub_sections.map((ss: any) => ({
            id: ss.id,
            name: ss.name,
            rank: ss.rank,
            questions_count: ss.questions_count,
          })),
        })),
      }));
    }

    return data;
  }
}
