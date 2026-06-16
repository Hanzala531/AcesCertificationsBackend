
ALTER TABLE issued_certificates
  ADD COLUMN IF NOT EXISTS org_badge_id UUID REFERENCES organization_badges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issued_certs_org_badge ON issued_certificates(org_badge_id);
