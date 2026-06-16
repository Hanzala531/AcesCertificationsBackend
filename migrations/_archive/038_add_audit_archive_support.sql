ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS version     INTEGER NOT NULL DEFAULT 1;

ALTER TABLE audits DROP CONSTRAINT IF EXISTS audits_assessment_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_audits_active_per_assessment
  ON audits(assessment_id) WHERE is_archived = FALSE;
