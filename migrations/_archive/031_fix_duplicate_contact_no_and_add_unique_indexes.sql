-- Migration: Deduplicate organization contact_no and email values before the unique indexes
-- defined in 005_organization.sql are enforced on existing data.
-- Safe no-op on a fresh database (no rows to clean up).

UPDATE organization o1
SET contact_no = NULL
WHERE contact_no IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization o2
    WHERE o2.contact_no = o1.contact_no
      AND o2.created_at < o1.created_at
  );

UPDATE organization o1
SET email = NULL
WHERE email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization o2
    WHERE o2.email = o1.email
      AND o2.created_at < o1.created_at
  );
