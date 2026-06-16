-- ============================================================================
-- 010 — Notifications: notification_settings, notifications,
--       admin_notification_settings
-- Folds: 051 (role-specific user toggles + admin singleton), 059 (action_status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    assessment_submissions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ai_flags_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    audit_scheduling_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    payment_events_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    certificate_events_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_frequency VARCHAR(50) DEFAULT 'daily',
    -- 051: role-specific user toggles
    user_role VARCHAR(50),
    new_audit_assigned BOOLEAN NOT NULL DEFAULT TRUE,
    audit_deadline_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    review_submission_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    new_review_assigned BOOLEAN NOT NULL DEFAULT TRUE,
    review_deadline_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    system_announcements BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_notification_settings_user_id UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organization(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    module notification_module NOT NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel notification_channel NOT NULL DEFAULT 'in_app',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    action_status VARCHAR(20) DEFAULT NULL,   -- 059
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_branch_id ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_module ON notifications(module);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── admin_notification_settings (051, singleton) ────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notification_settings (
    id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_enabled                   BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    assessment_submissions_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    ai_flags_enabled                BOOLEAN NOT NULL DEFAULT TRUE,
    audit_events_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    payment_events_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    certificate_events_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_frequency              VARCHAR(20) NOT NULL DEFAULT 'daily',
    created_at                      TIMESTAMPTZ DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the singleton row only if the table is empty (idempotent).
INSERT INTO admin_notification_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM admin_notification_settings);

DROP TRIGGER IF EXISTS update_admin_notification_settings_updated_at ON admin_notification_settings;
CREATE TRIGGER update_admin_notification_settings_updated_at
    BEFORE UPDATE ON admin_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
