-- Migration 076: replace question weightage with score-based evaluation
-- Idempotent and rollback-aware:
-- - existing weightage values are copied to a backup table before removal
-- - new score summary columns are added without overwriting existing data

BEGIN;

CREATE TABLE IF NOT EXISTS question_weightage_migration_backup (
  question_id UUID PRIMARY KEY,
  legacy_weightage INTEGER,
  backed_up_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO question_weightage_migration_backup (question_id, legacy_weightage)
SELECT q.id, q.weightage
FROM questions q
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'questions'
    AND column_name = 'weightage'
)
ON CONFLICT (question_id) DO NOTHING;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS score INTEGER,
  ADD COLUMN IF NOT EXISTS yes_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_score INTEGER DEFAULT 0;

UPDATE questions
SET score = LEAST(GREATEST(COALESCE(weightage, 0) * 10, 0), 999)
WHERE score IS NULL
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'questions'
      AND column_name = 'weightage'
  );

UPDATE questions
SET score = 0
WHERE score IS NULL;

ALTER TABLE questions
  ALTER COLUMN score SET NOT NULL,
  ALTER COLUMN score SET DEFAULT 0,
  ALTER COLUMN yes_score SET DEFAULT 0,
  ALTER COLUMN no_score SET DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_question_score_range'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_question_score_range
      CHECK (score BETWEEN 0 AND 999);
  END IF;
END $$;

ALTER TABLE ai_reviews
  ADD COLUMN IF NOT EXISTS earned_score NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS max_score NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS final_percentage NUMERIC(5,2);

ALTER TABLE certificate_assessments
  ADD COLUMN IF NOT EXISTS earned_score NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS max_score NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS final_percentage NUMERIC(5,2);

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS chk_question_weightage;

ALTER TABLE questions
  DROP COLUMN IF EXISTS weightage;

COMMENT ON COLUMN questions.score IS
  'Question score value (0-999). Used by the centralized score engine.';
COMMENT ON COLUMN questions.yes_score IS
  'Boolean question score awarded when the answer is yes.';
COMMENT ON COLUMN questions.no_score IS
  'Boolean question score awarded when the answer is no.';
COMMENT ON COLUMN ai_reviews.earned_score IS
  'Sum of earned question scores for the AI review run.';
COMMENT ON COLUMN ai_reviews.max_score IS
  'Sum of maximum question scores for the AI review run.';
COMMENT ON COLUMN ai_reviews.final_percentage IS
  'Final rounded percentage from earned_score / max_score * 100.';
COMMENT ON COLUMN certificate_assessments.earned_score IS
  'Persisted assessment earned score summary.';
COMMENT ON COLUMN certificate_assessments.max_score IS
  'Persisted assessment maximum score summary.';
COMMENT ON COLUMN certificate_assessments.final_percentage IS
  'Persisted assessment final percentage summary.';

COMMIT;
