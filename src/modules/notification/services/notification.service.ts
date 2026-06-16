import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationRequest,
  NotificationPayload,
  NotificationPriority,
} from '../types/notification.types';
import { NotificationGateway } from '../websocket/notification.gateway';
import { NotificationRepository } from '../notification.repository';
import { NotificationEmailService } from './notification-email.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationGateway: NotificationGateway,
    private readonly notificationRepo: NotificationRepository,
    private readonly notificationEmailService: NotificationEmailService,
  ) {}

  async notifyUser(
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    await this.notify({
      payload,
      target: {
        userIds: [userId],
      },
    });
  }

  async notifyUsers(
    userIds: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    await this.notify({
      payload,
      target: {
        userIds,
      },
    });
  }

  async notifyRole(role: string, payload: NotificationPayload): Promise<void> {
    await this.notify({
      payload,
      target: {
        roles: [role],
      },
    });
  }

  async notifyRoles(
    roles: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    await this.notify({
      payload,
      target: {
        roles,
      },
    });
  }

  async broadcast(payload: NotificationPayload): Promise<void> {
    await this.notify({
      payload,
      target: {
        broadcast: true,
      },
    });
  }

  async notify(request: NotificationRequest): Promise<void> {
    try {
      const { payload, target } = request;

      if (!payload.id) {
        payload.id = this.generateNotificationId();
      }

      if (!payload.timestamp) {
        payload.timestamp = new Date();
      }

      if (!payload.priority) {
        payload.priority = NotificationPriority.MEDIUM;
      }

      if (target.broadcast) {
        await this.handleBroadcast(payload);
        return;
      }

      if (target.roles && target.roles.length > 0) {
        await this.handleRoleNotification(target.roles, payload);
      }

      if (target.userIds && target.userIds.length > 0) {
        await this.handleUserNotification(target.userIds, payload);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send notification: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async handleBroadcast(payload: NotificationPayload): Promise<void> {
    await this.notificationGateway.broadcast(payload);
    this.logger.debug(
      `Broadcast notification sent: ${payload.id} (${payload.type})`,
    );
  }

  private async handleRoleNotification(
    roles: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    await this.notificationGateway.sendToRoles(roles, payload);
    this.logger.debug(
      `Notification sent to roles [${roles.join(', ')}]: ${payload.id} (${payload.type})`,
    );
  }

  private async handleUserNotification(
    userIds: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) return;

    try {
      const module = payload.module || 'system';

      // Fetch admin settings once to evaluate global channel + category toggles
      const adminSettings = await this.notificationRepo.getAdminSettings();

      // Short-circuit: if admin has globally disabled this category, skip everyone
      if (adminSettings) {
        const { email: adminEmail, inApp: adminInApp } =
          this.notificationRepo.evaluateUserNotificationSettings(
            undefined,
            adminSettings,
            module,
            payload.type,
          );
        if (!adminEmail && !adminInApp) {
          this.logger.debug(
            `Admin has disabled notifications for ${module}/${payload.type} — skipping all users`,
          );
          return;
        }
      }

      // Batch-fetch user notification settings for eligibility check
      const settingsMap =
        await this.notificationRepo.getNotificationSettingsBatch(uniqueUserIds);

      const eligibleInApp: string[] = [];
      const eligibleEmail: string[] = [];

      for (const userId of uniqueUserIds) {
        const userSettings = settingsMap.get(userId);
        const { email, inApp } =
          this.notificationRepo.evaluateUserNotificationSettings(
            userSettings,
            adminSettings,
            module,
            payload.type,
          );

        if (inApp) eligibleInApp.push(userId);
        if (email) eligibleEmail.push(userId);

        if (!inApp && !email) {
          this.logger.debug(
            `User ${userId} has disabled notifications for ${module}/${payload.type}`,
          );
        }
      }

      // ── In-app notifications ──────────────────────────────────────────────
      if (eligibleInApp.length > 0) {
        const notificationData = eligibleInApp.map((userId) => ({
          user_id: userId,
          organization_id: payload.metadata?.organization_id as
            | string
            | undefined,
          branch_id: payload.metadata?.branch_id as string | undefined,
          module,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          channel: 'in_app' as const,
          metadata: payload.metadata,
        }));

        const createdNotifications =
          await this.notificationRepo.createNotificationsBatch(notificationData);

        const notificationsByUserId = new Map(
          createdNotifications.map((n) => [n.user_id, n]),
        );

        for (const userId of eligibleInApp) {
          try {
            const notification = notificationsByUserId.get(userId);
            if (notification) {
              await this.notificationGateway.sendToUser(userId, {
                ...payload,
                id: notification.id,
              });
              this.logger.debug(
                `In-app notification created and sent to user ${userId}: ${notification.id}`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Failed to send WebSocket notification to user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }

      // ── Email notifications ───────────────────────────────────────────────
      if (eligibleEmail.length > 0) {
        const emailMap = await this.notificationRepo.getUserEmails(eligibleEmail);

        for (const userId of eligibleEmail) {
          const email = emailMap.get(userId);
          if (email) {
            this.notificationEmailService
              .sendNotificationEmail(email, payload)
              .catch((err) => {
                this.logger.error(
                  `Failed to send notification email to user ${userId} (${email}): ${err instanceof Error ? err.message : String(err)}`,
                );
              });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle batch notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
