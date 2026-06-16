import { NotificationRepository, NotificationSettings } from '../notification.repository';
import { AdminNotificationSettings } from '../types/notification.types';
import { DatabaseService } from '../../../database/database.service';

const defaultAdminSettings: AdminNotificationSettings = {
  id: 'admin-1',
  email_enabled: true,
  in_app_enabled: true,
  assessment_submissions_enabled: true,
  ai_flags_enabled: true,
  audit_events_enabled: true,
  payment_events_enabled: true,
  certificate_events_enabled: true,
  reminder_frequency: 'daily',
  created_at: new Date(),
  updated_at: new Date(),
};

const auditorSettings: NotificationSettings = {
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
  created_at: new Date(),
  updated_at: new Date(),
};

const reviewerSettings: NotificationSettings = {
  ...auditorSettings,
  user_role: 'reviewer',
};

const applicantSettings: NotificationSettings = {
  ...auditorSettings,
  user_role: null,
};

describe('NotificationRepository — evaluateUserNotificationSettings', () => {
  let repo: NotificationRepository;

  beforeEach(() => {
    const mockDb = {} as DatabaseService;
    repo = new NotificationRepository(mockDb);
  });

  describe('admin category gates', () => {
    it('should return false/false when audit_events_enabled is off', () => {
      const admin = { ...defaultAdminSettings, audit_events_enabled: false };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'audit', 'new_audit_assigned')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should return false/false when assessment_submissions_enabled is off', () => {
      const admin = { ...defaultAdminSettings, assessment_submissions_enabled: false };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'assessment', 'submission')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should return false/false when ai_flags_enabled is off', () => {
      const admin = { ...defaultAdminSettings, ai_flags_enabled: false };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'ai_review', 'flag')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should return false/false when payment_events_enabled is off', () => {
      const admin = { ...defaultAdminSettings, payment_events_enabled: false };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'payment', 'invoice')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should return false/false when certificate_events_enabled is off', () => {
      const admin = { ...defaultAdminSettings, certificate_events_enabled: false };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'certificate', 'issued')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should always pass system category (no admin toggle)', () => {
      const admin = { ...defaultAdminSettings };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'system', 'announcement')).toEqual({
        email: true,
        inApp: true,
      });
    });
  });

  describe('admin channel toggles (no user settings)', () => {
    it('should disable email when admin email_enabled is false', () => {
      const admin = { ...defaultAdminSettings, email_enabled: false };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'audit', 'new_audit_assigned')).toEqual({
        email: false,
        inApp: true,
      });
    });

    it('should disable in-app when admin in_app_enabled is false', () => {
      const admin = { ...defaultAdminSettings, in_app_enabled: false };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'audit', 'new_audit_assigned')).toEqual({
        email: true,
        inApp: false,
      });
    });

    it('should return both false when both admin channels disabled', () => {
      const admin = { ...defaultAdminSettings, email_enabled: false, in_app_enabled: false };
      expect(repo.evaluateUserNotificationSettings(undefined, admin, 'audit', 'new_audit_assigned')).toEqual({
        email: false,
        inApp: false,
      });
    });
  });

  describe('applicant / admin (no user-level overrides)', () => {
    it('should return admin channels when user has null role', () => {
      expect(repo.evaluateUserNotificationSettings(applicantSettings, defaultAdminSettings, 'audit', 'new_audit_assigned')).toEqual({
        email: true,
        inApp: true,
      });
    });

    it('should override with admin channels even when user has settings', () => {
      const admin = { ...defaultAdminSettings, email_enabled: false };
      expect(repo.evaluateUserNotificationSettings(applicantSettings, admin, 'payment', 'invoice')).toEqual({
        email: false,
        inApp: true,
      });
    });
  });

  describe('auditor role-specific toggles', () => {
    it('should block new_audit_assigned when auditor disables it', () => {
      const settings = { ...auditorSettings, new_audit_assigned: false };
      expect(repo.evaluateUserNotificationSettings(settings, defaultAdminSettings, 'audit', 'new_audit_assigned')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should allow new_audit_assigned when auditor has it enabled', () => {
      expect(repo.evaluateUserNotificationSettings(auditorSettings, defaultAdminSettings, 'audit', 'new_audit_assigned')).toEqual({
        email: true,
        inApp: true,
      });
    });

    it('should block audit_deadline when auditor disables audit_deadline_reminder', () => {
      const settings = { ...auditorSettings, audit_deadline_reminder: false };
      expect(repo.evaluateUserNotificationSettings(settings, defaultAdminSettings, 'audit', 'audit_deadline')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should block review_submission when auditor disables review_submission_alerts', () => {
      const settings = { ...auditorSettings, review_submission_alerts: false };
      expect(repo.evaluateUserNotificationSettings(settings, defaultAdminSettings, 'audit', 'review_submission')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should allow non-audit module notifications regardless of audit toggles', () => {
      const settings = { ...auditorSettings, new_audit_assigned: false, audit_deadline_reminder: false };
      expect(repo.evaluateUserNotificationSettings(settings, defaultAdminSettings, 'payment', 'invoice')).toEqual({
        email: true,
        inApp: true,
      });
    });

    it('should respect admin email disable even when auditor toggle is on', () => {
      const admin = { ...defaultAdminSettings, email_enabled: false };
      expect(repo.evaluateUserNotificationSettings(auditorSettings, admin, 'audit', 'new_audit_assigned')).toEqual({
        email: false,
        inApp: true,
      });
    });

    it('should block all if admin category disabled, regardless of user toggle', () => {
      const admin = { ...defaultAdminSettings, audit_events_enabled: false };
      expect(repo.evaluateUserNotificationSettings(auditorSettings, admin, 'audit', 'new_audit_assigned')).toEqual({
        email: false,
        inApp: false,
      });
    });
  });

  describe('reviewer role-specific toggles', () => {
    it('should block new_review_assigned when reviewer disables it', () => {
      const settings = { ...reviewerSettings, new_review_assigned: false };
      expect(repo.evaluateUserNotificationSettings(settings, defaultAdminSettings, 'audit', 'new_review_assigned')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should allow new_review_assigned when reviewer has it enabled', () => {
      expect(repo.evaluateUserNotificationSettings(reviewerSettings, defaultAdminSettings, 'audit', 'new_review_assigned')).toEqual({
        email: true,
        inApp: true,
      });
    });

    it('should block review_deadline when reviewer disables review_deadline_reminder', () => {
      const settings = { ...reviewerSettings, review_deadline_reminder: false };
      expect(repo.evaluateUserNotificationSettings(settings, defaultAdminSettings, 'audit', 'review_deadline')).toEqual({
        email: false,
        inApp: false,
      });
    });
  });

  describe('system_announcements toggle', () => {
    it('should block system notifications when auditor disables system_announcements', () => {
      const settings = { ...auditorSettings, system_announcements: false };
      expect(repo.evaluateUserNotificationSettings(settings, defaultAdminSettings, 'system', 'announcement')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should block system notifications when reviewer disables system_announcements', () => {
      const settings = { ...reviewerSettings, system_announcements: false };
      expect(repo.evaluateUserNotificationSettings(settings, defaultAdminSettings, 'system', 'announcement')).toEqual({
        email: false,
        inApp: false,
      });
    });

    it('should allow system notifications when system_announcements is enabled', () => {
      expect(repo.evaluateUserNotificationSettings(auditorSettings, defaultAdminSettings, 'system', 'announcement')).toEqual({
        email: true,
        inApp: true,
      });
    });
  });
});

describe('NotificationRepository — DB methods', () => {
  let repo: NotificationRepository;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDb = { query: jest.fn() } as unknown as jest.Mocked<DatabaseService>;
    repo = new NotificationRepository(mockDb);
  });

  describe('getAdminSettings', () => {
    it('should return the singleton admin settings row', async () => {
      mockDb.query.mockResolvedValue({ rows: [defaultAdminSettings], rowCount: 1 } as any);

      const result = await repo.getAdminSettings();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('admin_notification_settings'),
      );
      expect(result).toEqual(defaultAdminSettings);
    });
  });

  describe('updateAdminSettings', () => {
    it('should build UPDATE query for provided fields', async () => {
      const updated = { ...defaultAdminSettings, email_enabled: false };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ email_enabled: false });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE admin_notification_settings'),
        expect.arrayContaining([false]),
      );
      expect(result.email_enabled).toBe(false);
    });

    it('should return current settings when no fields provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [defaultAdminSettings], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({});

      // When no fields, falls through to getAdminSettings
      expect(result).toEqual(defaultAdminSettings);
    });

    it('should handle reminder_frequency update', async () => {
      const updated = { ...defaultAdminSettings, reminder_frequency: 'weekly' };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ reminder_frequency: 'weekly' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('reminder_frequency'),
        expect.arrayContaining(['weekly']),
      );
      expect(result.reminder_frequency).toBe('weekly');
    });

    it('should update in_app_enabled to false', async () => {
      const updated = { ...defaultAdminSettings, in_app_enabled: false };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ in_app_enabled: false });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('in_app_enabled'),
        expect.arrayContaining([false]),
      );
      expect(result.in_app_enabled).toBe(false);
    });

    it('should update assessment_submissions_enabled to false', async () => {
      const updated = { ...defaultAdminSettings, assessment_submissions_enabled: false };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ assessment_submissions_enabled: false });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('assessment_submissions_enabled'),
        expect.arrayContaining([false]),
      );
      expect(result.assessment_submissions_enabled).toBe(false);
    });

    it('should update ai_flags_enabled to false', async () => {
      const updated = { ...defaultAdminSettings, ai_flags_enabled: false };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ ai_flags_enabled: false });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ai_flags_enabled'),
        expect.arrayContaining([false]),
      );
      expect(result.ai_flags_enabled).toBe(false);
    });

    it('should update audit_events_enabled to false', async () => {
      const updated = { ...defaultAdminSettings, audit_events_enabled: false };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ audit_events_enabled: false });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('audit_events_enabled'),
        expect.arrayContaining([false]),
      );
      expect(result.audit_events_enabled).toBe(false);
    });

    it('should update payment_events_enabled to false', async () => {
      const updated = { ...defaultAdminSettings, payment_events_enabled: false };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ payment_events_enabled: false });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('payment_events_enabled'),
        expect.arrayContaining([false]),
      );
      expect(result.payment_events_enabled).toBe(false);
    });

    it('should update certificate_events_enabled to false', async () => {
      const updated = { ...defaultAdminSettings, certificate_events_enabled: false };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ certificate_events_enabled: false });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('certificate_events_enabled'),
        expect.arrayContaining([false]),
      );
      expect(result.certificate_events_enabled).toBe(false);
    });

    it('should update multiple fields in a single call', async () => {
      const updated = { ...defaultAdminSettings, email_enabled: false, in_app_enabled: false, reminder_frequency: 'none' };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({
        email_enabled: false,
        in_app_enabled: false,
        reminder_frequency: 'none',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('email_enabled'),
        expect.arrayContaining([false, false, 'none']),
      );
      expect(result.email_enabled).toBe(false);
      expect(result.in_app_enabled).toBe(false);
      expect(result.reminder_frequency).toBe('none');
    });

    it('should update all category toggles at once', async () => {
      const updated = {
        ...defaultAdminSettings,
        assessment_submissions_enabled: false,
        ai_flags_enabled: false,
        audit_events_enabled: false,
        payment_events_enabled: false,
        certificate_events_enabled: false,
      };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({
        assessment_submissions_enabled: false,
        ai_flags_enabled: false,
        audit_events_enabled: false,
        payment_events_enabled: false,
        certificate_events_enabled: false,
      });

      expect(result.assessment_submissions_enabled).toBe(false);
      expect(result.ai_flags_enabled).toBe(false);
      expect(result.audit_events_enabled).toBe(false);
      expect(result.payment_events_enabled).toBe(false);
      expect(result.certificate_events_enabled).toBe(false);
    });

    it('should re-enable a previously disabled field', async () => {
      const updated = { ...defaultAdminSettings, email_enabled: true };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ email_enabled: true });

      expect(result.email_enabled).toBe(true);
    });

    it('should update reminder_frequency to none', async () => {
      const updated = { ...defaultAdminSettings, reminder_frequency: 'none' };
      mockDb.query.mockResolvedValue({ rows: [updated], rowCount: 1 } as any);

      const result = await repo.updateAdminSettings({ reminder_frequency: 'none' });

      expect(result.reminder_frequency).toBe('none');
    });
  });

  describe('getUserEmails', () => {
    it('should return empty map for empty input', async () => {
      const result = await repo.getUserEmails([]);
      expect(result).toEqual(new Map());
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return Map of userId → email', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'user-1', email: 'user1@example.com' },
          { id: 'user-2', email: 'user2@example.com' },
        ],
        rowCount: 2,
      } as any);

      const result = await repo.getUserEmails(['user-1', 'user-2']);

      expect(result.get('user-1')).toBe('user1@example.com');
      expect(result.get('user-2')).toBe('user2@example.com');
    });
  });

  describe('getNotificationSettingsBatch', () => {
    it('should return empty map for empty input', async () => {
      const result = await repo.getNotificationSettingsBatch([]);
      expect(result).toEqual(new Map());
    });

    it('should return Map of userId → settings', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ ...auditorSettings, user_id: 'user-1' }],
        rowCount: 1,
      } as any);

      const result = await repo.getNotificationSettingsBatch(['user-1']);

      expect(result.has('user-1')).toBe(true);
    });
  });
});
