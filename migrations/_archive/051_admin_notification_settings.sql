BEGIN;

-- ============================================================
-- Admin notification settings (singleton row)
-- Controls global channel toggles + notification category toggles
-- ============================================================
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

-- Insert the singleton row (only once)
INSERT INTO admin_notification_settings DEFAULT VALUES;

DROP TRIGGER IF EXISTS update_admin_notification_settings_updated_at ON admin_notification_settings;
CREATE TRIGGER update_admin_notification_settings_updated_at
    BEFORE UPDATE ON admin_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE admin_notification_settings IS 'Singleton row — global notification channel and category settings controlled by admin';

-- ============================================================
-- Extend notification_settings with role-specific user toggles
-- ============================================================
ALTER TABLE notification_settings
    -- track which role the row belongs to (set at first login/settings creation)
    ADD COLUMN IF NOT EXISTS user_role                VARCHAR(50),

    -- Auditor-specific preferences
    ADD COLUMN IF NOT EXISTS new_audit_assigned        BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS audit_deadline_reminder   BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS review_submission_alerts  BOOLEAN NOT NULL DEFAULT TRUE,

    -- Reviewer-specific preferences
    ADD COLUMN IF NOT EXISTS new_review_assigned       BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS review_deadline_reminder  BOOLEAN NOT NULL DEFAULT TRUE,

    -- Shared (auditor + reviewer)
    ADD COLUMN IF NOT EXISTS system_announcements      BOOLEAN NOT NULL DEFAULT TRUE;

COMMIT;
