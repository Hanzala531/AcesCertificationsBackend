import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActivityService } from './activity.service';
import { GetActivityDto } from './dto/get-activity.dto';
import type { RequestWithUser } from '../auth/types/auth.types';

@ApiTags('👤 Account')
@ApiBearerAuth('JWT-auth')
@Controller('activity')
@UseGuards(AuthGuard('jwt'))
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getMyActivity(
    @Request() req: RequestWithUser,
    @Query() query: GetActivityDto,
  ) {
    const result = await this.activityService.getAccountActivity(
      req.user.sub,
      query,
    );

    return {
      success: true,
      message: 'Account activity fetched',
      data: {
        items: result.items,
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }
}
