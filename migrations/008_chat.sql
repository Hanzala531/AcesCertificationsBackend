-- ============================================================================
-- 008 — Chat: chat_threads, chat_participants, chat_messages
-- Folds: 047/048 (drop original single-thread-per-assessment unique constraint),
--        050 (thread_type + question_id + per-type partial uniques),
--        058 (assessment_id nullable + support_ticket_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES certificate_assessments(id) ON DELETE CASCADE,  -- 058: nullable
  thread_type chat_thread_type NOT NULL,                                        -- 050
  question_id UUID REFERENCES questions(id),                                    -- 050
  support_ticket_id UUID NULL REFERENCES support_tickets(id) ON DELETE SET NULL, -- 058
  status chat_thread_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_reason VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_assessment ON chat_threads(assessment_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);
CREATE INDEX IF NOT EXISTS idx_chat_threads_question_id ON chat_threads(question_id) WHERE question_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_threads_support_ticket_id ON chat_threads(support_ticket_id) WHERE support_ticket_id IS NOT NULL;

-- One thread per (assessment, type, question) when tied to a clarification question
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_thread_assessment_type_question
  ON chat_threads (assessment_id, thread_type, question_id)
  WHERE question_id IS NOT NULL;
-- One thread per (assessment, type) for non-question, non-support threads
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_thread_assessment_type_no_question
  ON chat_threads (assessment_id, thread_type)
  WHERE question_id IS NULL AND support_ticket_id IS NULL;

-- ── chat_participants ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role chat_participant_role NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  CONSTRAINT unique_thread_participant UNIQUE (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_thread ON chat_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);

-- ── chat_messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
