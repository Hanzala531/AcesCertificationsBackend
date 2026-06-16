-- ============================================================================
-- 006 — Assessments & scoring: payments, payment_methods, certificate_assessments,
--       assessment_queries, ai_reviews, ai_responses, organization_badges,
--       assessment_invitations
-- Folds: 024/025/028/029 (assessment cols — inline), 076 (earned/max/final scores),
--        053 (response_files), 078 (assessment_queries question FK → RESTRICT),
--        049 (admin/escalate/improve on ai_reviews), 054 (is_reviewer_assigned),
--        064 (reviewer flag cols on ai_reviews + ai_responses), 052 (is_question_approved)
-- ============================================================================

-- ── payments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    payment_type payment_type NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status payment_status DEFAULT 'pending',
    is_paid BOOLEAN DEFAULT FALSE,
    transaction_id VARCHAR(255),
    payment_method VARCHAR(50),
    paid_at TIMESTAMPTZ,
    stripe_payment_intent_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_certificate_id ON payments(certificate_id);
CREATE INDEX IF NOT EXISTS idx_payments_is_paid ON payments(is_paid);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_customer_id ON payments(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── payment_methods ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  billing_details JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_organization_id ON payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_payment_method_id ON payment_methods(stripe_payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer_id ON payment_methods(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_organization_default ON payment_methods(organization_id, is_default) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── certificate_assessments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificate_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    assessment_type assessment_type NOT NULL,
    badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
    score NUMERIC(5,2),
    is_submitted BOOLEAN DEFAULT FALSE,
    status assessment_status DEFAULT 'in_progress',
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    assigned_auditor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    audit_date TIMESTAMPTZ,
    review_date TIMESTAMPTZ,
    is_certificate_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    certificate_block_reason TEXT,
    earned_score NUMERIC(10,2),        -- 076
    max_score NUMERIC(10,2),           -- 076
    final_percentage NUMERIC(5,2),     -- 076
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificate_assessments_organization_id ON certificate_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_branch_id ON certificate_assessments(branch_id);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_certificate_id ON certificate_assessments(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_payment_id ON certificate_assessments(payment_id);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_status ON certificate_assessments(status);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_is_submitted ON certificate_assessments(is_submitted);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_created_at ON certificate_assessments(created_at);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_assigned_auditor ON certificate_assessments(assigned_auditor_id);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_assigned_reviewer ON certificate_assessments(assigned_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_audit_date ON certificate_assessments(audit_date);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_review_date ON certificate_assessments(review_date);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_auditor_review_date ON certificate_assessments(assigned_auditor_id, review_date);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_assigned_by ON certificate_assessments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_certificate_assessments_is_certificate_blocked ON certificate_assessments(is_certificate_blocked);

DROP TRIGGER IF EXISTS update_certificate_assessments_updated_at ON certificate_assessments;
CREATE TRIGGER update_certificate_assessments_updated_at BEFORE UPDATE ON certificate_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── assessment_queries ──────────────────────────────────────────────────────
-- NOTE: question_id uses ON DELETE RESTRICT (078) so answered questions cannot be
-- deleted out from under assessment history.
CREATE TABLE IF NOT EXISTS assessment_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_assessment_id UUID NOT NULL REFERENCES certificate_assessments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    response_type response_type NOT NULL,
    response_value TEXT,
    response_files JSONB DEFAULT NULL,   -- 053
    reviewer_notes TEXT,
    auditor_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_queries_unique
    ON assessment_queries(certificate_assessment_id, question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_queries_certificate_assessment_id ON assessment_queries(certificate_assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_queries_question_id ON assessment_queries(question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_queries_created_at ON assessment_queries(created_at);

DROP TRIGGER IF EXISTS update_assessment_queries_updated_at ON assessment_queries;
CREATE TRIGGER update_assessment_queries_updated_at BEFORE UPDATE ON assessment_queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── ai_reviews ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_assessment_id UUID NOT NULL REFERENCES certificate_assessments(id) ON DELETE CASCADE,
    review_description TEXT,
    review_status ai_review_status DEFAULT 'pending',
    total_flags INTEGER DEFAULT 0,
    flag_status ai_flag_status DEFAULT 'open',
    score NUMERIC(5,2),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- 049: admin approval
    is_admin_approved BOOLEAN NOT NULL DEFAULT FALSE,
    admin_approved_by UUID,
    admin_approved_at TIMESTAMPTZ,
    original_score NUMERIC(5,2),
    adjusted_score NUMERIC(5,2),
    admin_approval_reason TEXT,
    -- 049: escalation
    escalated_by UUID,
    escalated_at TIMESTAMPTZ,
    escalation_reason TEXT,
    -- 049: improve-and-resolve
    improve_requested_by UUID,
    improve_requested_at TIMESTAMPTZ,
    improve_message TEXT,
    -- 054: reviewer assignment
    is_reviewer_assigned BOOLEAN NOT NULL DEFAULT FALSE,
    -- 064: reviewer submission
    reviewer_adjusted_score NUMERIC(5,2),
    reviewer_submitted_by UUID,
    reviewer_submitted_at TIMESTAMPTZ,
    -- 076: score summary
    earned_score NUMERIC(10,2),
    max_score NUMERIC(10,2),
    final_percentage NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_reviews_assessment_unique ON ai_reviews(certificate_assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_certificate_assessment_id ON ai_reviews(certificate_assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_status ON ai_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_created_at ON ai_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_flag_status ON ai_reviews(flag_status);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_reviewer_pending
  ON ai_reviews(is_reviewer_assigned, reviewer_submitted_at)
  WHERE is_reviewer_assigned = TRUE AND reviewer_submitted_at IS NULL;

DROP TRIGGER IF EXISTS update_ai_reviews_updated_at ON ai_reviews;
CREATE TRIGGER update_ai_reviews_updated_at BEFORE UPDATE ON ai_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── ai_responses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_query_id UUID NOT NULL REFERENCES assessment_queries(id) ON DELETE CASCADE,
    ai_review_id UUID NOT NULL REFERENCES ai_reviews(id) ON DELETE CASCADE,
    response TEXT,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    confidence_score NUMERIC(5,2),
    risk_level VARCHAR(20),
    category VARCHAR(100),
    summary TEXT,
    ai_suggestion TEXT,
    applicant_answer TEXT,
    is_question_approved BOOLEAN NOT NULL DEFAULT FALSE,   -- 052
    reviewer_action VARCHAR(20) DEFAULT NULL,              -- 064
    reviewer_notes TEXT DEFAULT NULL,                      -- 064
    reviewed_by UUID DEFAULT NULL,                         -- 064
    reviewed_at TIMESTAMPTZ DEFAULT NULL,                  -- 064
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT check_ai_responses_risk_level
      CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high')),
    CONSTRAINT chk_reviewer_action
      CHECK (reviewer_action IS NULL OR reviewer_action IN ('accepted', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_responses_unique ON ai_responses(assessment_query_id, ai_review_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_assessment_query_id ON ai_responses(assessment_query_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_ai_review_id ON ai_responses(ai_review_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_is_flagged ON ai_responses(is_flagged);
CREATE INDEX IF NOT EXISTS idx_ai_responses_created_at ON ai_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_responses_risk_level ON ai_responses(risk_level) WHERE risk_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_responses_category ON ai_responses(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_responses_reviewer_action
  ON ai_responses(ai_review_id, reviewer_action) WHERE is_flagged = TRUE;

-- ── organization_badges ─────────────────────────────────────────────────────
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

-- ── assessment_invitations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES certificate_assessments(id) ON DELETE CASCADE,
  certificate_id  UUID NOT NULL REFERENCES certificates(id),
  invited_user_id UUID NOT NULL REFERENCES users(id),
  invited_by      UUID NOT NULL REFERENCES users(id),
  status          invitation_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_invitation_per_assessment
  ON assessment_invitations(assessment_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_assessment_invitations_invited_user
  ON assessment_invitations(invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_assessment_invitations_assessment_status
  ON assessment_invitations(assessment_id, status);
CREATE INDEX IF NOT EXISTS idx_assessment_invitations_pending
  ON assessment_invitations(invited_user_id, status) WHERE status = 'pending';
