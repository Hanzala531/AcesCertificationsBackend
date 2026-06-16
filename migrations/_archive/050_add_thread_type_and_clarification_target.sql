BEGIN;

-- 1. chat_thread_type enum
DO $$ BEGIN
  CREATE TYPE chat_thread_type AS ENUM (
    'auditor_applicant',   -- Auditor <-> Applicant (main shared thread)
    'auditor_reviewer',    -- Auditor <-> Reviewer (private, no applicant)
    'reviewer_applicant'   -- Reviewer <-> Applicant (private, no auditor)
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Add thread_type column (nullable first so backfill can run)
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS thread_type chat_thread_type;

-- 3. Backfill existing threads based on participant roles
UPDATE chat_threads ct
SET thread_type = CASE
  WHEN EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.thread_id = ct.id AND cp.role = 'auditor'
  ) THEN 'auditor_applicant'::chat_thread_type
  ELSE 'reviewer_applicant'::chat_thread_type
END
WHERE thread_type IS NULL;

-- 4. Enforce NOT NULL
ALTER TABLE chat_threads ALTER COLUMN thread_type SET NOT NULL;

-- 5. Add question_id column (nullable — only compliance-action threads use it)
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES questions(id);

-- 6. Unique constraint: one thread per (assessment, type, question)
--    Partial index for threads WITH question_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_thread_assessment_type_question
  ON chat_threads (assessment_id, thread_type, question_id)
  WHERE question_id IS NOT NULL;

-- Partial index for threads WITHOUT question_id (legacy / non-clarification)
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_thread_assessment_type_no_question
  ON chat_threads (assessment_id, thread_type)
  WHERE question_id IS NULL AND support_ticket_id IS NULL;

-- 7. Index for looking up threads by question
CREATE INDEX IF NOT EXISTS idx_chat_threads_question_id
  ON chat_threads (question_id)
  WHERE question_id IS NOT NULL;

-- 8. Add clarification_target to compliance_actions
ALTER TABLE compliance_actions
  ADD COLUMN IF NOT EXISTS clarification_target VARCHAR(20)
  CHECK (clarification_target IN ('applicant', 'reviewer'));

COMMIT;
