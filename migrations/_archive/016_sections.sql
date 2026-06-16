
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  main_id UUID NOT NULL REFERENCES main_section(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(100),
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sections_certificate_id ON sections(certificate_id);
CREATE INDEX IF NOT EXISTS idx_sections_main_id ON sections(main_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sections_certificate_short_code ON sections(certificate_id, short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sections_created_at ON sections(created_at);

DROP TRIGGER IF EXISTS update_sections_updated_at ON sections;
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
