
CREATE TABLE IF NOT EXISTS badge_colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  color VARCHAR(50) NOT NULL,
  min_score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_badge_color_scores CHECK (min_score <= max_score)
);

CREATE INDEX IF NOT EXISTS idx_badge_colors_badge_id ON badge_colors(badge_id);
