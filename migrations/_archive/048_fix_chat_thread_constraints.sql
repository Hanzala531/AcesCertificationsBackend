BEGIN;

-- Drop constraints that prevent multiple threads per assessment
ALTER TABLE chat_threads
  DROP CONSTRAINT IF EXISTS unique_assessment_thread;
ALTER TABLE chat_threads
  DROP CONSTRAINT IF EXISTS unique_assessment_thread_type;

-- Remove thread_type column added by mistake in 047
ALTER TABLE chat_threads
  DROP COLUMN IF EXISTS thread_type;

-- Drop the enum type if it exists
DROP TYPE IF EXISTS chat_thread_type;

COMMIT;
