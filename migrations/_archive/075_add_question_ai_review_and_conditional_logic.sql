-- Question creation enhancements: AI review metadata, boolean scoring, and conditional logic

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS ai_review_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_review_criteria TEXT,
  ADD COLUMN IF NOT EXISTS ai_review_score INTEGER,
  ADD COLUMN IF NOT EXISTS yes_score INTEGER,
  ADD COLUMN IF NOT EXISTS no_score INTEGER,
  ADD COLUMN IF NOT EXISTS conditional_logic_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS conditional_logic JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_questions_ai_review_score_range'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_questions_ai_review_score_range
      CHECK (ai_review_score IS NULL OR (ai_review_score >= 0 AND ai_review_score <= 9999));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_questions_yes_score_range'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_questions_yes_score_range
      CHECK (yes_score IS NULL OR (yes_score >= 0 AND yes_score <= 9999));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_questions_no_score_range'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_questions_no_score_range
      CHECK (no_score IS NULL OR (no_score >= 0 AND no_score <= 9999));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_questions_ai_review_required_fields'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_questions_ai_review_required_fields
      CHECK (
        ai_review_enabled = FALSE
        OR (
          ai_review_criteria IS NOT NULL
          AND length(trim(ai_review_criteria)) > 0
          AND (type = 'boolean' OR ai_review_score IS NOT NULL)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_questions_conditional_logic_boolean_only'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_questions_conditional_logic_boolean_only
      CHECK (
        conditional_logic_enabled = FALSE
        OR (type = 'boolean' AND conditional_logic IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_ai_review_enabled
  ON questions(ai_review_enabled)
  WHERE ai_review_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_questions_conditional_logic_enabled
  ON questions(conditional_logic_enabled)
  WHERE conditional_logic_enabled = TRUE;

COMMENT ON COLUMN questions.ai_review_enabled IS 'Enables per-question AI review configuration';
COMMENT ON COLUMN questions.ai_review_criteria IS 'AI review evaluation rules used when ai_review_enabled is true';
COMMENT ON COLUMN questions.ai_review_score IS 'Configured AI review score for non-boolean questions, range 0-9999';
COMMENT ON COLUMN questions.yes_score IS 'Configured score for a yes answer on boolean questions, range 0-9999';
COMMENT ON COLUMN questions.no_score IS 'Configured score for a no answer on boolean questions, range 0-9999';
COMMENT ON COLUMN questions.conditional_logic_enabled IS 'Enables boolean-question conditional navigation and allow/block logic';
COMMENT ON COLUMN questions.conditional_logic IS 'JSON configuration for yes/no redirect, blocked, and allowed targets';
