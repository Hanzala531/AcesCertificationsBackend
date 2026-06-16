-- Tracks which organizations have unlocked (purchased/received access to) a certificate template
CREATE TABLE IF NOT EXISTS unlocked_certificates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organization(id) ON DELETE SET NULL,
  assessment_id  UUID REFERENCES certificate_assessments(id) ON DELETE SET NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unlocked_certificates_certificate_id
  ON unlocked_certificates(certificate_id);

CREATE INDEX IF NOT EXISTS idx_unlocked_certificates_organization_id
  ON unlocked_certificates(organization_id);

CREATE INDEX IF NOT EXISTS idx_unlocked_certificates_assessment_id
  ON unlocked_certificates(assessment_id);

CREATE INDEX IF NOT EXISTS idx_unlocked_certificates_is_active
  ON unlocked_certificates(is_active);
