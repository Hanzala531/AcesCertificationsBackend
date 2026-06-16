import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  GetNotificationsApiResponse,
  GetConnectionStatusApiResponse,
  GetConnectionStatsApiResponse,
  GetUnreadCountApiResponse,
  MarkAsReadApiResponse,
  MarkAllAsReadApiResponse,
  GetNotificationSettingsApiResponse,
  UpdateAuditorNotificationSettingsDto,
  UpdateReviewerNotificationSettingsDto,
  UpdateNotificationSettingsApiResponse,
  NotificationErrorDto,
  AdminNotificationSettingsDto,
  UpdateAdminNotificationSettingsDto,
  GetAdminNotificationSettingsApiResponse,
  UpdateAdminNotificationSettingsApiResponse,
} from '../dto/notification-response.dto';

export function SwaggerGetNotifications() {
  return applyDecorators(
    ApiExtraModels(GetNotificationsApiResponse),
    ApiOperation({
      summary: 'Get user notifications',
      description: `
Retrieves a paginated list of notifications for the authenticated user.

**Query Parameters:**
- \`read\`: Filter by read status (true/false)
- \`module\`: Filter by module (assessment, ai_review, audit, payment, certificate, system)
- \`limit\`: Number of items per page (default: 50)
- \`offset\`: Number of items to skip (default: 0)

**Required Role**: Any authenticated user
      `,
    }),
    ApiQuery({
      name: 'read',
      required: false,
      type: String,
      enum: ['true', 'false'],
      description: 'Filter by read status',
    }),
    ApiQuery({
      name: 'module',
      required: false,
      type: String,
      enum: [
        'assessment',
        'ai_review',
        'audit',
        'payment',
        'certificate',
        'system',
      ],
      description: 'Filter by notification module',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 50,
      description: 'Number of items per page (default: 50)',
    }),
    ApiQuery({
      name: 'offset',
      required: false,
      type: Number,
      example: 0,
      description: 'Number of items to skip (default: 0)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Notifications retrieved successfully',
      type: GetNotificationsApiResponse,
    }),
  );
}

export function SwaggerGetConnectionStatus() {
  return applyDecorators(
    ApiExtraModels(GetConnectionStatusApiResponse),
    ApiOperation({
      summary: 'Get WebSocket connection status',
      description: `
Returns the WebSocket connection status for the authenticated user.

**Note**: In serverless environments (Vercel, AWS Lambda), WebSocket connections are not supported.
The response will include \`websocketSupported: false\` and a message explaining the limitation.

**Required Role**: Any authenticated user
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Connection status retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                format: 'uuid',
                example: '123e4567-e89b-12d3-a456-426614174000',
              },
              isOnline: { type: 'boolean', example: true },
              connectionCount: { type: 'number', example: 1 },
              websocketSupported: { type: 'boolean', example: true },
              message: {
                type: 'string',
                description: 'Only present when websocketSupported is false',
              },
            },
          },
        },
      },
    }),
  );
}

export function SwaggerGetConnectionStats() {
  return applyDecorators(
    ApiExtraModels(GetConnectionStatsApiResponse),
    ApiOperation({
      summary: 'Get WebSocket connection statistics',
      description: `
Returns overall WebSocket connection statistics including total connections and online users.

**Note**: In serverless environments (Vercel, AWS Lambda), WebSocket connections are not supported.
The response will include \`websocketSupported: false\` and a message explaining the limitation.

**Required Role**: Any authenticated user
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Connection statistics retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              totalConnections: { type: 'number', example: 15 },
              onlineUsersCount: { type: 'number', example: 10 },
              onlineUsers: {
                type: 'array',
                items: { type: 'string', format: 'uuid' },
              },
              websocketSupported: { type: 'boolean', example: true },
              message: {
                type: 'string',
                description: 'Only present when websocketSupported is false',
              },
            },
          },
        },
      },
    }),
  );
}

export function SwaggerGetUnreadCount() {
  return applyDecorators(
    ApiExtraModels(GetUnreadCountApiResponse),
    ApiOperation({
      summary: 'Get unread notification count',
      description: `
Returns the count of unread notifications for the authenticated user.

**Required Role**: Any authenticated user
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Unread count retrieved successfully',
      type: GetUnreadCountApiResponse,
    }),
  );
}

export function SwaggerMarkAsRead() {
  return applyDecorators(
    ApiExtraModels(MarkAsReadApiResponse, NotificationErrorDto),
    ApiOperation({
      summary: 'Mark notification as read',
      description: `
Marks a specific notification as read for the authenticated user.

**Required Role**: Any authenticated user
      `,
    }),
    ApiParam({
      name: 'id',
      description: 'Notification UUID',
      type: 'string',
      format: 'uuid',
      example: '22ffd51e-8a32-4523-b852-1b03ef2ab49e',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Notification marked as read successfully',
      type: MarkAsReadApiResponse,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Notification not found or access denied',
      type: NotificationErrorDto,
    }),
  );
}

export function SwaggerMarkAllAsRead() {
  return applyDecorators(
    ApiExtraModels(MarkAllAsReadApiResponse),
    ApiOperation({
      summary: 'Mark all notifications as read',
      description: `
Marks all unread notifications as read for the authenticated user.

**Required Role**: Any authenticated user
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'All notifications marked as read successfully',
      type: MarkAllAsReadApiResponse,
    }),
  );
}

export function SwaggerGetNotificationSettings() {
  return applyDecorators(
    ApiExtraModels(GetNotificationSettingsApiResponse),
    ApiOperation({
      summary: 'Get notification settings',
      description: `
Retrieves notification preferences for the authenticated user.
If no settings exist, default settings are created and returned.

**Required Role**: Any authenticated user
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Notification settings retrieved successfully',
      type: GetNotificationSettingsApiResponse,
    }),
  );
}

