-- ============================================================================
-- 004 — Staff role profiles: auditor, reviewer, subadmin
-- Folds: 073 (auditor/reviewer signature)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auditor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_picture VARCHAR(255),
  country VARCHAR(100),
  state VARCHAR(100),
  city VARCHAR(100),
  assigned_certificates TEXT[] DEFAULT '{}',
  status status_enum DEFAULT 'available',
  accountStatus BOOLEAN DEFAULT TRUE,
  assigned_assessments_json JSONB DEFAULT '[]'::jsonb,
  signature VARCHAR(500),                            -- 073
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditor_user_id ON auditor(user_id);
CREATE INDEX IF NOT EXISTS idx_auditor_created_at ON auditor(created_at);
CREATE INDEX IF NOT EXISTS idx_auditor_country ON auditor(country);
CREATE INDEX IF NOT EXISTS idx_auditor_state ON auditor(state);
CREATE INDEX IF NOT EXISTS idx_auditor_city ON auditor(city);
CREATE INDEX IF NOT EXISTS idx_auditor_status ON auditor(status);
CREATE INDEX IF NOT EXISTS idx_auditor_account_status ON auditor(accountStatus);
CREATE INDEX IF NOT EXISTS idx_auditor_assigned_certificates ON auditor USING GIN(assigned_certificates);
CREATE INDEX IF NOT EXISTS idx_auditor_assigned_assessments_json ON auditor USING GIN(assigned_assessments_json);

DROP TRIGGER IF EXISTS update_auditor_updated_at ON auditor;
CREATE TRIGGER update_auditor_updated_at BEFORE UPDATE ON auditor
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── reviewer ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviewer (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_picture VARCHAR(255),
  tags TEXT[] DEFAULT '{}',
  accountStatus BOOLEAN DEFAULT TRUE,
  assigned_assessments_json JSONB DEFAULT '[]'::jsonb,
  signature VARCHAR(500),                            -- 073
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

-- ── subadmin ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subadmin (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_picture VARCHAR(255),
  accountStatus BOOLEAN DEFAULT TRUE,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subadmin_user_id ON subadmin(user_id);
CREATE INDEX IF NOT EXISTS idx_subadmin_created_at ON subadmin(created_at);
CREATE INDEX IF NOT EXISTS idx_subadmin_account_status
  ON subadmin(accountStatus) WHERE accountStatus IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subadmin_permissions
  ON subadmin USING GIN (permissions);

DROP TRIGGER IF EXISTS update_subadmin_updated_at ON subadmin;
CREATE TRIGGER update_subadmin_updated_at BEFORE UPDATE ON subadmin
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
