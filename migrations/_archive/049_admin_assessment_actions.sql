-- ============================================================================
-- Migration 049: Admin Assessment Actions (Improve & Resolve, Approve, Escalate)
-- ============================================================================

-- Add 'improvement_requested' to assessment_status enum
ALTER TYPE assessment_status ADD VALUE IF NOT EXISTS 'improvement_requested';

-- Admin approval columns on ai_reviews
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS is_admin_approved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS admin_approved_by UUID;
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ;
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS original_score NUMERIC(5,2);
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS adjusted_score NUMERIC(5,2);
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS admin_approval_reason TEXT;

-- Escalation columns on ai_reviews
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS escalated_by UUID;
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Improve-and-resolve columns on ai_reviews
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS improve_requested_by UUID;
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS improve_requested_at TIMESTAMPTZ;
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS improve_message TEXT;
