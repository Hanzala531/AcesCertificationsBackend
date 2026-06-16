ALTER TABLE support_tickets
  ALTER COLUMN certificate_id DROP NOT NULL;

-- Normalize any legacy/inconsistent rows before enforcing target constraint.
UPDATE support_tickets
SET target_type = 'other',
    target_id = NULL
WHERE target_type = 'certificate'
  AND certificate_id IS NULL;

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_certificate_target_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_certificate_target_check CHECK (
    (target_type = 'certificate' AND certificate_id IS NOT NULL)
    OR (target_type <> 'certificate')
  );
