import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
  Logger,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  SwaggerGetOrganizationProfile,
  SwaggerUpdateOrganizationProfile,
  SwaggerUpdateOrganizationEmail,
} from './swagger/organization.swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { OrganizationService } from './organization.service';
import { UsersService } from '../users/users.service';
import { OrganizationRecord } from './organization.repository';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import type { RequestWithUser } from '../auth/types/auth.types';

interface GetProfileResponse {
  message: string;
  data: OrganizationRecord | null;
}

interface UpdateProfileResponse {
  message: string;
  data: OrganizationRecord;
}

@ApiTags('🏢 Organization Profile')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('organization')
export class OrganizationController {
  private readonly logger = new Logger(OrganizationController.name);

  constructor(
    private organizationService: OrganizationService,
    private usersService: UsersService,
  ) {}

  @Get('profile')
  @SwaggerGetOrganizationProfile()
  async getProfile(
    @Request() req: RequestWithUser,
  ): Promise<GetProfileResponse> {
    let organization = await this.organizationService.findByUserId(
      req.user.sub,
    );

    if (!organization && req.user.organization_id) {
      organization = await this.organizationService.findById(
        req.user.organization_id,
      );
    }

    if (!organization) {
      throw new NotFoundException('Organization profile not found');
    }

    return {
      message: 'Organization profile retrieved successfully',
      data: organization,
    };
  }

