import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsEnum } from 'class-validator';

// ─── Notification ──────────────────────────────────────────────────────────────

export class NotificationDto {
  @ApiProperty({ example: '22ffd51e-8a32-4523-b852-1b03ef2ab49e' })
  id: string;

  @ApiProperty({ example: '0cda2c55-ca9f-4e3d-a0bc-322628f26d27' })
  user_id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  organization_id: string | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    nullable: true,
  })
  branch_id: string | null;

  @ApiProperty({
    example: 'assessment',
    enum: ['assessment', 'ai_review', 'audit', 'payment', 'certificate', 'system'],
  })
  module: string;

  @ApiProperty({ example: 'assessment_submission' })
  type: string;

  @ApiProperty({ example: 'Assessment Submitted' })
  title: string;

  @ApiProperty({
    example: 'Your assessment has been submitted and is now under AI review.',
  })
  message: string;

  @ApiProperty({ example: 'in_app', enum: ['email', 'in_app', 'both'] })
  channel: string;

  @ApiProperty({ example: false })
  read: boolean;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z', nullable: true })
  read_at: Date | null;

  @ApiProperty({
    example: { assessment_id: '123e4567-e89b-12d3-a456-426614174000' },
    nullable: true,
  })
  metadata: Record<string, unknown> | null;

  @ApiProperty({
    example: 'accepted',
    enum: ['accepted', 'declined'],
    nullable: true,
    description: 'Action taken on this notification (null if not yet acted upon)',
  })
  action_status: 'accepted' | 'declined' | null;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z' })
  updated_at: Date;
}

export class NotificationListResponse {
  @ApiProperty({ type: [NotificationDto] })
  notifications: NotificationDto[];

  @ApiProperty({ example: 15 })
  total: number;
}

export class GetNotificationsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: NotificationListResponse })
  data: NotificationListResponse;
}

// ─── Connection Status ─────────────────────────────────────────────────────────

export class ConnectionStatusDto {
  @ApiProperty({ example: '0cda2c55-ca9f-4e3d-a0bc-322628f26d27' })
  userId: string;

  @ApiProperty({ example: true })
  isOnline: boolean;

  @ApiProperty({ example: 2 })
  connectionCount: number;
}

export class GetConnectionStatusApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ConnectionStatusDto })
  data: ConnectionStatusDto;
}

export class ConnectionStatsDto {
  @ApiProperty({ example: 5 })
  totalConnections: number;

  @ApiProperty({ example: 3 })
  onlineUsersCount: number;

  @ApiProperty({
    example: ['user1-id', 'user2-id', 'user3-id'],
    type: [String],
  })
  onlineUsers: string[];
}

export class GetConnectionStatsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ConnectionStatsDto })
  data: ConnectionStatsDto;
}

// ─── Unread Count ──────────────────────────────────────────────────────────────

export class UnreadCountDto {
  @ApiProperty({ example: 5 })
  count: number;
}

export class GetUnreadCountApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: UnreadCountDto })
  data: UnreadCountDto;
}

// ─── Mark Read ─────────────────────────────────────────────────────────────────

export class MarkAsReadApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: NotificationDto })
  data: NotificationDto;
}

export class MarkAllAsReadApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '3 notification(s) marked as read' })
  message: string;

  @ApiProperty({ type: UnreadCountDto })
  data: UnreadCountDto;
}

// ─── Admin Notification Settings ───────────────────────────────────────────────

export class AdminNotificationSettingsDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: true, description: 'Master toggle for email delivery' })
  email_enabled: boolean;

  @ApiProperty({ example: true, description: 'Master toggle for in-app delivery' })
  in_app_enabled: boolean;

  @ApiProperty({ example: true, description: 'Assessment submission events' })
  assessment_submissions_enabled: boolean;

  @ApiProperty({ example: true, description: 'AI review flag events' })
  ai_flags_enabled: boolean;

  @ApiProperty({ example: true, description: 'Audit scheduling and results events' })
  audit_events_enabled: boolean;

  @ApiProperty({ example: true, description: 'Payment confirmation and refund events' })
  payment_events_enabled: boolean;

  @ApiProperty({ example: true, description: 'Certificate issuance, renewal and expiry events' })
  certificate_events_enabled: boolean;

  @ApiProperty({ example: 'daily', enum: ['daily', 'weekly', 'none'] })
  reminder_frequency: string;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z' })
  updated_at: Date;
}

