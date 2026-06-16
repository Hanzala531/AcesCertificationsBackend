
CREATE TABLE IF NOT EXISTS main_section (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  name VARCHAR(255),
  short_code VARCHAR(100),
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_main_section_certificate_id ON main_section(certificate_id);
CREATE INDEX IF NOT EXISTS idx_main_section_short_code ON main_section(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_main_section_created_at ON main_section(created_at);

DROP TRIGGER IF EXISTS update_main_section_updated_at ON main_section;
CREATE TRIGGER update_main_section_updated_at BEFORE UPDATE ON main_section
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
