-- Migration: Add fields for organization public profile
-- Adds is_verified and legal_registered_name to organization table

-- Add is_verified column (organization-level verification, NOT certificate-based)
ALTER TABLE organization
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Add legal_registered_name column (official/legal name)
ALTER TABLE organization
ADD COLUMN IF NOT EXISTS legal_registered_name VARCHAR(255);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_organization_is_verified ON organization(is_verified);

-- Add comments for clarity
COMMENT ON COLUMN organization.is_verified IS 'Organization-level verification status (NOT certificate-based)';
COMMENT ON COLUMN organization.legal_registered_name IS 'Official/legal registered name of the organization';

-- NOTE: total_employees is derived at query time by counting active employees
-- from the employee table (WHERE organization_id = ? AND status = ''active'')
-- This covers both org-level and branch-level employees since all employees
-- reference organization_id directly.
