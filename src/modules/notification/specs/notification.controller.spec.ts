import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { NotificationController } from '../notification.controller';
import { NotificationService } from '../services/notification.service';
import { ConnectionManagerService } from '../websocket/connection-manager.service';
import { NotificationRepository, NotificationSettings } from '../notification.repository';
import { BadgeService } from '../badge.service';
import { BadgeRepository } from '../badge.repository';
import { AdminNotificationSettings } from '../types/notification.types';

const mockAdminSettings: AdminNotificationSettings = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email_enabled: true,
  in_app_enabled: true,
  assessment_submissions_enabled: true,
  ai_flags_enabled: true,
  audit_events_enabled: true,
  payment_events_enabled: true,
  certificate_events_enabled: true,
  reminder_frequency: 'daily',
  created_at: new Date('2026-01-26T21:42:28.000Z'),
  updated_at: new Date('2026-01-26T21:42:28.000Z'),
};

const mockUserSettings: NotificationSettings = {
  id: 'settings-1',
  user_id: 'user-1',
  user_role: 'auditor',
  email_enabled: true,
  in_app_enabled: true,
  assessment_submissions_enabled: true,
  ai_flags_enabled: true,
  audit_scheduling_enabled: true,
  payment_events_enabled: true,
  certificate_events_enabled: true,
  reminder_frequency: 'daily',
  new_audit_assigned: true,
  audit_deadline_reminder: true,
  review_submission_alerts: true,
  new_review_assigned: true,
  review_deadline_reminder: true,
  system_announcements: true,
  created_at: new Date('2026-01-26T21:42:28.000Z'),
  updated_at: new Date('2026-01-26T21:42:28.000Z'),
};

