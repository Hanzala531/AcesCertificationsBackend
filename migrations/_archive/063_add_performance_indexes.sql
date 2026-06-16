-- Performance indexes based on query pattern analysis
-- These target the most frequently executed WHERE/JOIN clauses across the codebase

-- certificate_assessments: org listing + dashboard filters
CREATE INDEX IF NOT EXISTS idx_cert_assessments_org_status
  ON certificate_assessments(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_cert_assessments_org_created
  ON certificate_assessments(organization_id, created_at DESC);

-- certificate_assessments: auditor dashboard + assigned queries
CREATE INDEX IF NOT EXISTS idx_cert_assessments_auditor_status
  ON certificate_assessments(assigned_auditor_id, status)
  WHERE assigned_auditor_id IS NOT NULL;

-- certificate_assessments: reviewer queries
CREATE INDEX IF NOT EXISTS idx_cert_assessments_reviewer_status
  ON certificate_assessments(assigned_reviewer_id, status)
  WHERE assigned_reviewer_id IS NOT NULL;

-- ai_reviews: lookup by assessment + status (every review flow)
CREATE INDEX IF NOT EXISTS idx_ai_reviews_assessment_status
  ON ai_reviews(certificate_assessment_id, review_status);

-- ai_responses: flagged responses (queried in every review UI)
CREATE INDEX IF NOT EXISTS idx_ai_responses_review_flagged
  ON ai_responses(ai_review_id, is_flagged)
  WHERE is_flagged = TRUE;

-- employee: active employees by org (notification delivery path)
CREATE INDEX IF NOT EXISTS idx_employee_org_active
  ON employee(organization_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_employee_branch_active
  ON employee(branch_id, status)
  WHERE status = 'active';

-- assessment_invitations: pending lookup (auditor dashboard)
CREATE INDEX IF NOT EXISTS idx_assessment_invitations_assessment_status
  ON assessment_invitations(assessment_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_invitations_pending
  ON assessment_invitations(invited_user_id, status)
  WHERE status = 'pending';

-- notifications: unread per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read)
  WHERE read = FALSE;

-- issued_certificates: org listing by date
CREATE INDEX IF NOT EXISTS idx_issued_certificates_org_date
  ON issued_certificates(organization_id, issued_at DESC);

-- questions: third-level filtering
CREATE INDEX IF NOT EXISTS idx_questions_cert_third_level
  ON questions(certificate_id, is_third_level);

-- audits: active audits by assessment
CREATE INDEX IF NOT EXISTS idx_audits_active_status
  ON audits(assessment_id, audit_lifecycle_status)
  WHERE is_archived = FALSE;

-- payments: certificate + status filtering
CREATE INDEX IF NOT EXISTS idx_payments_cert_status
  ON payments(certificate_id, status);

-- support_tickets: user + status
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status
  ON support_tickets(user_id, status);

-- chat_threads: active threads by assessment
CREATE INDEX IF NOT EXISTS idx_chat_threads_assessment_active
  ON chat_threads(assessment_id, status)
  WHERE status = 'active';

-- badge_colors: score range lookup (used in every score calculation)
CREATE INDEX IF NOT EXISTS idx_badge_colors_badge_score
  ON badge_colors(badge_id, min_score, max_score);
