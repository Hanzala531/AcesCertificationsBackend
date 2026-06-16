import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SwaggerGetLoginLogs } from './swagger/users.swagger';
import type { RequestWithUser } from '../auth/types/auth.types';

@ApiTags('👤 Account')
@ApiBearerAuth('JWT-auth')
@Controller('account')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('login-logs')
  @HttpCode(HttpStatus.OK)
  @SwaggerGetLoginLogs()
  async getLoginLogs(
    @Request() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await this.usersService.getLoginLogs(
      req.user.sub,
      pageNum,
      limitNum,
    );

    return {
      success: true,
      message: 'Login logs retrieved successfully',
      data: {
        items: result.items.map((log) => ({
          id: log.id,
          email: log.email,
          device: log.device ?? null,
          location: log.location ?? null,
          loginAt: log.created_at,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      statusCode: HttpStatus.OK,
      timestamp: new Date().toISOString(),
    };
  }
}
