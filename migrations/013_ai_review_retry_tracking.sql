-- ============================================================================
-- 013 — AI review retry tracking
-- Adds durable retry bookkeeping to certificate_assessments so a scheduled job
-- can re-run AI reviews that failed. These columns live on the assessment (not
-- on ai_reviews) because the review row is deleted + recreated on every retry,
-- which would otherwise reset the counter.
--   - ai_review_attempts:        how many times the retry job has re-run this one
--   - ai_review_last_attempt_at: when the last retry ran (drives the cooldown)
-- ============================================================================

ALTER TABLE certificate_assessments
  ADD COLUMN IF NOT EXISTS ai_review_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE certificate_assessments
  ADD COLUMN IF NOT EXISTS ai_review_last_attempt_at TIMESTAMPTZ;

-- The retry sweep looks up failed reviews; this index keeps that lookup cheap.
CREATE INDEX IF NOT EXISTS idx_ai_reviews_failed
  ON ai_reviews(updated_at)
  WHERE review_status = 'failed';
