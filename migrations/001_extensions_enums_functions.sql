-- ============================================================================
-- 001 — Extensions, enum types, and shared functions
-- Consolidated baseline schema (fresh DB). All enum types are defined here with
-- their FINAL set of values (folding every later ALTER TYPE ... ADD VALUE).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- Shared trigger function: keep updated_at current on UPDATE.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Auth / users ────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE otp_purpose AS ENUM ('email_verification', 'login', 'password_reset');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_enum AS ENUM ('available', 'busy');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Payments / assessments ──────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('self_disclosure', 'assured');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending', 'completed', 'failed', 'refunded', 'disputed', 'partially_refunded'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- folds 049 (improvement_requested) and 069 (failed, rejected)
DO $$ BEGIN
    CREATE TYPE assessment_status AS ENUM (
        'in_progress', 'submitted', 'ai_reviewing', 'completed', 'expired',
        'improvement_requested', 'failed', 'rejected'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE assessment_type AS ENUM ('self_disclosure', 'assured');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- folds 062 (number, checkbox, multiple_choice, rating)
DO $$ BEGIN
    CREATE TYPE response_type AS ENUM (
        'pdf', 'boolean', 'text', 'number', 'checkbox', 'multiple_choice', 'rating'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ai_review_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ai_flag_status AS ENUM ('open', 'pending', 'escalated', 'resolved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Notifications ───────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('email', 'in_app', 'both');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- folds 043 (assessment-invitation, auditor) and 065 (support)
DO $$ BEGIN
    CREATE TYPE notification_module AS ENUM (
        'assessment', 'ai_review', 'audit', 'payment', 'certificate', 'system',
        'assessment-invitation', 'auditor', 'support'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Badges ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE badge_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Chat ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE chat_thread_status AS ENUM ('active', 'locked', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- folds 065 (admin)
DO $$ BEGIN
    CREATE TYPE chat_participant_role AS ENUM ('applicant', 'auditor', 'reviewer', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- final form (created in 050 after 047/048 churn); folds 065 (support_ticket)
DO $$ BEGIN
    CREATE TYPE chat_thread_type AS ENUM (
        'auditor_applicant', 'auditor_reviewer', 'reviewer_applicant', 'support_ticket'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Audit ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE audit_status AS ENUM ('approved', 'conditionally_approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE audit_lifecycle_status AS ENUM (
        'in_progress', 'auditor_submitted', 'reviewer_submitted', 'completed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE compliance_action_type AS ENUM ('non_compliant', 'request_clarification', 'compliant');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN null; END $$;
