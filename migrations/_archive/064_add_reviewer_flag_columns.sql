-- Migration: Add reviewer flag review columns to ai_responses and ai_reviews
-- Supports the reviewer AI flag review workflow

-- Per-flag reviewer action on ai_responses
ALTER TABLE ai_responses
  ADD COLUMN IF NOT EXISTS reviewer_action VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ DEFAULT NULL;

-- Constraint: reviewer_action must be 'accepted' or 'rejected'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_reviewer_action'
      AND conrelid = 'ai_responses'::regclass
  ) THEN
    ALTER TABLE ai_responses
      ADD CONSTRAINT chk_reviewer_action
      CHECK (reviewer_action IS NULL OR reviewer_action IN ('accepted', 'rejected'));
  END IF;
END $$;

-- Index for finding unreviewed flagged responses
CREATE INDEX IF NOT EXISTS idx_ai_responses_reviewer_action
  ON ai_responses(ai_review_id, reviewer_action)
  WHERE is_flagged = TRUE;

-- Per-assessment reviewer submission on ai_reviews
ALTER TABLE ai_reviews
  ADD COLUMN IF NOT EXISTS reviewer_adjusted_score NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewer_submitted_by UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewer_submitted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for finding reviews assigned to reviewer but not yet submitted
CREATE INDEX IF NOT EXISTS idx_ai_reviews_reviewer_pending
  ON ai_reviews(is_reviewer_assigned, reviewer_submitted_at)
  WHERE is_reviewer_assigned = TRUE AND reviewer_submitted_at IS NULL;
