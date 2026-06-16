
CREATE TABLE IF NOT EXISTS industry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_industry_name ON industry(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_industry_created_at ON industry(created_at);
CREATE INDEX IF NOT EXISTS idx_industry_created_by ON industry(created_by);
CREATE INDEX IF NOT EXISTS idx_industry_updated_by ON industry(updated_by);

DROP TRIGGER IF EXISTS update_industry_updated_at ON industry;
CREATE TRIGGER update_industry_updated_at BEFORE UPDATE ON industry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN industry.created_by IS 'User ID who created this industry record';
COMMENT ON COLUMN industry.updated_by IS 'User ID who last updated this industry record';
