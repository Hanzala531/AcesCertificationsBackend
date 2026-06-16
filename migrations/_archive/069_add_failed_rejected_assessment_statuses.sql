-- Add 'failed' and 'rejected' values to the assessment_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'failed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'assessment_status')
  ) THEN
    ALTER TYPE assessment_status ADD VALUE 'failed';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'rejected'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'assessment_status')
  ) THEN
    ALTER TYPE assessment_status ADD VALUE 'rejected';
  END IF;
END$$;

-- Performance indexes for certification overview queries
CREATE INDEX IF NOT EXISTS idx_cert_assessments_status_type
  ON certificate_assessments(status, assessment_type);

CREATE INDEX IF NOT EXISTS idx_cert_assessments_org_branch_cert
  ON certificate_assessments(organization_id, branch_id, certificate_id);

CREATE INDEX IF NOT EXISTS idx_issued_certs_expiry
  ON issued_certificates(expiry_date);

CREATE INDEX IF NOT EXISTS idx_issued_certs_org_branch_cert
  ON issued_certificates(organization_id, branch_id, certificate_id);
