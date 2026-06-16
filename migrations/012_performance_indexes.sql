-- ============================================================================
-- 012 — Cross-cutting performance indexes
-- Folds: 063 (query-pattern performance indexes) and the composite indexes
--        added in 069. Runs last so every referenced table/column already exists.
-- ============================================================================

-- certificate_assessments
CREATE INDEX IF NOT EXISTS idx_cert_assessments_org_status
  ON certificate_assessments(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cert_assessments_org_created
  ON certificate_assessments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_assessments_auditor_status
  ON certificate_assessments(assigned_auditor_id, status) WHERE assigned_auditor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cert_assessments_reviewer_status
  ON certificate_assessments(assigned_reviewer_id, status) WHERE assigned_reviewer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cert_assessments_status_type
  ON certificate_assessments(status, assessment_type);
CREATE INDEX IF NOT EXISTS idx_cert_assessments_org_branch_cert
  ON certificate_assessments(organization_id, branch_id, certificate_id);

-- ai_reviews / ai_responses
CREATE INDEX IF NOT EXISTS idx_ai_reviews_assessment_status
  ON ai_reviews(certificate_assessment_id, review_status);
CREATE INDEX IF NOT EXISTS idx_ai_responses_review_flagged
  ON ai_responses(ai_review_id, is_flagged) WHERE is_flagged = TRUE;

-- employee (notification delivery path)
CREATE INDEX IF NOT EXISTS idx_employee_org_active
  ON employee(organization_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_employee_branch_active
  ON employee(branch_id, status) WHERE status = 'active';

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read) WHERE read = FALSE;

-- issued_certificates
CREATE INDEX IF NOT EXISTS idx_issued_certificates_org_date
  ON issued_certificates(organization_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_issued_certs_expiry
  ON issued_certificates(expiry_date);
CREATE INDEX IF NOT EXISTS idx_issued_certs_org_branch_cert
  ON issued_certificates(organization_id, branch_id, certificate_id);

-- questions
CREATE INDEX IF NOT EXISTS idx_questions_cert_third_level
  ON questions(certificate_id, is_third_level);

-- audits
CREATE INDEX IF NOT EXISTS idx_audits_active_status
  ON audits(assessment_id, audit_lifecycle_status) WHERE is_archived = FALSE;

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_cert_status
  ON payments(certificate_id, status);

-- support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status
  ON support_tickets(user_id, status);

-- chat_threads
CREATE INDEX IF NOT EXISTS idx_chat_threads_assessment_active
  ON chat_threads(assessment_id, status) WHERE status = 'active';

-- badge_colors (used in every score calculation)
CREATE INDEX IF NOT EXISTS idx_badge_colors_badge_score
  ON badge_colors(badge_id, min_score, max_score);
