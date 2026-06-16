
-- Create payment_type enum
DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM (
        'self_disclosure',
        'assured'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create payment_status enum
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',
        'completed',
        'failed',
        'refunded',
        'disputed',
        'partially_refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create assessment_status enum
DO $$ BEGIN
    CREATE TYPE assessment_status AS ENUM (
        'in_progress',
        'submitted',
        'ai_reviewing',
        'completed',
        'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create assessment_type enum
DO $$ BEGIN
    CREATE TYPE assessment_type AS ENUM (
        'self_disclosure',
        'assured'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create response_type enum
DO $$ BEGIN
    CREATE TYPE response_type AS ENUM (
        'pdf',
        'boolean',
        'text'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ai_review_status enum
DO $$ BEGIN
    CREATE TYPE ai_review_status AS ENUM (
        'pending',
        'in_progress',
        'completed',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_flag_status AS ENUM (
        'open',
        'pending',
        'escalated',
        'resolved'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE: payments
-- ============================================================================
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

-- ============================================================================
-- TABLE: certificate_assessments
-- ============================================================================
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

-- ============================================================================
-- TABLE: assessment_queries
-- ============================================================================
CREATE TABLE IF NOT EXISTS assessment_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_assessment_id UUID NOT NULL REFERENCES certificate_assessments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    response_type response_type NOT NULL,
    response_value TEXT,
    reviewer_notes TEXT,
    auditor_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure one answer per question per assessment
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_queries_unique
    ON assessment_queries(certificate_assessment_id, question_id);

CREATE INDEX IF NOT EXISTS idx_assessment_queries_certificate_assessment_id
    ON assessment_queries(certificate_assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_queries_question_id
    ON assessment_queries(question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_queries_created_at
    ON assessment_queries(created_at);

DROP TRIGGER IF EXISTS update_assessment_queries_updated_at ON assessment_queries;
CREATE TRIGGER update_assessment_queries_updated_at BEFORE UPDATE ON assessment_queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: ai_reviews
-- ============================================================================
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure one AI review per assessment
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_reviews_assessment_unique
    ON ai_reviews(certificate_assessment_id);

CREATE INDEX IF NOT EXISTS idx_ai_reviews_certificate_assessment_id
    ON ai_reviews(certificate_assessment_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_status
    ON ai_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_created_at
    ON ai_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_flag_status
    ON ai_reviews(flag_status);

DROP TRIGGER IF EXISTS update_ai_reviews_updated_at ON ai_reviews;
CREATE TRIGGER update_ai_reviews_updated_at BEFORE UPDATE ON ai_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: ai_responses
-- ============================================================================
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
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT check_ai_responses_risk_level
      CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high'))
);

-- Ensure one AI response per query per review
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_responses_unique
    ON ai_responses(assessment_query_id, ai_review_id);

CREATE INDEX IF NOT EXISTS idx_ai_responses_assessment_query_id
    ON ai_responses(assessment_query_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_ai_review_id
    ON ai_responses(ai_review_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_is_flagged
    ON ai_responses(is_flagged);
CREATE INDEX IF NOT EXISTS idx_ai_responses_created_at
    ON ai_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_responses_risk_level
    ON ai_responses(risk_level)
    WHERE risk_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_responses_category
    ON ai_responses(category)
    WHERE category IS NOT NULL;

COMMENT ON COLUMN certificate_assessments.assigned_auditor_id IS 'User ID of the auditor assigned to review this assessment';
COMMENT ON COLUMN certificate_assessments.assigned_reviewer_id IS 'User ID of the reviewer assigned to review this assessment';
COMMENT ON COLUMN certificate_assessments.assigned_by IS 'User ID of the user who assigned this assessment';
COMMENT ON COLUMN certificate_assessments.audit_date IS 'Scheduled audit date for assigned auditor';
COMMENT ON COLUMN certificate_assessments.is_certificate_blocked IS 'When true, automatic certificate unlock/allocation is blocked for this assessment';
COMMENT ON COLUMN certificate_assessments.certificate_block_reason IS 'Admin/subadmin provided reason when certificate allocation is blocked';
