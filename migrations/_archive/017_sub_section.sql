
CREATE TABLE IF NOT EXISTS sub_section (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(100),
  main_id UUID NOT NULL REFERENCES main_section(id) ON DELETE CASCADE,
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_section_main_id ON sub_section(main_id);
CREATE INDEX IF NOT EXISTS idx_sub_section_certificate_id ON sub_section(certificate_id);
CREATE INDEX IF NOT EXISTS idx_sub_section_section_id ON sub_section(section_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_section_certificate_short_code ON sub_section(certificate_id, short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sub_section_created_at ON sub_section(created_at);

DROP TRIGGER IF EXISTS update_sub_section_updated_at ON sub_section;
CREATE TRIGGER update_sub_section_updated_at BEFORE UPDATE ON sub_section
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
