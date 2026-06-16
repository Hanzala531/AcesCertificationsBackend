
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
  ON subadmin(accountStatus) 
  WHERE accountStatus IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subadmin_permissions 
  ON subadmin USING GIN (permissions);

DROP TRIGGER IF EXISTS update_subadmin_updated_at ON subadmin;
CREATE TRIGGER update_subadmin_updated_at BEFORE UPDATE ON subadmin
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
