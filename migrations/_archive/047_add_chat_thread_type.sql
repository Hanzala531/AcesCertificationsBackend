BEGIN;

-- Allow multiple chat threads per assessment (e.g. reviewer-private threads)
ALTER TABLE chat_threads
  DROP CONSTRAINT IF EXISTS unique_assessment_thread;

COMMIT;
