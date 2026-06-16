-- Add support_ticket_id column to chat_threads for support ticket chat integration
-- Make assessment_id nullable (support ticket threads don't have an assessment)

ALTER TABLE chat_threads
  ALTER COLUMN assessment_id DROP NOT NULL;

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS support_ticket_id UUID NULL
  REFERENCES support_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_threads_support_ticket_id
  ON chat_threads(support_ticket_id)
  WHERE support_ticket_id IS NOT NULL;
