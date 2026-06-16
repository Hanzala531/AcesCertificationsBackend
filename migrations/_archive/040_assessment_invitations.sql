DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'invitation_status'
  ) THEN
    CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined');
  END IF;
END
$$;

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
