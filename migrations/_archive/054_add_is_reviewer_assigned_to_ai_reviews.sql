ALTER TABLE ai_reviews
  ADD COLUMN IF NOT EXISTS is_reviewer_assigned BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: set TRUE for ai_reviews where the linked assessment already has a reviewer
UPDATE ai_reviews ar
SET is_reviewer_assigned = TRUE
FROM certificate_assessments ca
WHERE ar.certificate_assessment_id = ca.id
  AND ca.assigned_reviewer_id IS NOT NULL;
