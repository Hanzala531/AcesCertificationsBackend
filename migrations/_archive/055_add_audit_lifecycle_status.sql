BEGIN;

DO $$ BEGIN
    CREATE TYPE audit_lifecycle_status AS ENUM (
        'in_progress',
        'auditor_submitted',
        'reviewer_submitted',
        'completed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS audit_lifecycle_status audit_lifecycle_status DEFAULT 'in_progress';

CREATE INDEX IF NOT EXISTS idx_audits_lifecycle_status
  ON audits(audit_lifecycle_status);

COMMIT;
