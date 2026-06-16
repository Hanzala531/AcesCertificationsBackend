DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'audit_lifecycle_status'
  ) THEN
    CREATE TYPE audit_lifecycle_status AS ENUM (
      'in_progress',
      'auditor_submitted',
      'reviewer_submitted',
      'completed'
    );
  END IF;
END $$;

DO $$
DECLARE
  lifecycle_udt text;
BEGIN
  SELECT c.udt_name
  INTO lifecycle_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'audits'
    AND c.column_name = 'audit_lifecycle_status';

  IF lifecycle_udt IS NULL THEN
    ALTER TABLE audits
      ADD COLUMN audit_lifecycle_status audit_lifecycle_status DEFAULT 'in_progress';
  ELSIF lifecycle_udt <> 'audit_lifecycle_status' THEN
    ALTER TABLE audits
      ALTER COLUMN audit_lifecycle_status DROP DEFAULT;

    ALTER TABLE audits
      ALTER COLUMN audit_lifecycle_status
      TYPE audit_lifecycle_status
      USING (
        CASE
          WHEN audit_lifecycle_status::text IN (
            'in_progress',
            'auditor_submitted',
            'reviewer_submitted',
            'completed'
          ) THEN audit_lifecycle_status::text::audit_lifecycle_status
          WHEN audit_lifecycle_status::text = 'submitted' THEN 'auditor_submitted'::audit_lifecycle_status
          ELSE 'in_progress'::audit_lifecycle_status
        END
      );
  END IF;

  ALTER TABLE audits
    ALTER COLUMN audit_lifecycle_status
    SET DEFAULT 'in_progress'::audit_lifecycle_status;
END $$;

CREATE INDEX IF NOT EXISTS idx_audits_lifecycle_status
  ON audits(audit_lifecycle_status);