  @Patch('profile')
  @ApiConsumes('application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'TechCorp Inc' },
        contact_no: { type: 'string', example: '+1-555-0123' },
        website: { type: 'string', example: 'https://techcorp.com' },
        organization_type: { type: 'string', example: 'Technology' },
        description: {
          type: 'string',
          example: 'A leading technology company...',
        },
        total_branches: { type: 'number', example: 5 },
        legal_city: { type: 'string', example: 'San Francisco' },
        legal_state: { type: 'string', example: 'California' },
        legal_country: { type: 'string', example: 'United States' },
        logo_url: { type: 'string', example: 'https://res.cloudinary.com/...' },
        industry_ids: {
          type: 'array',
          items: { type: 'string' },
          example: ['industry-uuid-1', 'industry-uuid-2'],
        },
        company_size: { type: 'string', example: 'Small' },
        documents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['legal', 'certificate', 'compliance'],
                example: 'legal',
              },
              url: { type: 'string', example: 'https://s3.amazonaws.com/...' },
            },
          },
        },
        legal_document_url: {
          type: 'string',
          example: 'https://s3.amazonaws.com/legal.pdf',
        },
      },
      example: {
        name: 'TechCorp Inc',
        contact_no: '+1-555-0123',
        website: 'https://techcorp.com',
        organization_type: 'Technology',
        description: 'A leading technology company...',
        total_branches: 5,
        legal_city: 'San Francisco',
        legal_state: 'California',
        legal_country: 'United States',
        logo_url: 'https://res.cloudinary.com/...',
        industry_ids: ['industry-uuid-1', 'industry-uuid-2'],
        company_size: 'Small',
        documents: [
          {
            type: 'legal',
            url: 'https://s3.amazonaws.com/...',
          },
        ],
        legal_document_url: 'https://s3.amazonaws.com/legal.pdf',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Organization profile updated successfully',
    schema: {
      example: {
        message: 'Organization profile updated successfully',
        data: {
          id: 'uuid-string',
          user_id: 'uuid-string',
          name: 'TechCorp Inc',
          contact_no: '+1-555-0123',
          website: 'https://techcorp.com',
          organization_type: 'Technology',
          description: 'A leading technology company...',
          total_branches: 5,
          legal_city: 'San Francisco',
          legal_state: 'California',
          legal_country: 'United States',
          logo: 'https://res.cloudinary.com/...',
          documents: [
            {
              type: 'legal',
              url: 'https://s3.amazonaws.com/...',
            },
          ],
          created_at: '2026-01-11T12:00:00.000Z',
          updated_at: '2026-01-11T12:00:00.000Z',
        },
      },
    },
  })
  @SwaggerUpdateOrganizationProfile()
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateOrganizationProfileDto,
  ): Promise<UpdateProfileResponse> {
    const organization = await this.organizationService.findByUserId(
      req.user.sub,
    );
    if (!organization) {
      throw new NotFoundException('Organization profile not found');
    }

    type UpdateOrgData = Partial<{
      name: string;
      contact_no: string;
      website: string;
      logo: string;
      industry_id: string;
      description: string;
      legal_country: string;
      legal_state: string;
      legal_city: string;
      organization_type: string;
      total_branches: number;
      legal_document_url: string;
    }>;

    const updateData: UpdateOrgData = {};

    if (dto.logo_url && !this.isCloudinaryUrl(dto.logo_url)) {
      throw new BadRequestException('Logo URL must be from Cloudinary');
    }

    if (dto.documents && Array.isArray(dto.documents)) {
      for (const doc of dto.documents) {
        if (!this.isS3Url(doc.url)) {
          throw new BadRequestException('Document URLs must be from S3');
        }
      }
    }

    if (dto.name) updateData.name = dto.name;
    if (dto.contact_no) updateData.contact_no = dto.contact_no;
    if (dto.website) updateData.website = dto.website;
    if (dto.organization_type)
      updateData.organization_type = dto.organization_type;
    if (dto.description) updateData.description = dto.description;
    if (dto.total_branches !== undefined)
      updateData.total_branches = dto.total_branches;
    if (dto.legal_city) updateData.legal_city = dto.legal_city;
    if (dto.legal_state) updateData.legal_state = dto.legal_state;
    if (dto.legal_country) updateData.legal_country = dto.legal_country;
    if (dto.logo_url) updateData.logo = dto.logo_url;
    if (dto.industry_ids && Array.isArray(dto.industry_ids))
      (updateData as any).industry_ids = dto.industry_ids;
    if (dto.legal_document_url)
      (updateData as any).legal_document_url = dto.legal_document_url;
    if ((dto as any).company_size)
      (updateData as any).company_size = (dto as any).company_size;

    const updatedOrganization = await this.organizationService.update(
      organization.id,
      updateData,
    );

    return {
      message: 'Organization profile updated successfully',
      data: updatedOrganization,
    };
  }

  @Patch('profile/email')
  @SwaggerUpdateOrganizationEmail()
  async updateEmail(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateEmailDto,
  ): Promise<{ message: string; userId: string; email: string }> {
    const organization = await this.organizationService.findByUserId(
      req.user.sub,
    );
    if (!organization) {
      throw new NotFoundException('Organization profile not found');
    }

    const userId = organization.user_id;

    const otpRecord = await this.usersService.verifyOtp(
      userId,
      dto.otp,
      'email_verification',
    );
    if (!otpRecord) {
      throw new BadRequestException(
        'Invalid or expired OTP for email verification',
      );
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      throw new BadRequestException(
        'OTP has expired. Please request a new OTP.',
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

    const existingUser = await this.usersService.findByEmail(
      dto.email.toLowerCase(),
    );
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException('Email already in use');
    }

    await this.usersService.markOtpAsUsed(otpRecord.id);

    // Update email
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

  @Get('certificates/issued')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  async getIssuedCertificates(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException('Organization ID not found in token.');
    }

    const validLimit = Math.min(parseInt(limit || '10', 10) || 10, 100);
    const validPage = Math.max(parseInt(page || '1', 10) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    const { data, total } =
      await this.organizationService.getIssuedCertificates(
        organizationId,
        validLimit,
        offset,
      );

    const totalPages = Math.ceil(total / validLimit);

    const certificates = data.map((row) => {
      const {
        org_badge_id,
        org_badge_tier,
        org_badge_color,
        org_badge_score,
        badge_id,
        badge_name,
        badge_color,
        review_score,
        ...rest
      } = row;

      return {
        ...rest,
        review_score: review_score !== null ? Number(review_score) : null,
        badge:
          badge_id || org_badge_id
            ? {
                achieved_badge_id: org_badge_id ?? null,
                actual_badge_id: badge_id ?? null,
                name: badge_name ?? org_badge_tier ?? null,
                color: badge_color ?? null,
                achieved_color: org_badge_color ?? null,
                score:
                  org_badge_score !== null ? Number(org_badge_score) : null,
              }
            : null,
      };
    });

    return {
      message: 'Issued certificates retrieved successfully',
      data: certificates,
      pagination: {
        total,
        page: validPage,
        pageSize: validLimit,
        totalPages,
      },
    };
  }

  private isCloudinaryUrl(url: string): boolean {
    return /^https:\/\/res\.cloudinary\.com\/.+/.test(url);
  }

  private isS3Url(url: string): boolean {
    return (
      /^https:\/\/.*\.amazonaws\.com\/.+/.test(url) ||
      /^https:\/\/s3[.-].*\.amazonaws\.com\/.+/.test(url)
    );
  }
}