const mockReq = { user: { sub: 'user-1', email: 'user@example.com', role: 'admin' } };

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationRepo: jest.Mocked<NotificationRepository>;
  let connectionManager: jest.Mocked<ConnectionManagerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: { notify: jest.fn() },
        },
        {
          provide: ConnectionManagerService,
          useValue: {
            isUserOnline: jest.fn(),
            getConnectionCountByUser: jest.fn(),
            getConnectionCount: jest.fn(),
            getOnlineUsers: jest.fn(),
          },
        },
        {
          provide: NotificationRepository,
          useValue: {
            getAdminSettings: jest.fn(),
            updateAdminSettings: jest.fn(),
            getNotificationSettings: jest.fn(),
            createDefaultSettings: jest.fn(),
            createOrUpdateNotificationSettings: jest.fn(),
            findNotificationsByUserId: jest.fn(),
            getUnreadCount: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
          },
        },
        {
          provide: BadgeService,
          useValue: { getBadgesForOrganization: jest.fn(), getBadgeById: jest.fn() },
        },
        {
          provide: BadgeRepository,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    notificationRepo = module.get(NotificationRepository);
    connectionManager = module.get(ConnectionManagerService);

    jest.clearAllMocks();
  });

  // ─── GET admin/settings ──────────────────────────────────────────────────────

  describe('getAdminSettings', () => {
    it('should return success: true with settings data', async () => {
      notificationRepo.getAdminSettings.mockResolvedValue(mockAdminSettings);

      const result = await controller.getAdminSettings();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAdminSettings);
    });

    it('should call repository getAdminSettings once', async () => {
      notificationRepo.getAdminSettings.mockResolvedValue(mockAdminSettings);

      await controller.getAdminSettings();

      expect(notificationRepo.getAdminSettings).toHaveBeenCalledTimes(1);
    });

    it('should return all required global settings fields', async () => {
      notificationRepo.getAdminSettings.mockResolvedValue(mockAdminSettings);

      const { data } = await controller.getAdminSettings();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email_enabled', true);
      expect(data).toHaveProperty('in_app_enabled', true);
      expect(data).toHaveProperty('assessment_submissions_enabled', true);
      expect(data).toHaveProperty('ai_flags_enabled', true);
      expect(data).toHaveProperty('audit_events_enabled', true);
      expect(data).toHaveProperty('payment_events_enabled', true);
      expect(data).toHaveProperty('certificate_events_enabled', true);
      expect(data).toHaveProperty('reminder_frequency', 'daily');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('updated_at');
    });

    it('should return current state accurately when some settings are disabled', async () => {
      const partiallyDisabled: AdminNotificationSettings = {
        ...mockAdminSettings,
        email_enabled: false,
        audit_events_enabled: false,
        reminder_frequency: 'weekly',
      };
      notificationRepo.getAdminSettings.mockResolvedValue(partiallyDisabled);

      const { data } = await controller.getAdminSettings();

      expect(data.email_enabled).toBe(false);
      expect(data.audit_events_enabled).toBe(false);
      expect(data.reminder_frequency).toBe('weekly');
      // Other fields remain as-is
      expect(data.in_app_enabled).toBe(true);
      expect(data.assessment_submissions_enabled).toBe(true);
    });
  });

  // ─── PATCH admin/settings ────────────────────────────────────────────────────

  describe('updateAdminSettings', () => {
    it('should return success: true with updated data', async () => {
      notificationRepo.updateAdminSettings.mockResolvedValue(mockAdminSettings);

      const result = await controller.updateAdminSettings({ email_enabled: true });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAdminSettings);
    });

    it('should return success message on update', async () => {
      notificationRepo.updateAdminSettings.mockResolvedValue(mockAdminSettings);

      const result = await controller.updateAdminSettings({ email_enabled: true });

      expect(result.message).toBe('Global notification settings updated successfully');
    });

    it('should pass dto directly to repository', async () => {
      notificationRepo.updateAdminSettings.mockResolvedValue(mockAdminSettings);
      const dto = { email_enabled: false };

      await controller.updateAdminSettings(dto);

      expect(notificationRepo.updateAdminSettings).toHaveBeenCalledWith(dto);
    });

    // ── email_enabled ──────────────────────────────────────────────────────────

    it('should disable email delivery (email_enabled → false)', async () => {
      const updated = { ...mockAdminSettings, email_enabled: false };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ email_enabled: false });

      expect(data.email_enabled).toBe(false);
    });

    it('should re-enable email delivery (email_enabled: false → true)', async () => {
      const updated = { ...mockAdminSettings, email_enabled: true };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ email_enabled: true });

      expect(data.email_enabled).toBe(true);
    });

    // ── in_app_enabled ─────────────────────────────────────────────────────────

    it('should disable in-app delivery (in_app_enabled → false)', async () => {
      const updated = { ...mockAdminSettings, in_app_enabled: false };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ in_app_enabled: false });

      expect(data.in_app_enabled).toBe(false);
    });

    it('should disable both channels at once', async () => {
      const updated = { ...mockAdminSettings, email_enabled: false, in_app_enabled: false };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ email_enabled: false, in_app_enabled: false });

      expect(data.email_enabled).toBe(false);
      expect(data.in_app_enabled).toBe(false);
    });

    // ── assessment_submissions_enabled ────────────────────────────────────────

    it('should disable assessment submission events', async () => {
      const updated = { ...mockAdminSettings, assessment_submissions_enabled: false };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ assessment_submissions_enabled: false });

      expect(data.assessment_submissions_enabled).toBe(false);
    });

    it('should re-enable assessment submission events', async () => {
      const updated = { ...mockAdminSettings, assessment_submissions_enabled: true };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ assessment_submissions_enabled: true });

      expect(data.assessment_submissions_enabled).toBe(true);
    });

    // ── ai_flags_enabled ──────────────────────────────────────────────────────

    it('should disable AI flag events', async () => {
      const updated = { ...mockAdminSettings, ai_flags_enabled: false };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ ai_flags_enabled: false });

      expect(data.ai_flags_enabled).toBe(false);
    });

    // ── audit_events_enabled ──────────────────────────────────────────────────

    it('should disable audit events', async () => {
      const updated = { ...mockAdminSettings, audit_events_enabled: false };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ audit_events_enabled: false });

      expect(data.audit_events_enabled).toBe(false);
    });

    // ── payment_events_enabled ────────────────────────────────────────────────

    it('should disable payment events', async () => {
      const updated = { ...mockAdminSettings, payment_events_enabled: false };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ payment_events_enabled: false });

      expect(data.payment_events_enabled).toBe(false);
    });

    // ── certificate_events_enabled ────────────────────────────────────────────

    it('should disable certificate events', async () => {
      const updated = { ...mockAdminSettings, certificate_events_enabled: false };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ certificate_events_enabled: false });

      expect(data.certificate_events_enabled).toBe(false);
    });

    it('should disable all category events at once', async () => {
      const updated = {
        ...mockAdminSettings,
        assessment_submissions_enabled: false,
        ai_flags_enabled: false,
        audit_events_enabled: false,
        payment_events_enabled: false,
        certificate_events_enabled: false,
      };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({
        assessment_submissions_enabled: false,
        ai_flags_enabled: false,
        audit_events_enabled: false,
        payment_events_enabled: false,
        certificate_events_enabled: false,
      });

      expect(data.assessment_submissions_enabled).toBe(false);
      expect(data.ai_flags_enabled).toBe(false);
      expect(data.audit_events_enabled).toBe(false);
      expect(data.payment_events_enabled).toBe(false);
      expect(data.certificate_events_enabled).toBe(false);
    });

    // ── reminder_frequency ────────────────────────────────────────────────────

    it('should update reminder_frequency to weekly', async () => {
      const updated = { ...mockAdminSettings, reminder_frequency: 'weekly' };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ reminder_frequency: 'weekly' });

      expect(data.reminder_frequency).toBe('weekly');
    });

    it('should update reminder_frequency to none', async () => {
      const updated = { ...mockAdminSettings, reminder_frequency: 'none' };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ reminder_frequency: 'none' });

      expect(data.reminder_frequency).toBe('none');
    });

    it('should update reminder_frequency back to daily', async () => {
      const updated = { ...mockAdminSettings, reminder_frequency: 'daily' };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({ reminder_frequency: 'daily' });

      expect(data.reminder_frequency).toBe('daily');
    });

    // ── multi-field updates ───────────────────────────────────────────────────

    it('should update multiple fields in a single call', async () => {
      const updated = { ...mockAdminSettings, email_enabled: false, assessment_submissions_enabled: false, reminder_frequency: 'weekly' };
      notificationRepo.updateAdminSettings.mockResolvedValue(updated);

      const { data } = await controller.updateAdminSettings({
        email_enabled: false,
        assessment_submissions_enabled: false,
        reminder_frequency: 'weekly',
      });

      expect(data.email_enabled).toBe(false);
      expect(data.assessment_submissions_enabled).toBe(false);
      expect(data.reminder_frequency).toBe('weekly');
    });

    it('should update all 8 fields in one call', async () => {
      const allDisabled: AdminNotificationSettings = {
        ...mockAdminSettings,
        email_enabled: false,
        in_app_enabled: false,
        assessment_submissions_enabled: false,
        ai_flags_enabled: false,
        audit_events_enabled: false,
        payment_events_enabled: false,
        certificate_events_enabled: false,
        reminder_frequency: 'none',
      };
      notificationRepo.updateAdminSettings.mockResolvedValue(allDisabled);

      const { data } = await controller.updateAdminSettings({
        email_enabled: false,
        in_app_enabled: false,
        assessment_submissions_enabled: false,
        ai_flags_enabled: false,
        audit_events_enabled: false,
        payment_events_enabled: false,
        certificate_events_enabled: false,
        reminder_frequency: 'none',
      });

      expect(data.email_enabled).toBe(false);
      expect(data.in_app_enabled).toBe(false);
      expect(data.assessment_submissions_enabled).toBe(false);
      expect(data.ai_flags_enabled).toBe(false);
      expect(data.audit_events_enabled).toBe(false);
      expect(data.payment_events_enabled).toBe(false);
      expect(data.certificate_events_enabled).toBe(false);
      expect(data.reminder_frequency).toBe('none');
    });

    it('should return unchanged settings when body is empty', async () => {
      notificationRepo.updateAdminSettings.mockResolvedValue(mockAdminSettings);

      const { data } = await controller.updateAdminSettings({});

      expect(data).toEqual(mockAdminSettings);
      expect(notificationRepo.updateAdminSettings).toHaveBeenCalledWith({});
    });
  });

  // ─── GET settings (user settings) ────────────────────────────────────────────

  describe('getSettings', () => {
    it('should return existing settings when found', async () => {
      notificationRepo.getNotificationSettings.mockResolvedValue(mockUserSettings);

      const result = await controller.getSettings(mockReq as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserSettings);
      expect(notificationRepo.createDefaultSettings).not.toHaveBeenCalled();
    });

    it('should create default settings when none exist and return them', async () => {
      notificationRepo.getNotificationSettings.mockResolvedValue(null);
      notificationRepo.createDefaultSettings.mockResolvedValue(mockUserSettings);

      const result = await controller.getSettings(mockReq as any);

      expect(notificationRepo.createDefaultSettings).toHaveBeenCalledWith('user-1', 'admin');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserSettings);
    });

    it('should use the authenticated user id from request', async () => {
      notificationRepo.getNotificationSettings.mockResolvedValue(mockUserSettings);

      await controller.getSettings(mockReq as any);

      expect(notificationRepo.getNotificationSettings).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── POST settings (update user settings) ────────────────────────────────────

  describe('updateSettings', () => {
    it('should update and return user settings', async () => {
      notificationRepo.createOrUpdateNotificationSettings.mockResolvedValue(mockUserSettings);

      const result = await controller.updateSettings(mockReq as any, {
        system_announcements: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserSettings);
    });

    it('should pass userId and settings to repository', async () => {
      notificationRepo.createOrUpdateNotificationSettings.mockResolvedValue(mockUserSettings);
      const dto = { system_announcements: false };

      await controller.updateSettings(mockReq as any, dto);

      expect(notificationRepo.createOrUpdateNotificationSettings).toHaveBeenCalledWith('user-1', dto);
    });

    it('should update role-specific auditor toggles', async () => {
      const updated = { ...mockUserSettings, new_audit_assigned: false, audit_deadline_reminder: false };
      notificationRepo.createOrUpdateNotificationSettings.mockResolvedValue(updated);
      const auditorReq = {
        user: { sub: 'user-1', email: 'auditor@example.com', role: 'auditor' },
      };

      const { data } = await controller.updateSettings(auditorReq as any, {
        new_audit_assigned: false,
        audit_deadline_reminder: false,
      });

      expect(data.new_audit_assigned).toBe(false);
      expect(data.audit_deadline_reminder).toBe(false);
    });

    it('should update role-specific reviewer toggles', async () => {
      const updated = { ...mockUserSettings, new_review_assigned: false, review_deadline_reminder: false };
      notificationRepo.createOrUpdateNotificationSettings.mockResolvedValue(updated);
      const reviewerReq = {
        user: { sub: 'user-1', email: 'reviewer@example.com', role: 'reviewer' },
      };

      const { data } = await controller.updateSettings(reviewerReq as any, {
        new_review_assigned: false,
        review_deadline_reminder: false,
      });

      expect(data.new_review_assigned).toBe(false);
      expect(data.review_deadline_reminder).toBe(false);
    });

    it('should update system_announcements toggle', async () => {
      const updated = { ...mockUserSettings, system_announcements: false };
      notificationRepo.createOrUpdateNotificationSettings.mockResolvedValue(updated);

      const { data } = await controller.updateSettings(mockReq as any, { system_announcements: false });

      expect(data.system_announcements).toBe(false);
    });
  });

  // ─── GET unread-count ─────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      notificationRepo.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockReq as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ count: 5 });
    });

    it('should return 0 when no unread notifications', async () => {
      notificationRepo.getUnreadCount.mockResolvedValue(0);

      const result = await controller.getUnreadCount(mockReq as any);

      expect(result.data.count).toBe(0);
    });
  });

  // ─── PATCH :id/read ───────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    const mockNotification = {
      id: 'notif-1',
      user_id: 'user-1',
      read: true,
      read_at: new Date(),
    } as any;

    it('should mark notification as read and return it', async () => {
      notificationRepo.markAsRead.mockResolvedValue(mockNotification);

      const result = await controller.markAsRead(mockReq as any, 'notif-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNotification);
      expect(notificationRepo.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
    });
  });

  // ─── PATCH read-all ───────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should mark all notifications as read and return count', async () => {
      notificationRepo.markAllAsRead.mockResolvedValue(3);

      const result = await controller.markAllAsRead(mockReq as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ count: 3 });
      expect(result.message).toBe('3 notification(s) marked as read');
    });

    it('should handle case where no notifications are unread', async () => {
      notificationRepo.markAllAsRead.mockResolvedValue(0);

      const result = await controller.markAllAsRead(mockReq as any);

      expect(result.data.count).toBe(0);
      expect(result.message).toBe('0 notification(s) marked as read');
    });
  });
});
