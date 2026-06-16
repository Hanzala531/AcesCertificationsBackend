import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentInvitationService } from './assessment-invitation.service';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/types/auth.types';
import { GetInvitationsQueryDto } from './dto/assessment-invitation.dto';

@ApiTags('Assessment Invitations')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@Controller('assessment-invitations')
export class AssessmentInvitationController {
  constructor(
    private readonly invitationService: AssessmentInvitationService,
  ) {}

  @Get()
  @Roles('auditor')
  async getMyInvitations(
    @Request() req: RequestWithUser,
    @Query() query: GetInvitationsQueryDto,
  ) {
    const result = await this.invitationService.getMyInvitations(
      req.user.sub,
      query.status,
      query.page ?? 1,
      query.limit ?? 10,
    );

    return {
      success: true,
      message: 'Invitations retrieved successfully',
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/accept')
  @Roles('auditor')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.invitationService.acceptInvitation(
      id,
      req.user.sub,
    );

    return {
      success: true,
      message: 'Invitation accepted and auditor assigned to assessment',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/decline')
  @Roles('auditor')
  @HttpCode(HttpStatus.OK)
  async declineInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser,
  ) {
    const result = await this.invitationService.declineInvitation(
      id,
      req.user.sub,
    );

    return {
      success: true,
      message: 'Invitation declined',
      data: result,
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }
}
