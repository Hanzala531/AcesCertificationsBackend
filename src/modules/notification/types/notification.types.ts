export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
  ACTION_REQUIRED = 'action_required',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface NotificationPayload {
  id?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  module?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface NotificationTarget {
  userIds?: string[];
  roles?: string[];
  broadcast?: boolean;
}

export interface NotificationRequest {
  payload: NotificationPayload;
  target: NotificationTarget;
}

export interface ConnectionInfo {
  socketId: string;
  userId: string;
  role: string;
  connectedAt: Date;
}

export interface AdminNotificationSettings {
  id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  assessment_submissions_enabled: boolean;
  ai_flags_enabled: boolean;
  audit_events_enabled: boolean;
  payment_events_enabled: boolean;
  certificate_events_enabled: boolean;
  reminder_frequency: string;
  created_at: Date;
  updated_at: Date;
}
