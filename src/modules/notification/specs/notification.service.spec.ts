import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../services/notification.service';
import { NotificationGateway } from '../websocket/notification.gateway';
import { NotificationRepository } from '../notification.repository';
import { NotificationEmailService } from '../services/notification-email.service';
import { NotificationType } from '../types/notification.types';

const mockAdminSettings = {
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

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: jest.Mocked<NotificationRepository>;
  let notificationGateway: jest.Mocked<NotificationGateway>;
  let notificationEmailService: jest.Mocked<NotificationEmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NotificationGateway,
          useValue: {
            broadcast: jest.fn().mockResolvedValue(undefined),
            sendToRoles: jest.fn().mockResolvedValue(undefined),
            sendToUser: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationRepository,
          useValue: {
            getAdminSettings: jest.fn(),
            getNotificationSettingsBatch: jest.fn(),
            evaluateUserNotificationSettings: jest.fn(),
            createNotificationsBatch: jest.fn(),
            getUserEmails: jest.fn(),
          },
        },
        {
          provide: NotificationEmailService,
          useValue: {
            sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get(NotificationRepository);
    notificationGateway = module.get(NotificationGateway);
    notificationEmailService = module.get(NotificationEmailService);

    jest.clearAllMocks();
  });

  const auditPayload = {
    type: NotificationType.ACTION_REQUIRED,
    title: 'New Audit Assigned',
    message: 'You have been assigned a new audit',
    module: 'audit',
  };

  describe('notifyUser — handleUserNotification', () => {
    it('should send in-app notification and trigger email when both channels enabled', async () => {
      notificationRepo.getAdminSettings.mockResolvedValue(mockAdminSettings);
      notificationRepo.evaluateUserNotificationSettings
        .mockReturnValueOnce({ email: true, inApp: true }) // admin short-circuit check
        .mockReturnValueOnce({ email: true, inApp: true }); // per-user evaluation
      notificationRepo.getNotificationSettingsBatch.mockResolvedValue(new Map());
      notificationRepo.createNotificationsBatch.mockResolvedValue([
        { id: 'notif-1', user_id: 'user-1' } as any,
      ]);
      notificationRepo.getUserEmails.mockResolvedValue(
        new Map([['user-1', 'user@example.com']]),
      );

      await service.notifyUser('user-1', auditPayload);

      expect(notificationRepo.createNotificationsBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 'user-1', module: 'audit' }),
        ]),
      );
      expect(notificationGateway.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'notif-1' }),
      );
      expect(notificationEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({ title: 'New Audit Assigned' }),
      );
    });

    it('should short-circuit when admin has disabled the category (both channels false)', async () => {
      notificationRepo.getAdminSettings.mockResolvedValue(mockAdminSettings);
      // Admin short-circuit: both email and inApp false
      notificationRepo.evaluateUserNotificationSettings.mockReturnValue({
        email: false,
        inApp: false,
      });

      await service.notifyUser('user-1', auditPayload);

      expect(notificationRepo.getNotificationSettingsBatch).not.toHaveBeenCalled();
      expect(notificationRepo.createNotificationsBatch).not.toHaveBeenCalled();
      expect(notificationGateway.sendToUser).not.toHaveBeenCalled();
      expect(notificationEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('should not send email when admin disables email channel', async () => {
      const adminNoEmail = { ...mockAdminSettings, email_enabled: false };
      notificationRepo.getAdminSettings.mockResolvedValue(adminNoEmail);
      notificationRepo.evaluateUserNotificationSettings
        .mockReturnValueOnce({ email: false, inApp: true }) // admin short-circuit: not fully blocked
        .mockReturnValueOnce({ email: false, inApp: true }); // per-user
      notificationRepo.getNotificationSettingsBatch.mockResolvedValue(new Map());
      notificationRepo.createNotificationsBatch.mockResolvedValue([
        { id: 'notif-1', user_id: 'user-1' } as any,
      ]);

      await service.notifyUser('user-1', auditPayload);

      expect(notificationRepo.createNotificationsBatch).toHaveBeenCalled();
      expect(notificationGateway.sendToUser).toHaveBeenCalled();
      expect(notificationEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('should not send in-app when admin disables in-app channel', async () => {
      const adminNoInApp = { ...mockAdminSettings, in_app_enabled: false };
      notificationRepo.getAdminSettings.mockResolvedValue(adminNoInApp);
      notificationRepo.evaluateUserNotificationSettings
        .mockReturnValueOnce({ email: true, inApp: false }) // admin short-circuit: not fully blocked
        .mockReturnValueOnce({ email: true, inApp: false }); // per-user
      notificationRepo.getNotificationSettingsBatch.mockResolvedValue(new Map());
      notificationRepo.getUserEmails.mockResolvedValue(
        new Map([['user-1', 'user@example.com']]),
      );

      await service.notifyUser('user-1', auditPayload);

      expect(notificationRepo.createNotificationsBatch).not.toHaveBeenCalled();
      expect(notificationGateway.sendToUser).not.toHaveBeenCalled();
      expect(notificationEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(Object),
      );
    });

    it('should exclude users whose per-user evaluation returns false for both channels', async () => {
      notificationRepo.getAdminSettings.mockResolvedValue(mockAdminSettings);
      notificationRepo.evaluateUserNotificationSettings
        .mockReturnValueOnce({ email: true, inApp: true }) // admin short-circuit: pass
        .mockReturnValueOnce({ email: false, inApp: false }); // user-1 blocked by user settings
      notificationRepo.getNotificationSettingsBatch.mockResolvedValue(new Map());

      await service.notifyUser('user-1', auditPayload);

      expect(notificationRepo.createNotificationsBatch).not.toHaveBeenCalled();
      expect(notificationEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('should handle multiple users and send to each eligible one', async () => {
      notificationRepo.getAdminSettings.mockResolvedValue(mockAdminSettings);
      notificationRepo.evaluateUserNotificationSettings
        .mockReturnValueOnce({ email: true, inApp: true }) // admin check
        .mockReturnValueOnce({ email: true, inApp: true }) // user-1
        .mockReturnValueOnce({ email: false, inApp: false }); // user-2 blocked
      notificationRepo.getNotificationSettingsBatch.mockResolvedValue(new Map());
      notificationRepo.createNotificationsBatch.mockResolvedValue([
        { id: 'notif-1', user_id: 'user-1' } as any,
      ]);
      notificationRepo.getUserEmails.mockResolvedValue(
        new Map([['user-1', 'user1@example.com']]),
      );

      await service.notifyUsers(['user-1', 'user-2'], auditPayload);

      // Only user-1 should get in-app and email
      expect(notificationGateway.sendToUser).toHaveBeenCalledTimes(1);
      expect(notificationGateway.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object),
      );
    });

    it('should deduplicate duplicate userIds before processing', async () => {
      notificationRepo.getAdminSettings.mockResolvedValue(mockAdminSettings);
      notificationRepo.evaluateUserNotificationSettings
        .mockReturnValueOnce({ email: true, inApp: true })
        .mockReturnValueOnce({ email: true, inApp: true });
      notificationRepo.getNotificationSettingsBatch.mockResolvedValue(new Map());
      notificationRepo.createNotificationsBatch.mockResolvedValue([
        { id: 'notif-1', user_id: 'user-1' } as any,
      ]);
      notificationRepo.getUserEmails.mockResolvedValue(
        new Map([['user-1', 'user@example.com']]),
      );

      // Pass the same userId twice
      await service.notifyUsers(['user-1', 'user-1'], auditPayload);

      // getNotificationSettingsBatch should only be called with one unique userId
      expect(notificationRepo.getNotificationSettingsBatch).toHaveBeenCalledWith(['user-1']);
    });
  });

  describe('broadcast', () => {
    it('should call notificationGateway.broadcast', async () => {
      await service.broadcast({
        type: NotificationType.INFO,
        title: 'Maintenance',
        message: 'Scheduled maintenance tonight',
        module: 'system',
      });

      expect(notificationGateway.broadcast).toHaveBeenCalled();
      expect(notificationRepo.getAdminSettings).not.toHaveBeenCalled();
    });
  });

  describe('notifyRole', () => {
    it('should call notificationGateway.sendToRoles with a single-element array', async () => {
      await service.notifyRole('admin', {
        type: NotificationType.INFO,
        title: 'Alert',
        message: 'Admin alert',
        module: 'system',
      });

      expect(notificationGateway.sendToRoles).toHaveBeenCalledWith(
        ['admin'],
        expect.any(Object),
      );
    });
  });

  describe('notifyRoles', () => {
    it('should call notificationGateway.sendToRoles with multiple roles', async () => {
      await service.notifyRoles(['admin', 'subadmin'], {
        type: NotificationType.INFO,
        title: 'Alert',
        message: 'Multi-role alert',
        module: 'system',
      });

      expect(notificationGateway.sendToRoles).toHaveBeenCalledWith(
        ['admin', 'subadmin'],
        expect.any(Object),
      );
    });
  });
});
