BEGIN;

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS assigned_auditor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audits_assigned_auditor ON audits(assigned_auditor_id);
CREATE INDEX IF NOT EXISTS idx_audits_assigned_reviewer ON audits(assigned_reviewer_id);

-- Backfill from certificate_assessments
UPDATE audits a
SET assigned_auditor_id = ca.assigned_auditor_id,
    assigned_reviewer_id = ca.assigned_reviewer_id
FROM certificate_assessments ca
WHERE a.assessment_id = ca.id
  AND a.is_archived = FALSE;

COMMIT;
