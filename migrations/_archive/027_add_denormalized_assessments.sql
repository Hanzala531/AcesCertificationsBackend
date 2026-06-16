-- Migration: Populate denormalized assessment fields in auditor and reviewer tables.
-- Columns are defined in 009_auditor.sql and 010_reviewer.sql.
-- These UPDATE statements back-fill existing rows for deployments that already have data.

-- Populate auditor.assigned_assessments_json from existing assignments
UPDATE auditor a
SET assigned_assessments_json = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'assessment_id', ca.id,
        'organization_id', ca.organization_id,
        'certificate_id', ca.certificate_id,
        'status', ca.status,
        'audit_date', ca.audit_date,
        'created_at', ca.created_at
      )
    )
    FROM certificate_assessments ca
    WHERE ca.assigned_auditor_id = a.id
      AND ca.assigned_auditor_id IS NOT NULL
  ),
  '[]'::jsonb
);

-- Populate reviewer.assigned_assessments_json from existing assignments
UPDATE reviewer r
SET assigned_assessments_json = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'assessment_id', ca.id,
        'organization_id', ca.organization_id,
        'certificate_id', ca.certificate_id,
        'status', ca.status,
        'created_at', ca.created_at
      )
    )
    FROM certificate_assessments ca
    WHERE ca.assigned_reviewer_id = r.id
      AND ca.assigned_reviewer_id IS NOT NULL
  ),
  '[]'::jsonb
);
