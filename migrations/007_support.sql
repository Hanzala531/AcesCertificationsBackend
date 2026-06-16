-- ============================================================================
-- 007 — Support tickets
-- Folds: 041 (multi-target workflow: ticket_type/target/priority/assignment +
--        status check expansion), 042 (certificate_id nullable + cert target check)
-- Defined before chat (008) because chat_threads.support_ticket_id references it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,   -- 042: nullable
  description TEXT NOT NULL,
  supporting_document TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ticket_type VARCHAR(30) NOT NULL DEFAULT 'support',         -- 041
  target_type VARCHAR(30) NOT NULL DEFAULT 'certificate',     -- 041
  target_id UUID NULL,                                        -- 041
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                -- 041
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',             -- 041
  assigned_to UUID NULL REFERENCES users(id) ON DELETE SET NULL,  -- 041
  resolved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,  -- 041
  resolved_at TIMESTAMPTZ NULL,                               -- 041
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT support_tickets_status_check CHECK (
    status IN (
      'pending', 'triaged', 'assigned', 'in-progress', 'in_review',
      'awaiting_admin_decision', 'resolved', 'rejected', 'completed', 'closed'
    )
  ),
  CONSTRAINT support_tickets_ticket_type_check CHECK (
    ticket_type IN ('support', 'dispute', 'billing', 'technical', 'other')
  ),
  CONSTRAINT support_tickets_target_type_check CHECK (
    target_type IN ('certificate', 'assessment', 'payment', 'account', 'other')
  ),
  CONSTRAINT support_tickets_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  ),
  CONSTRAINT support_tickets_target_consistency_check CHECK (
    (target_type = 'other' AND target_id IS NULL)
    OR (target_type <> 'other' AND target_id IS NOT NULL)
  ),
  CONSTRAINT support_tickets_certificate_target_check CHECK (
    (target_type = 'certificate' AND certificate_id IS NOT NULL)
    OR (target_type <> 'certificate')
  )
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_certificate_id ON support_tickets(certificate_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_target ON support_tickets(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_resolved_by ON support_tickets(resolved_by);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_type ON support_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_support_tickets_metadata_gin ON support_tickets USING GIN (metadata);

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
