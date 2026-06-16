BEGIN;

-- Backfill audit_lifecycle_status based on current audit state

-- Audits with issued certificates → completed
UPDATE audits a
SET audit_lifecycle_status = 'completed'::audit_lifecycle_status
WHERE a.is_archived = FALSE
  AND EXISTS (
    SELECT 1 FROM issued_certificates ic
    WHERE ic.assessment_id = a.assessment_id
      AND ic.is_blocked = FALSE
  );

-- Reviewer has submitted → reviewer_submitted (no issued certificate)
UPDATE audits
SET audit_lifecycle_status = 'reviewer_submitted'::audit_lifecycle_status
WHERE is_archived = FALSE
  AND review_status IS NOT NULL
  AND audit_lifecycle_status != 'completed';

-- Auditor has submitted → auditor_submitted (no reviewer submission)
UPDATE audits
SET audit_lifecycle_status = 'auditor_submitted'::audit_lifecycle_status
WHERE is_archived = FALSE
  AND status IS NOT NULL
  AND review_status IS NULL
  AND audit_lifecycle_status = 'in_progress';

COMMIT;
