-- Employee table
-- Dependencies: users, organization, branches

CREATE TABLE IF NOT EXISTS employee (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  position VARCHAR(100),
  department VARCHAR(100),
  profile_picture VARCHAR(255),
  permissions JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT check_employee_status CHECK (status IN ('pending', 'active'))
);

CREATE INDEX IF NOT EXISTS idx_employee_user_id ON employee(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_organization_id ON employee(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_branch_id ON employee(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_created_at ON employee(created_at);

DROP TRIGGER IF EXISTS update_employee_updated_at ON employee;
CREATE TRIGGER update_employee_updated_at BEFORE UPDATE ON employee
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
