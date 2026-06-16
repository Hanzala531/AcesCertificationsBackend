-- Migration 041: Extend support_tickets for multi-target workflows
-- Adds polymorphic target fields, ownership/assignment metadata, and richer lifecycle states.

-- If this constraint exists from a partial/previous rollout, drop it before backfill.
ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_certificate_target_check;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(30) NOT NULL DEFAULT 'support',
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(30) NOT NULL DEFAULT 'certificate',
  ADD COLUMN IF NOT EXISTS target_id UUID NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL;

-- Backfill deterministic target context for legacy certificate-based tickets.
UPDATE support_tickets
SET target_type = CASE
      WHEN certificate_id IS NOT NULL THEN 'certificate'
      ELSE 'other'
    END,
    target_id = certificate_id
WHERE target_id IS NULL;

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_status_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check CHECK (
    status IN (
      'pending',
      'triaged',
      'assigned',
      'in-progress',
      'in_review',
      'awaiting_admin_decision',
      'resolved',
      'rejected',
      'completed',
      'closed'
    )
  );

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_ticket_type_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_ticket_type_check CHECK (
    ticket_type IN ('support', 'dispute', 'billing', 'technical', 'other')
  );

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_target_type_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_target_type_check CHECK (
    target_type IN ('certificate', 'assessment', 'payment', 'account', 'other')
  );

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_priority_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  );

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_target_consistency_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_target_consistency_check CHECK (
    (target_type = 'other' AND target_id IS NULL)
    OR (target_type <> 'other' AND target_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_support_tickets_target
  ON support_tickets(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to
  ON support_tickets(assigned_to);

CREATE INDEX IF NOT EXISTS idx_support_tickets_resolved_by
  ON support_tickets(resolved_by);

CREATE INDEX IF NOT EXISTS idx_support_tickets_priority
  ON support_tickets(priority);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_type
  ON support_tickets(ticket_type);

CREATE INDEX IF NOT EXISTS idx_support_tickets_metadata_gin
  ON support_tickets USING GIN (metadata);
