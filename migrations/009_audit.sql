-- ============================================================================
-- 009 — Audit & issuance: audits, ai_audit_scores, compliance_actions,
--       issued_certificates, unlocked_certificates
-- Folds: 037 (reviewer columns), 038 (archive/version + active-per-assessment
--        unique), 055/070 (audit_lifecycle_status), 057 (assigned auditor/reviewer),
--        050 (compliance_actions.clarification_target), 045 (issued org_badge_id),
--        046 (issued badge_color, drop badge_slot)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES certificate_assessments(id) ON DELETE CASCADE,
  certificate_id UUID NOT NULL REFERENCES certificates(id),
  audit_summary TEXT,
  audit_summary_doc TEXT,
  audit_description TEXT,
  status audit_status,
  score NUMERIC(5,2),
  -- 037: reviewer columns
  review_summary TEXT,
  review_summary_doc TEXT,
  review_description TEXT,
  review_status audit_status,
  review_score NUMERIC(5,2),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  -- 038: archive / versioning
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  -- 055/070: lifecycle
  audit_lifecycle_status audit_lifecycle_status DEFAULT 'in_progress',
  -- 057: assignment
  assigned_auditor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 038 replaced the original UNIQUE(assessment_id) with a partial unique on active rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_audits_active_per_assessment
  ON audits(assessment_id) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_audits_assessment_id ON audits(assessment_id);
CREATE INDEX IF NOT EXISTS idx_audits_certificate_id ON audits(certificate_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audits_lifecycle_status ON audits(audit_lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_audits_assigned_auditor ON audits(assigned_auditor_id);
CREATE INDEX IF NOT EXISTS idx_audits_assigned_reviewer ON audits(assigned_reviewer_id);

-- ── ai_audit_scores (044) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_audit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES certificate_assessments(id),
  audit_id UUID NOT NULL REFERENCES audits(id),
  ai_score NUMERIC(5,2) NOT NULL,
  ai_reasoning TEXT NOT NULL,
  prompt_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  model_used VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_scores_assessment ON ai_audit_scores(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_scores_audit ON ai_audit_scores(audit_id);

-- ── compliance_actions (036) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES certificate_assessments(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  action_type     compliance_action_type NOT NULL,
  message         TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_by_role VARCHAR(50) NOT NULL,
  chat_message_id UUID REFERENCES chat_messages(id),
  clarification_target VARCHAR(20) CHECK (clarification_target IN ('applicant', 'reviewer')),  -- 050
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_actions_assessment ON compliance_actions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_compliance_actions_assessment_question ON compliance_actions(assessment_id, question_id);

-- ── issued_certificates (039) ───────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS issued_certificate_number_seq START 1;

CREATE TABLE IF NOT EXISTS issued_certificates (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id      UUID         NOT NULL REFERENCES certificate_assessments(id) ON DELETE RESTRICT,
  certificate_id     UUID         NOT NULL REFERENCES certificates(id),
  certificate_name   VARCHAR(255) NOT NULL,
  organization_id    UUID         NOT NULL REFERENCES organization(id),
  branch_id          UUID         REFERENCES branches(id),
  badge_id           UUID         REFERENCES badges(id),
  badge_name         VARCHAR(255),
  org_badge_id       UUID         REFERENCES organization_badges(id) ON DELETE SET NULL,  -- 045
  badge_color        VARCHAR(50),                                                         -- 046
  certificate_number VARCHAR(100) NOT NULL,
  review_score       NUMERIC(5,2),
  issued_by          UUID         NOT NULL REFERENCES users(id),
  issued_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expiry_date        TIMESTAMPTZ,
  is_blocked         BOOLEAN      NOT NULL DEFAULT FALSE,
  block_reason       TEXT,
  blocked_by         UUID         REFERENCES users(id),
  blocked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_issued_cert_assessment UNIQUE (assessment_id),
  CONSTRAINT uq_issued_cert_number     UNIQUE (certificate_number)
);

CREATE INDEX IF NOT EXISTS idx_issued_certs_organization ON issued_certificates(organization_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_certificate  ON issued_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_badge        ON issued_certificates(badge_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_org_badge    ON issued_certificates(org_badge_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_issued_at    ON issued_certificates(issued_at);
CREATE INDEX IF NOT EXISTS idx_issued_certs_is_blocked   ON issued_certificates(is_blocked);

DROP TRIGGER IF EXISTS update_issued_certificates_updated_at ON issued_certificates;
CREATE TRIGGER update_issued_certificates_updated_at
  BEFORE UPDATE ON issued_certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── unlocked_certificates (072) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unlocked_certificates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organization(id) ON DELETE SET NULL,
  assessment_id  UUID REFERENCES certificate_assessments(id) ON DELETE SET NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unlocked_certificates_certificate_id ON unlocked_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_certificates_organization_id ON unlocked_certificates(organization_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_certificates_assessment_id ON unlocked_certificates(assessment_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_certificates_is_active ON unlocked_certificates(is_active);
