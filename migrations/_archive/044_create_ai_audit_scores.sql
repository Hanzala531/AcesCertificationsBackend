-- Create table to track AI-generated audit scores
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
