
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  main_section_id UUID NOT NULL REFERENCES main_section(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  sub_section_id UUID REFERENCES sub_section(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  short_code VARCHAR(100),
  hint TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'boolean',
  is_third_level BOOLEAN NOT NULL DEFAULT TRUE,
  criteria TEXT,
  question_number INTEGER,
  certificate_question_number INTEGER,
  rank INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_question_level_consistency CHECK (
    (is_third_level = TRUE AND sub_section_id IS NOT NULL) OR
    (is_third_level = FALSE AND sub_section_id IS NULL)
  )
);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS criteria TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_number INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS certificate_question_number INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'boolean';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_third_level BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS rank INTEGER NOT NULL DEFAULT 1;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS short_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_questions_certificate_id ON questions(certificate_id);
CREATE INDEX IF NOT EXISTS idx_questions_main_section_id ON questions(main_section_id);
CREATE INDEX IF NOT EXISTS idx_questions_section_id ON questions(section_id);
CREATE INDEX IF NOT EXISTS idx_questions_sub_section_id ON questions(sub_section_id) WHERE sub_section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_is_third_level ON questions(is_third_level);
CREATE INDEX IF NOT EXISTS idx_questions_rank ON questions(rank);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_certificate_short_code ON questions(certificate_id, short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_short_code ON questions(short_code) WHERE short_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_section_rank 
  ON questions(section_id, rank) 
  WHERE is_third_level = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_subsection_rank 
  ON questions(sub_section_id, rank) 
  WHERE is_third_level = TRUE AND sub_section_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_section_number
  ON questions(section_id, question_number)
  WHERE is_third_level = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_subsection_number
  ON questions(sub_section_id, question_number)
  WHERE is_third_level = TRUE AND sub_section_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_certificate_number
  ON questions(certificate_id, certificate_question_number);

CREATE INDEX IF NOT EXISTS idx_questions_by_cert_and_number
  ON questions(certificate_id, certificate_question_number);

DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE questions IS 'Questions belonging to sections or subsections of a certificate';
COMMENT ON COLUMN questions.is_third_level IS 'TRUE = question belongs to subsection (Level 3), FALSE = question belongs to section (Level 2)';
COMMENT ON COLUMN questions.criteria IS 'Freeform criteria text';
COMMENT ON COLUMN questions.hint IS 'Optional help text or guidance for answering the question';
COMMENT ON COLUMN questions.type IS 'Question type: boolean, text, multiple_choice, rating, number, file';
