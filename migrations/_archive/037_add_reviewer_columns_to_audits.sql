ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS review_summary     TEXT,
  ADD COLUMN IF NOT EXISTS review_summary_doc TEXT,
  ADD COLUMN IF NOT EXISTS review_description TEXT,
  ADD COLUMN IF NOT EXISTS review_status      audit_status,
  ADD COLUMN IF NOT EXISTS review_score       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS reviewed_by        UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at        TIMESTAMPTZ;
