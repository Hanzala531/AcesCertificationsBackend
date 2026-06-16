-- ============================================================================
-- 003 — Organization domain: industry, organization, organization_industries,
--       branches, employee
-- Folds: 030/031 (org email + unique indexes), 071 (org is_verified /
--        legal_registered_name), 066 (employee phone_number)
-- ============================================================================

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

-- ── organization ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_no VARCHAR(20),
  company_size VARCHAR(50),
  website VARCHAR(255),
  logo TEXT,
  industry_id UUID REFERENCES industry(id) ON DELETE SET NULL,
  total_branches INTEGER DEFAULT 0,
  organization_type VARCHAR(100),
  business_id VARCHAR(100) UNIQUE,
  legal_city VARCHAR(100),
  legal_state VARCHAR(100),
  legal_country VARCHAR(100),
  description TEXT,
  legal_document_url VARCHAR(255),
  email VARCHAR(255),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,        -- 071
  legal_registered_name VARCHAR(255),                -- 071
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_user_id ON organization(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_industry_id ON organization(industry_id);
CREATE INDEX IF NOT EXISTS idx_organization_created_at ON organization(created_at);
CREATE INDEX IF NOT EXISTS idx_organization_email ON organization(email);
CREATE INDEX IF NOT EXISTS idx_organization_contact_no ON organization(contact_no);
CREATE INDEX IF NOT EXISTS idx_organization_is_verified ON organization(is_verified);

-- Partial unique indexes: allow multiple NULLs while preventing duplicate non-null values
CREATE UNIQUE INDEX IF NOT EXISTS uk_organization_contact_no ON organization(contact_no) WHERE contact_no IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_organization_email ON organization(email) WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS update_organization_updated_at ON organization;
CREATE TRIGGER update_organization_updated_at BEFORE UPDATE ON organization
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── organization_industries (junction) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_industries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  industry_id UUID NOT NULL REFERENCES industry(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, industry_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_industries_org_id ON organization_industries(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_industries_industry_id ON organization_industries(industry_id);

-- ── branches ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  branch_size VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  contact_no VARCHAR(20),
  email VARCHAR(255),
  is_main BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_organization_id ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_created_at ON branches(created_at);
CREATE INDEX IF NOT EXISTS idx_branches_is_main ON branches(organization_id, is_main);

DROP TRIGGER IF EXISTS update_branches_updated_at ON branches;
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── employee ────────────────────────────────────────────────────────────────
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
  phone_number VARCHAR(20),                          -- 066
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
