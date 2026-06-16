import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { QueryResult } from '../../common/types/database.types';
import { AdminNotificationSettings } from './types/notification.types';

export interface Notification {
  id: string;
  user_id: string;
  organization_id: string | null;
  branch_id: string | null;
  module: string;
  type: string;
  title: string;
  message: string;
  channel: 'email' | 'in_app' | 'both';
  read: boolean;
  read_at: Date | null;
  metadata: Record<string, unknown> | null;
  action_status: 'accepted' | 'declined' | null;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  user_role: string | null;
  email_enabled: boolean;
  in_app_enabled: boolean;
  assessment_submissions_enabled: boolean;
  ai_flags_enabled: boolean;
  audit_scheduling_enabled: boolean;
  payment_events_enabled: boolean;
  certificate_events_enabled: boolean;
  reminder_frequency: string;
  // Auditor-specific
  new_audit_assigned: boolean;
  audit_deadline_reminder: boolean;
  review_submission_alerts: boolean;
  // Reviewer-specific
  new_review_assigned: boolean;
  review_deadline_reminder: boolean;
  // Shared
  system_announcements: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class NotificationRepository {
  constructor(public readonly db: DatabaseService) {}

  // ─── User Lookup ──────────────────────────────────────────────────────────

  async getUserIdsByRoles(roles: string[]): Promise<string[]> {
    if (!roles.length) return [];
    const placeholders = roles.map((_, i) => `$${i + 1}`).join(', ');
    const result = (await this.db.query(
      `SELECT id FROM users WHERE role IN (${placeholders})`,
      roles,
    )) as QueryResult<{ id: string }>;
    return result.rows.map((r) => r.id);
  }

  // ─── Admin Settings ────────────────────────────────────────────────────────

  async getAdminSettings(): Promise<AdminNotificationSettings> {
    const result = (await this.db.query(
      `SELECT * FROM admin_notification_settings LIMIT 1`,
    )) as QueryResult<AdminNotificationSettings>;
    return result.rows[0];
  }

  async updateAdminSettings(
    settings: Partial<Omit<AdminNotificationSettings, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<AdminNotificationSettings> {
    const fields: string[] = [];
    const values: (string | boolean)[] = [];
    let paramIndex = 1;

    const boolFields = [
      'email_enabled',
      'in_app_enabled',
      'assessment_submissions_enabled',
      'ai_flags_enabled',
      'audit_events_enabled',
      'payment_events_enabled',
      'certificate_events_enabled',
    ] as const;

    for (const field of boolFields) {
      if (settings[field] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(settings[field] as boolean);
        paramIndex++;
      }
    }

    if (settings.reminder_frequency !== undefined) {
      fields.push(`reminder_frequency = $${paramIndex}`);
      values.push(settings.reminder_frequency);
      paramIndex++;
    }

    if (fields.length === 0) {
      return this.getAdminSettings();
    }

    const result = (await this.db.query(
      `UPDATE admin_notification_settings
       SET ${fields.join(', ')}, updated_at = NOW()
       RETURNING *`,
      values,
    )) as QueryResult<AdminNotificationSettings>;

    return result.rows[0];
  }

  // ─── User Emails ───────────────────────────────────────────────────────────

  async getUserEmails(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const result = (await this.db.query(
      `SELECT id, email FROM users WHERE id = ANY($1)`,
      [userIds],
    )) as QueryResult<{ id: string; email: string }>;
    return new Map(result.rows.map((r) => [r.id, r.email]));
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  async createNotification(data: {
    user_id: string;
    organization_id?: string | null;
    branch_id?: string | null;
    module: string;
    type: string;
    title: string;
    message: string;
    channel: 'email' | 'in_app' | 'both';
    metadata?: Record<string, unknown>;
  }): Promise<Notification> {
    const result = (await this.db.query(
      `INSERT INTO notifications
       (user_id, organization_id, branch_id, module, type, title, message, channel, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.user_id,
        data.organization_id || null,
        data.branch_id || null,
        data.module,
        data.type,
        data.title,
        data.message,
        data.channel,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ],
    )) as QueryResult<Notification>;

    return result.rows[0];
  }

  async findNotificationsByUserId(
    userId: string,
    options?: {
      read?: boolean;
      module?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ notifications: Notification[]; total: number }> {
    const conditions: string[] = ['user_id = $1'];
    const params: (string | number | boolean)[] = [userId];
    let paramIndex = 2;

    if (options?.read !== undefined) {
      conditions.push(`read = $${paramIndex}`);
      params.push(options.read);
      paramIndex++;
    }

    if (options?.module) {
      conditions.push(`module = $${paramIndex}`);
      params.push(options.module);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
      params,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    params.push(limit, offset);
    const result = (await this.db.query(
      `SELECT * FROM notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params,
    )) as QueryResult<Notification>;

    return {
      notifications: result.rows,
      total,
    };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    const result = (await this.db.query(
      `UPDATE notifications
       SET read = TRUE, read_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId],
    )) as QueryResult<Notification>;

    if (result.rows.length === 0) {
      throw new Error('Notification not found or access denied');
    }

    return result.rows[0];
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = (await this.db.query(
      `UPDATE notifications
       SET read = TRUE, read_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND read = FALSE
       RETURNING id`,
      [userId],
    )) as QueryResult<{ id: string }>;

    return result.rows.length;
  }

  async setActionStatus(
    userId: string,
    invitationId: string,
    status: 'accepted' | 'declined',
  ): Promise<void> {
    await this.db.query(
      `UPDATE notifications
       SET action_status = $3, updated_at = NOW()
       WHERE user_id = $1
         AND metadata->>'invitationId' = $2
         AND action_status IS NULL`,
      [userId, invitationId, status],
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = (await this.db.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND read = FALSE`,
      [userId],
    )) as QueryResult<{ count: string }>;

    return parseInt(result.rows[0].count, 10);
  }

  // ─── Notification Settings ─────────────────────────────────────────────────

  async getNotificationSettings(
    userId: string,
  ): Promise<NotificationSettings | null> {
    const result = (await this.db.query(
      `SELECT * FROM notification_settings WHERE user_id = $1`,
      [userId],
    )) as QueryResult<NotificationSettings>;

    return result.rows[0] || null;
  }

  async createOrUpdateNotificationSettings(
    userId: string,
    settings: {
      email_enabled?: boolean;
      in_app_enabled?: boolean;
      assessment_submissions_enabled?: boolean;
      ai_flags_enabled?: boolean;
      audit_scheduling_enabled?: boolean;
      payment_events_enabled?: boolean;
      certificate_events_enabled?: boolean;
      reminder_frequency?: string;
      // Role-specific auditor
      new_audit_assigned?: boolean;
      audit_deadline_reminder?: boolean;
      review_submission_alerts?: boolean;
      // Role-specific reviewer
      new_review_assigned?: boolean;
      review_deadline_reminder?: boolean;
      // Shared
      system_announcements?: boolean;
    },
  ): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(userId);

    if (existing) {
      const fields: string[] = [];
      const values: (string | boolean)[] = [];
      let paramIndex = 1;

      const allFields: Array<[string, string | boolean | undefined]> = [
        ['email_enabled', settings.email_enabled],
        ['in_app_enabled', settings.in_app_enabled],
        ['assessment_submissions_enabled', settings.assessment_submissions_enabled],
        ['ai_flags_enabled', settings.ai_flags_enabled],
        ['audit_scheduling_enabled', settings.audit_scheduling_enabled],
        ['payment_events_enabled', settings.payment_events_enabled],
        ['certificate_events_enabled', settings.certificate_events_enabled],
        ['reminder_frequency', settings.reminder_frequency],
        ['new_audit_assigned', settings.new_audit_assigned],
        ['audit_deadline_reminder', settings.audit_deadline_reminder],
        ['review_submission_alerts', settings.review_submission_alerts],
        ['new_review_assigned', settings.new_review_assigned],
        ['review_deadline_reminder', settings.review_deadline_reminder],
        ['system_announcements', settings.system_announcements],
      ];

      for (const [field, value] of allFields) {
        if (value !== undefined) {
          fields.push(`${field} = $${paramIndex}`);
          values.push(value as string | boolean);
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        return existing;
      }

      values.push(userId);
      const result = (await this.db.query(
        `UPDATE notification_settings
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE user_id = $${paramIndex}
         RETURNING *`,
        values,
      )) as QueryResult<NotificationSettings>;

      return result.rows[0];
    } else {
      const result = (await this.db.query(
        `INSERT INTO notification_settings
         (user_id, email_enabled, in_app_enabled, assessment_submissions_enabled,
          ai_flags_enabled, audit_scheduling_enabled, payment_events_enabled,
          certificate_events_enabled, reminder_frequency,
          new_audit_assigned, audit_deadline_reminder, review_submission_alerts,
          new_review_assigned, review_deadline_reminder, system_announcements)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          userId,
          settings.email_enabled ?? true,
          settings.in_app_enabled ?? true,
          settings.assessment_submissions_enabled ?? true,
          settings.ai_flags_enabled ?? true,
          settings.audit_scheduling_enabled ?? true,
          settings.payment_events_enabled ?? true,
          settings.certificate_events_enabled ?? true,
          settings.reminder_frequency ?? 'daily',
          settings.new_audit_assigned ?? true,
          settings.audit_deadline_reminder ?? true,
          settings.review_submission_alerts ?? true,
          settings.new_review_assigned ?? true,
          settings.review_deadline_reminder ?? true,
          settings.system_announcements ?? true,
        ],
      )) as QueryResult<NotificationSettings>;

      return result.rows[0];
    }
  }

  async createDefaultSettings(
    userId: string,
    role?: string,
  ): Promise<NotificationSettings> {
    const result = (await this.db.query(
      `INSERT INTO notification_settings
       (user_id, user_role, email_enabled, in_app_enabled, assessment_submissions_enabled,
        ai_flags_enabled, audit_scheduling_enabled, payment_events_enabled, certificate_events_enabled,
        new_audit_assigned, audit_deadline_reminder, review_submission_alerts,
        new_review_assigned, review_deadline_reminder, system_announcements)
       VALUES ($1, $2, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
       ON CONFLICT (user_id) DO UPDATE SET
         user_role = COALESCE(EXCLUDED.user_role, notification_settings.user_role),
         updated_at = NOW()
       RETURNING *`,
      [userId, role || null],
    )) as QueryResult<NotificationSettings>;

    return result.rows[0];
  }

  async getNotificationSettingsBatch(
    userIds: string[],
  ): Promise<Map<string, NotificationSettings>> {
    if (userIds.length === 0) return new Map();

    const result = (await this.db.query(
      `SELECT * FROM notification_settings WHERE user_id = ANY($1)`,
      [userIds],
    )) as QueryResult<NotificationSettings>;

    return new Map(result.rows.map((s) => [s.user_id, s]));
  }

  async createNotificationsBatch(
    notifications: Array<{
      user_id: string;
      organization_id?: string | null;
      branch_id?: string | null;
      module: string;
      type: string;
      title: string;
      message: string;
      channel: 'email' | 'in_app' | 'both';
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<Notification[]> {
    if (notifications.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < notifications.length; i++) {
      const offset = i * 9;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`,
      );
      values.push(
        notifications[i].user_id,
        notifications[i].organization_id || null,
        notifications[i].branch_id || null,
        notifications[i].module,
        notifications[i].type,
        notifications[i].title,
        notifications[i].message,
        notifications[i].channel,
        notifications[i].metadata
          ? JSON.stringify(notifications[i].metadata)
          : null,
      );
    }

    const result = (await this.db.query(
      `INSERT INTO notifications
       (user_id, organization_id, branch_id, module, type, title, message, channel, metadata)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values,
    )) as QueryResult<Notification>;
    return result.rows;
  }

  /**
   * Evaluates whether a notification should be sent to a user given:
   * - The global admin settings (category enabled? email/in-app channels?)
   * - The user's role-specific preferences (if auditor/reviewer)
   * Applicants have no user-level overrides — admin settings fully govern them.
   */
  evaluateUserNotificationSettings(
    settings: NotificationSettings | undefined,
    adminSettings: AdminNotificationSettings,
    module: string,
    type: string,
  ): { email: boolean; inApp: boolean } {
    // 1. Check admin category toggle
    const categoryEnabled = this.isAdminCategoryEnabled(
      adminSettings,
      module,
      type,
    );
    if (!categoryEnabled) {
      return { email: false, inApp: false };
    }

    // 2. Channels as allowed by admin
    const adminEmail = adminSettings.email_enabled;
    const adminInApp = adminSettings.in_app_enabled;

    // 3. No user settings → defaults (admin controls everything)
    if (!settings) {
      return { email: adminEmail, inApp: adminInApp };
    }

    // 4. For auditors/reviewers check their role-specific toggle
    const userAllowed = this.isUserRoleToggleEnabled(settings, module, type);

    return {
      email: adminEmail && userAllowed,
      inApp: adminInApp && userAllowed,
    };
  }

  private isAdminCategoryEnabled(
    adminSettings: AdminNotificationSettings,
    module: string,
    type: string,
  ): boolean {
    switch (module) {
      case 'assessment':
        return adminSettings.assessment_submissions_enabled;
      case 'ai_review':
        return adminSettings.ai_flags_enabled;
      case 'audit':
        return adminSettings.audit_events_enabled;
      case 'payment':
        return adminSettings.payment_events_enabled;
      case 'certificate':
        return adminSettings.certificate_events_enabled;
      case 'system':
        return true; // system notifications always pass admin check
      default:
        return true;
    }
  }

  private isUserRoleToggleEnabled(
    settings: NotificationSettings,
    module: string,
    type: string,
  ): boolean {
    const role = settings.user_role;

    // Non-auditor, non-reviewer (applicant, admin, etc.) → no user-level toggle
    if (role !== 'auditor' && role !== 'reviewer') {
      return true;
    }

    if (module === 'system') {
      return settings.system_announcements;
    }

    if (module !== 'audit') {
      // Auditors/reviewers only have toggles for audit-module events and system
      return true;
    }

    if (role === 'auditor') {
      if (type === 'new_audit_assigned') return settings.new_audit_assigned;
      if (type === 'audit_deadline') return settings.audit_deadline_reminder;
      if (type === 'review_submission') return settings.review_submission_alerts;
    }

    if (role === 'reviewer') {
      if (type === 'new_review_assigned') return settings.new_review_assigned;
      if (type === 'review_deadline') return settings.review_deadline_reminder;
    }

    return true;
  }

  /** @deprecated Use evaluateUserNotificationSettings instead */
  evaluateNotificationSettings(
    settings: NotificationSettings | undefined,
    module: string,
    type: string,
  ): { email: boolean; inApp: boolean } {
    if (!settings) {
      return { email: true, inApp: true };
    }

    let typeEnabled = true;
    if (module === 'assessment' && type.includes('submission')) {
      typeEnabled = settings.assessment_submissions_enabled;
    } else if (module === 'ai_review' && type.includes('flag')) {
      typeEnabled = settings.ai_flags_enabled;
    } else if (module === 'audit') {
      typeEnabled = settings.audit_scheduling_enabled;
    } else if (module === 'payment') {
      typeEnabled = settings.payment_events_enabled;
    } else if (module === 'certificate') {
      typeEnabled = settings.certificate_events_enabled;
    }

    return {
      email: settings.email_enabled && typeEnabled,
      inApp: settings.in_app_enabled && typeEnabled,
    };
  }
}
