-- Add support for nested sub-questions under boolean questions
-- parent_question_id: the boolean question this sub-question belongs to
-- parent_trigger_value: 'yes' or 'no' — which answer shows this sub-question

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS parent_question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_trigger_value VARCHAR(10) CHECK (parent_trigger_value IN ('yes', 'no'));

-- A sub-question must have both parent fields set or neither
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_nested_question_consistency'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT chk_nested_question_consistency CHECK (
        (parent_question_id IS NULL AND parent_trigger_value IS NULL) OR
        (parent_question_id IS NOT NULL AND parent_trigger_value IS NOT NULL)
      );
  END IF;
END $$;

-- Only boolean questions can be parents
-- (enforced at application layer)

CREATE INDEX IF NOT EXISTS idx_questions_parent_question_id ON questions(parent_question_id) WHERE parent_question_id IS NOT NULL;
