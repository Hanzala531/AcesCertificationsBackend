BEGIN;

DO $$ BEGIN
  CREATE TYPE audit_status AS ENUM ('approved', 'conditionally_approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES certificate_assessments(id) ON DELETE CASCADE,
  certificate_id UUID NOT NULL REFERENCES certificates(id),
  audit_summary TEXT,
  audit_summary_doc TEXT,
  audit_description TEXT,
  status audit_status,
  score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audits_assessment_unique UNIQUE (assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_audits_assessment_id ON audits(assessment_id);
CREATE INDEX IF NOT EXISTS idx_audits_certificate_id ON audits(certificate_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status) WHERE status IS NOT NULL;

COMMIT;
