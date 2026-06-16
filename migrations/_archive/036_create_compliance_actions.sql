BEGIN;

DO $$ BEGIN
  CREATE TYPE compliance_action_type AS ENUM ('non_compliant', 'request_clarification', 'compliant');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS compliance_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES certificate_assessments(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  action_type     compliance_action_type NOT NULL,
  message         TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_by_role VARCHAR(50) NOT NULL,
  chat_message_id UUID REFERENCES chat_messages(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_actions_assessment
  ON compliance_actions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_compliance_actions_assessment_question
  ON compliance_actions(assessment_id, question_id);

COMMIT;
