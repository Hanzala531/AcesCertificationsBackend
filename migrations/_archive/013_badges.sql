
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50),
  score INTEGER,
  slot INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_badge_slot CHECK (slot BETWEEN 1 AND 3),
  CONSTRAINT uq_certificate_badge_slot UNIQUE(certificate_id, slot),
  CONSTRAINT uq_certificate_badge_name UNIQUE(certificate_id, name)
);

CREATE INDEX IF NOT EXISTS idx_badges_certificate_id ON badges(certificate_id);
CREATE INDEX IF NOT EXISTS idx_badges_created_at ON badges(created_at);

DROP TRIGGER IF EXISTS update_badges_updated_at ON badges;
CREATE TRIGGER update_badges_updated_at BEFORE UPDATE ON badges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
