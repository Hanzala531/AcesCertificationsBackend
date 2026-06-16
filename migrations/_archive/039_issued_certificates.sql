CREATE SEQUENCE IF NOT EXISTS issued_certificate_number_seq START 1;

CREATE TABLE IF NOT EXISTS issued_certificates (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id      UUID         NOT NULL REFERENCES certificate_assessments(id) ON DELETE RESTRICT,
  certificate_id     UUID         NOT NULL REFERENCES certificates(id),
  certificate_name   VARCHAR(255) NOT NULL,
  organization_id    UUID         NOT NULL REFERENCES organization(id),
  branch_id          UUID         REFERENCES branches(id),
  badge_id           UUID         REFERENCES badges(id),
  badge_name         VARCHAR(255),
  badge_slot         INTEGER,
  certificate_number VARCHAR(100) NOT NULL,
  review_score       NUMERIC(5,2),
  issued_by          UUID         NOT NULL REFERENCES users(id),
  issued_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expiry_date        TIMESTAMPTZ,
  is_blocked         BOOLEAN      NOT NULL DEFAULT FALSE,
  block_reason       TEXT,
  blocked_by         UUID         REFERENCES users(id),
  blocked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_issued_cert_assessment UNIQUE (assessment_id),
  CONSTRAINT uq_issued_cert_number     UNIQUE (certificate_number)
);

CREATE INDEX IF NOT EXISTS idx_issued_certs_organization ON issued_certificates(organization_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_certificate  ON issued_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_badge        ON issued_certificates(badge_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_issued_at    ON issued_certificates(issued_at);
CREATE INDEX IF NOT EXISTS idx_issued_certs_is_blocked   ON issued_certificates(is_blocked);

DROP TRIGGER IF EXISTS update_issued_certificates_updated_at ON issued_certificates;
CREATE TRIGGER update_issued_certificates_updated_at
  BEFORE UPDATE ON issued_certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
