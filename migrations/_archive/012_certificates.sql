
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id VARCHAR(100) NOT NULL UNIQUE,
  short_code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  industry_ids UUID[],
  disclosure_price NUMERIC(12,2) NOT NULL,
  assured_price NUMERIC(12,2),
  validity_days INTEGER DEFAULT 0,
  validity_months INTEGER DEFAULT 0,
  validity_years INTEGER DEFAULT 0,
  compulsory_docs TEXT[],
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_certificate_id ON certificates(certificate_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_short_code ON certificates(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON certificates(created_at);
CREATE INDEX IF NOT EXISTS idx_certificates_is_published ON certificates(is_published);
CREATE INDEX IF NOT EXISTS idx_certificates_created_by ON certificates(created_by);
CREATE INDEX IF NOT EXISTS idx_certificates_updated_by ON certificates(updated_by);

DROP TRIGGER IF EXISTS update_certificates_updated_at ON certificates;
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN certificates.created_by IS 'User ID who created this certificate record';
COMMENT ON COLUMN certificates.updated_by IS 'User ID who last updated this certificate record';
