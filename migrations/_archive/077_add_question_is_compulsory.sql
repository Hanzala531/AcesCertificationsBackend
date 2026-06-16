-- Adds a real is_compulsory flag to questions.
-- Previously the assessment read query hardcoded "FALSE as is_compulsory", so the
-- compulsory concept existed in the API contract but could never be set or enforced.
-- Defaults to FALSE so existing questions keep their current (non-compulsory) behavior.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS is_compulsory BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN questions.is_compulsory IS
  'TRUE = the applicant must answer this question; it cannot be skipped. Enforced on assessment submit.';