export class UpdateAdminNotificationSettingsDto {
  @ApiPropertyOptional({ example: true, description: 'Master toggle for email delivery' })
  @IsOptional()
  @IsBoolean()
  email_enabled?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Master toggle for in-app delivery' })
  @IsOptional()
  @IsBoolean()
  in_app_enabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  assessment_submissions_enabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  ai_flags_enabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  audit_events_enabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  payment_events_enabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  certificate_events_enabled?: boolean;

  @ApiPropertyOptional({ example: 'daily', enum: ['daily', 'weekly', 'none'] })
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'none'])
  reminder_frequency?: string;
}

export class GetAdminNotificationSettingsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AdminNotificationSettingsDto })
  data: AdminNotificationSettingsDto;
}

export class UpdateAdminNotificationSettingsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AdminNotificationSettingsDto })
  data: AdminNotificationSettingsDto;
}

// ─── User Notification Settings ────────────────────────────────────────────────

export class NotificationSettingsDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '0cda2c55-ca9f-4e3d-a0bc-322628f26d27' })
  user_id: string;

  @ApiPropertyOptional({ example: 'auditor', nullable: true })
  user_role: string | null;

  @ApiProperty({ example: true })
  email_enabled: boolean;

  @ApiProperty({ example: true })
  in_app_enabled: boolean;

  @ApiProperty({ example: true })
  assessment_submissions_enabled: boolean;

  @ApiProperty({ example: true })
  ai_flags_enabled: boolean;

  @ApiProperty({ example: true })
  audit_scheduling_enabled: boolean;

  @ApiProperty({ example: true })
  payment_events_enabled: boolean;

  @ApiProperty({ example: true })
  certificate_events_enabled: boolean;

  @ApiProperty({ example: 'daily' })
  reminder_frequency: string;

  @ApiProperty({ example: true, description: 'Auditor: notified when assigned to a new audit' })
  new_audit_assigned: boolean;

  @ApiProperty({ example: true, description: 'Auditor: deadline reminder before audit due date' })
  audit_deadline_reminder: boolean;

  @ApiProperty({ example: true, description: 'Auditor: alerted when reviewer submits on their audit' })
  review_submission_alerts: boolean;

  @ApiProperty({ example: true, description: 'Reviewer: notified when assigned to review an assessment' })
  new_review_assigned: boolean;

  @ApiProperty({ example: true, description: 'Reviewer: deadline reminder before review due date' })
  review_deadline_reminder: boolean;

  @ApiProperty({ example: true, description: 'Auditor/Reviewer: system-wide platform announcements' })
  system_announcements: boolean;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z' })
  updated_at: Date;
}

export class GetNotificationSettingsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: NotificationSettingsDto })
  data: NotificationSettingsDto;
}

export class UpdateUserNotificationCommonSettingsDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Auditor/Reviewer: toggle system announcements',
  })
  @IsOptional()
  @IsBoolean()
  system_announcements?: boolean;
}

export class UpdateAuditorNotificationSettingsDto extends UpdateUserNotificationCommonSettingsDto {

  @ApiPropertyOptional({ example: true, description: 'Auditor only: toggle new audit assigned notifications' })
  @IsOptional()
  @IsBoolean()
  new_audit_assigned?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Auditor only: toggle audit deadline reminder' })
  @IsOptional()
  @IsBoolean()
  audit_deadline_reminder?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Auditor only: toggle review submission alerts' })
  @IsOptional()
  @IsBoolean()
  review_submission_alerts?: boolean;
}

export class UpdateReviewerNotificationSettingsDto extends UpdateUserNotificationCommonSettingsDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Reviewer only: toggle new review assigned notifications',
  })
  @IsOptional()
  @IsBoolean()
  new_review_assigned?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Reviewer only: toggle review deadline reminder',
  })
  @IsOptional()
  @IsBoolean()
  review_deadline_reminder?: boolean;
}

export class UpdateNotificationSettingsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: NotificationSettingsDto })
  data: NotificationSettingsDto;
}

export class NotificationErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Notification not found or access denied' })
  message: string;
}
