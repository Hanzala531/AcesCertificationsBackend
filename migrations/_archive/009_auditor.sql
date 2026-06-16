
DO $$ BEGIN
    CREATE TYPE status_enum AS ENUM (
        'available',
        'busy'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
