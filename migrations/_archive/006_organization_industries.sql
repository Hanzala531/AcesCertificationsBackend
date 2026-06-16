
CREATE TABLE IF NOT EXISTS organization_industries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  industry_id UUID NOT NULL REFERENCES industry(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, industry_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_industries_org_id ON organization_industries(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_industries_industry_id ON organization_industries(industry_id);

COMMENT ON TABLE organization_industries IS 'Junction table for many-to-many relationship between organizations and industries. Organizations can have up to 5 industries.';
