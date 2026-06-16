CREATE TABLE IF NOT EXISTS reviewer (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_picture VARCHAR(255),
  tags TEXT[] DEFAULT '{}',
  accountStatus BOOLEAN DEFAULT TRUE,
  assigned_assessments_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviewer_user_id ON reviewer(user_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_created_at ON reviewer(created_at);
CREATE INDEX IF NOT EXISTS idx_reviewer_tags ON reviewer USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_reviewer_account_status ON reviewer(accountStatus);
CREATE INDEX IF NOT EXISTS idx_reviewer_assigned_assessments_json ON reviewer USING GIN(assigned_assessments_json);

DROP TRIGGER IF EXISTS update_reviewer_updated_at ON reviewer;
CREATE TRIGGER update_reviewer_updated_at BEFORE UPDATE ON reviewer
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
