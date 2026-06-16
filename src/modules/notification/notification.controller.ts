import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { NotificationService } from './services/notification.service';
import { ConnectionManagerService } from './websocket/connection-manager.service';
import { NotificationRepository } from './notification.repository';
import { BadgeService } from './badge.service';
import { BadgeRepository } from './badge.repository';
import {
  SwaggerGetNotifications,
  SwaggerGetConnectionStatus,
  SwaggerGetConnectionStats,
  SwaggerGetUnreadCount,
  SwaggerMarkAsRead,
  SwaggerMarkAllAsRead,
  SwaggerGetNotificationSettings,
  SwaggerUpdateNotificationSettings,
  SwaggerGetAdminNotificationSettings,
  SwaggerUpdateAdminNotificationSettings,
} from './swagger/notification.swagger';
import {
  SwaggerGetOrganizationBadges,
  SwaggerGetBadgeById,
} from './swagger/badge.swagger';
import {
  UpdateAuditorNotificationSettingsDto,
  UpdateReviewerNotificationSettingsDto,
  UpdateAdminNotificationSettingsDto,
} from './dto/notification-response.dto';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

@ApiTags('🔔 Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationController {
  private readonly isServerless: boolean;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly notificationRepo: NotificationRepository,
    private readonly badgeService: BadgeService,
    private readonly badgeRepo: BadgeRepository,
  ) {
    this.isServerless = !!(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTIONS_WORKER_RUNTIME
    );
  }

  // ─── Admin Settings ──────────────────────────────────────────────────────────

  @Get('admin/settings')
  @Roles('admin', 'subadmin')
  @UseGuards(RoleGuard)
  @SwaggerGetAdminNotificationSettings()
  async getAdminSettings() {
    const settings = await this.notificationRepo.getAdminSettings();
    return {
      success: true,
      data: settings,
    };
  }

  @Patch('admin/settings')
  @Roles('admin', 'subadmin')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateAdminNotificationSettings()
  async updateAdminSettings(@Body() dto: UpdateAdminNotificationSettingsDto) {
    const updated = await this.notificationRepo.updateAdminSettings(dto);
    return {
      success: true,
      message: 'Global notification settings updated successfully',
      data: updated,
    };
  }

  // ─── WebSocket Status ────────────────────────────────────────────────────────

  @Get('status')
  @RateLimit({ max: 180, windowMs: 60 * 1000 })
  @SwaggerGetConnectionStatus()
  async getConnectionStatus(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;

    if (this.isServerless) {
      return {
        success: true,
        data: {
          userId,
          isOnline: false,
          connectionCount: 0,
          websocketSupported: false,
          message:
            'WebSocket connections are not supported in serverless environments. Real-time features require a persistent server.',
        },
      };
    }

    const isOnline = this.connectionManager.isUserOnline(userId);
    const connectionCount =
      this.connectionManager.getConnectionCountByUser(userId);

    return {
      success: true,
      data: {
        userId,
        isOnline,
        connectionCount,
        websocketSupported: true,
        websocketUrl: process.env.WEBSOCKET_URL || undefined,
        socketPath: process.env.SOCKET_PATH || '/socket.io',
        socketNamespace: '/notifications',
      },
    };
  }

  @Get('connections')
  @RateLimit({ max: 60, windowMs: 60 * 1000 })
  @SwaggerGetConnectionStats()
  async getConnectionStats() {
    if (this.isServerless) {
      return {
        success: true,
        data: {
          totalConnections: 0,
          onlineUsersCount: 0,
          onlineUsers: [],
          websocketSupported: false,
          message:
            'WebSocket connections are not supported in serverless environments.',
        },
      };
    }

    const totalConnections = this.connectionManager.getConnectionCount();
    const onlineUsers = this.connectionManager.getOnlineUsers();

    return {
      success: true,
      data: {
        totalConnections,
        onlineUsersCount: onlineUsers.length,
        onlineUsers,
        websocketSupported: true,
      },
    };
  }

  // ─── Notifications ────────────────────────────────────────────────────────────

  @Get()
  @RateLimit({ max: 120, windowMs: 60 * 1000 })
  @SwaggerGetNotifications()
  async getNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('read') read?: string,
    @Query('module') module?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const userId = req.user.sub;
    const result = await this.notificationRepo.findNotificationsByUserId(
      userId,
      {
        read: read === 'true' ? true : read === 'false' ? false : undefined,
        module,
        limit: limit || 50,
        offset: offset || 0,
      },
    );

    return {
      success: true,
      data: result,
    };
  }

  @Get('unread-count')
  @SwaggerGetUnreadCount()
  async getUnreadCount(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const count = await this.notificationRepo.getUnreadCount(userId);

    return {
      success: true,
      data: { count },
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @SwaggerMarkAsRead()
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ) {
    const userId = req.user.sub;
    const notification = await this.notificationRepo.markAsRead(
      notificationId,
      userId,
    );

    return {
      success: true,
      data: notification,
    };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @SwaggerMarkAllAsRead()
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const count = await this.notificationRepo.markAllAsRead(userId);

    return {
      success: true,
      message: `${count} notification(s) marked as read`,
      data: { count },
    };
  }

  // ─── User Settings ────────────────────────────────────────────────────────────

  @Get('settings')
  @SwaggerGetNotificationSettings()
  async getSettings(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    let settings = await this.notificationRepo.getNotificationSettings(userId);

    if (!settings) {
      settings = await this.notificationRepo.createDefaultSettings(
        userId,
        req.user.role,
      );
    }

    return {
      success: true,
      data: settings,
    };
  }

  @Post('settings')
  @HttpCode(HttpStatus.OK)
  @SwaggerUpdateNotificationSettings()
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body()
    settings:
      | UpdateAuditorNotificationSettingsDto
      | UpdateReviewerNotificationSettingsDto,
  ) {
    const userId = req.user.sub;
    const role = req.user.role;
    const allowed = this.filterRoleSpecificSettings(role, settings);
    const updated =
      await this.notificationRepo.createOrUpdateNotificationSettings(
        userId,
        allowed,
      );

    return {
      success: true,
      data: updated,
    };
  }

  private filterRoleSpecificSettings(
    role: string,
    settings:
      | UpdateAuditorNotificationSettingsDto
      | UpdateReviewerNotificationSettingsDto,
  ) {
    const common = {
      system_announcements: settings.system_announcements,
    };

    if (role === 'auditor') {
      const auditorSettings = settings as UpdateAuditorNotificationSettingsDto;
      return {
        ...common,
        new_audit_assigned: auditorSettings.new_audit_assigned,
        audit_deadline_reminder: auditorSettings.audit_deadline_reminder,
        review_submission_alerts: auditorSettings.review_submission_alerts,
      };
    }

    if (role === 'reviewer') {
      const reviewerSettings = settings as UpdateReviewerNotificationSettingsDto;
      return {
        ...common,
        new_review_assigned: reviewerSettings.new_review_assigned,
        review_deadline_reminder: reviewerSettings.review_deadline_reminder,
      };
    }

    return common;
  }
}

@ApiTags('🏅 Badges')
@ApiBearerAuth('JWT-auth')
@Controller('badges')
@UseGuards(AuthGuard('jwt'))
export class BadgeController {
  constructor(
    private readonly badgeService: BadgeService,
    private readonly badgeRepo: BadgeRepository,
  ) {}

  @Get('organization/:organizationId')
  @SwaggerGetOrganizationBadges()
  async getOrganizationBadges(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('branchId') branchId?: string,
  ) {
    const badges = await this.badgeService.getBadgesForOrganization(
      organizationId,
      branchId || null,
    );

    return {
      success: true,
      data: badges,
    };
  }

  @Get(':id')
  @SwaggerGetBadgeById()
  async getBadgeById(@Param('id', ParseUUIDPipe) badgeId: string) {
    const badge = await this.badgeService.getBadgeById(badgeId);

    if (!badge) {
      return {
        success: false,
        message: 'Badge not found',
      };
    }

    return {
      success: true,
      data: badge,
    };
  }
}
