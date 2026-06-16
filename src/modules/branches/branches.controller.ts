import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  SwaggerCreateBranch,
  SwaggerListBranches,
  SwaggerGetBranch,
  SwaggerUpdateBranch,
  SwaggerDeleteBranch,
  SwaggerSetMainBranch,
} from './swagger/branches.swagger';
import { BranchService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/create-branch.dto';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/types/auth.types';

@ApiTags('🏢 Branch Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('branches')
export class BranchController {
  constructor(private branchService: BranchService) {}

  @Post()
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerCreateBranch()
  async createBranch(
    @Body() dto: CreateBranchDto,
    @Request() req: RequestWithUser,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      );
    }

    const branch = await this.branchService.createBranch(organizationId, dto);

    return {
      message: 'Branch created successfully',
      data: branch,
    };
  }

  @Get('list')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerListBranches()
  async listBranches(
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

    const result = await this.branchService.getBranchesByOrganization(
      organizationId,
      validLimit,
      offset,
      returnAll,
    );

    return {
      message: 'Branches retrieved successfully',
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':branchId')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerGetBranch()
  async getBranch(
    @Param('branchId') branchId: string,
    @Request() req: RequestWithUser,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      );
    }

    const branch = await this.branchService.getBranchById(
      branchId,
      organizationId,
    );

    return {
      message: 'Branch retrieved successfully',
      data: branch,
    };
  }

  @Put(':branchId')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerUpdateBranch()
  async updateBranch(
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
    @Request() req: RequestWithUser,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      );
    }

    const branch = await this.branchService.updateBranch(
      branchId,
      organizationId,
      dto,
    );

    return {
      message: 'Branch updated successfully',
      data: branch,
    };
  }

  @Delete(':branchId')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerDeleteBranch()
  async deleteBranch(
    @Param('branchId') branchId: string,
    @Request() req: RequestWithUser,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      );
    }

    await this.branchService.deleteBranch(branchId, organizationId);

    return {
      message: 'Branch deleted successfully',
    };
  }

  @Put(':branchId/set-main')
  @Roles('organization', 'organization_member')
  @UseGuards(RoleGuard)
  @SwaggerSetMainBranch()
  async setMainBranch(
    @Param('branchId') branchId: string,
    @Request() req: RequestWithUser,
  ) {
    const organizationId = req.user.organization_id;
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID not found in token. Please ensure your organization is properly set up.',
      );
    }

    const branch = await this.branchService.setMainBranch(
      branchId,
      organizationId,
    );

    return {
      message: 'Main branch updated successfully',
      data: branch,
    };
  }
}
