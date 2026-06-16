
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_user_id ON organization(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_industry_id ON organization(industry_id);
CREATE INDEX IF NOT EXISTS idx_organization_created_at ON organization(created_at);
CREATE INDEX IF NOT EXISTS idx_organization_email ON organization(email);
CREATE INDEX IF NOT EXISTS idx_organization_contact_no ON organization(contact_no);

-- Partial unique indexes: allow multiple NULLs while preventing duplicate non-null values
CREATE UNIQUE INDEX IF NOT EXISTS uk_organization_contact_no ON organization(contact_no) WHERE contact_no IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_organization_email ON organization(email) WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS update_organization_updated_at ON organization;
CREATE TRIGGER update_organization_updated_at BEFORE UPDATE ON organization
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
