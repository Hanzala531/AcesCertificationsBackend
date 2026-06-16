BEGIN;

-- Add weightage column to questions table (1-100, default 1 = equal weighting)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS weightage INTEGER NOT NULL DEFAULT 1;

-- Enforce valid range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_question_weightage'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions ADD CONSTRAINT chk_question_weightage
      CHECK (weightage >= 1 AND weightage <= 100);
  END IF;
END $$;

COMMENT ON COLUMN questions.weightage IS
  'Question importance weight (1-100). Higher values make this question count more toward the final score. Default 1 means equal weighting.';

COMMIT;
