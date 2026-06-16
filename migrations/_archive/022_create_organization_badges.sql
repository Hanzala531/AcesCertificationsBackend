DO $$ BEGIN
    CREATE TYPE badge_tier AS ENUM (
        'bronze',
        'silver',
        'gold',
        'platinum'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS organization_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
    badge_name badge_tier NOT NULL,
    color VARCHAR(50) NOT NULL,
    assessed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    accessed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    score NUMERIC(5,2) NOT NULL,
    assessment_id UUID REFERENCES certificate_assessments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_organization_badge_scope CHECK (
        (organization_id IS NOT NULL AND branch_id IS NULL) OR
        (organization_id IS NOT NULL AND branch_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_organization_badges_organization_id ON organization_badges(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_badges_branch_id ON organization_badges(branch_id);
CREATE INDEX IF NOT EXISTS idx_organization_badges_certificate_id ON organization_badges(certificate_id);
CREATE INDEX IF NOT EXISTS idx_organization_badges_assessment_id ON organization_badges(assessment_id);
CREATE INDEX IF NOT EXISTS idx_organization_badges_badge_name ON organization_badges(badge_name);
CREATE INDEX IF NOT EXISTS idx_organization_badges_assessed_by ON organization_badges(assessed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_organization_badges_created_at ON organization_badges(created_at);

DROP TRIGGER IF EXISTS update_organization_badges_updated_at ON organization_badges;
CREATE TRIGGER update_organization_badges_updated_at BEFORE UPDATE ON organization_badges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE organization_badges IS 'Badges allocated to organizations and branches based on assessment scores';
COMMENT ON COLUMN organization_badges.badge_name IS 'Badge tier: bronze (default), silver (score > 90), gold (future), platinum (future)';
COMMENT ON COLUMN organization_badges.assessed_by_user_id IS 'User who triggered the assessment that resulted in this badge';
COMMENT ON COLUMN organization_badges.accessed_by_user_id IS 'Optional: user who viewed or verified this badge';