export function SwaggerUpdateNotificationSettings() {
  return applyDecorators(
    ApiExtraModels(
      UpdateNotificationSettingsApiResponse,
      UpdateAuditorNotificationSettingsDto,
      UpdateReviewerNotificationSettingsDto,
    ),
    ApiOperation({
      summary: 'Update notification settings',
      description: `
Updates notification preferences for the authenticated user. Only provided fields are updated.

**Role-specific fields:**
- **Auditor**: \`new_audit_assigned\`, \`audit_deadline_reminder\`, \`review_submission_alerts\`, \`system_announcements\`
- **Reviewer**: \`new_review_assigned\`, \`review_deadline_reminder\`, \`system_announcements\`
- Email / in-app channel toggles are global admin settings and are not part of this payload.

**Required Role**: Any authenticated user
      `,
    }),
    ApiBody({
      schema: {
        oneOf: [
          { $ref: getSchemaPath(UpdateAuditorNotificationSettingsDto) },
          { $ref: getSchemaPath(UpdateReviewerNotificationSettingsDto) },
        ],
      },
      description:
        'Role-based payload. Auditor users should send auditor fields; reviewer users should send reviewer fields.',
      examples: {
        auditorPayload: {
          summary: 'Auditor payload',
          value: {
            system_announcements: true,
            new_audit_assigned: true,
            audit_deadline_reminder: true,
            review_submission_alerts: false,
          },
        },
        reviewerPayload: {
          summary: 'Reviewer payload',
          value: {
            system_announcements: true,
            new_review_assigned: false,
            review_deadline_reminder: true,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Notification settings updated successfully',
      type: UpdateNotificationSettingsApiResponse,
    }),
  );
}

export function SwaggerGetAdminNotificationSettings() {
  return applyDecorators(
    ApiExtraModels(GetAdminNotificationSettingsApiResponse, AdminNotificationSettingsDto),
    ApiOperation({
      summary: 'Get global notification settings (admin)',
      description: `
Returns the platform-wide notification settings singleton.

**What this controls:**
- \`email_enabled\` / \`in_app_enabled\` — master channel toggles (override all user preferences)
- \`assessment_submissions_enabled\` — Assessment Submissions category
- \`ai_flags_enabled\` — AI Flags category
- \`audit_events_enabled\` — Audit Scheduling & Results category
- \`payment_events_enabled\` — Payment Events category
- \`certificate_events_enabled\` — Certificate Events category
- \`reminder_frequency\` — how often reminder notifications are sent (\`daily\`, \`weekly\`, \`none\`)

**Access:** admin, subadmin only
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Admin notification settings retrieved successfully',
      type: GetAdminNotificationSettingsApiResponse,
      schema: {
        example: {
          success: true,
          data: {
            id: '6d89daa8-6a99-4e2e-855e-9785efa946df',
            email_enabled: true,
            in_app_enabled: true,
            assessment_submissions_enabled: true,
            ai_flags_enabled: true,
            audit_events_enabled: true,
            payment_events_enabled: true,
            certificate_events_enabled: true,
            reminder_frequency: 'daily',
            created_at: '2026-03-03T01:41:40.138Z',
            updated_at: '2026-03-03T08:50:52.601Z',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden — admin or subadmin role required',
    }),
  );
}

export function SwaggerUpdateAdminNotificationSettings() {
  return applyDecorators(
    ApiExtraModels(
      UpdateAdminNotificationSettingsApiResponse,
      UpdateAdminNotificationSettingsDto,
    ),
    ApiOperation({
      summary: 'Update global notification settings (admin)',
      description: `
Updates the platform-wide notification settings. Only provided fields are changed.

Disabling \`email_enabled\` stops all email delivery regardless of individual user preferences.
Disabling any category toggle (e.g. \`payment_events_enabled\`) stops those notifications for ALL users.

**Access:** admin, subadmin only
      `,
    }),
    ApiBody({
      type: UpdateAdminNotificationSettingsDto,
      examples: {
        fullPayload: {
          summary: 'All global settings fields',
          value: {
            email_enabled: true,
            in_app_enabled: true,
            assessment_submissions_enabled: true,
            ai_flags_enabled: true,
            audit_events_enabled: true,
            payment_events_enabled: true,
            certificate_events_enabled: true,
            reminder_frequency: 'daily',
          },
        },
        disableEmail: {
          summary: 'Disable all emails',
          value: { email_enabled: false },
        },
        disablePaymentEvents: {
          summary: 'Turn off payment notifications',
          value: { payment_events_enabled: false },
        },
        setWeeklyReminders: {
          summary: 'Switch to weekly reminders',
          value: { reminder_frequency: 'weekly' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Admin notification settings updated successfully',
      type: UpdateAdminNotificationSettingsApiResponse,
      schema: {
        example: {
          success: true,
          data: {
            id: '6d89daa8-6a99-4e2e-855e-9785efa946df',
            email_enabled: true,
            in_app_enabled: true,
            assessment_submissions_enabled: true,
            ai_flags_enabled: true,
            audit_events_enabled: true,
            payment_events_enabled: true,
            certificate_events_enabled: true,
            reminder_frequency: 'daily',
            created_at: '2026-03-03T01:41:40.138Z',
            updated_at: '2026-03-03T08:50:52.601Z',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden — admin or subadmin role required',
    }),
  );
}
