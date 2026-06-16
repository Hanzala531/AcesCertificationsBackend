-- ============================================================================
-- 005 — Certificate templates: certificates, badges, badge_colors,
--       main_section, sections, sub_section, questions
-- Folds: 074 (hierarchical short_codes — already inline), 062 (question options),
--        068 (nested questions), 075 (AI review + conditional logic + boolean
--        scoring), 076 (question score, drops legacy weightage), 077 (is_compulsory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id VARCHAR(100) NOT NULL UNIQUE,
  short_code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  industry_ids UUID[],
  disclosure_price NUMERIC(12,2) NOT NULL,
  assured_price NUMERIC(12,2),
  validity_days INTEGER DEFAULT 0,
  validity_months INTEGER DEFAULT 0,
  validity_years INTEGER DEFAULT 0,
  compulsory_docs TEXT[],
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_certificate_id ON certificates(certificate_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_short_code ON certificates(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON certificates(created_at);
CREATE INDEX IF NOT EXISTS idx_certificates_is_published ON certificates(is_published);
CREATE INDEX IF NOT EXISTS idx_certificates_created_by ON certificates(created_by);
CREATE INDEX IF NOT EXISTS idx_certificates_updated_by ON certificates(updated_by);

DROP TRIGGER IF EXISTS update_certificates_updated_at ON certificates;
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── badges ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50),
  score INTEGER,
  slot INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_badge_slot CHECK (slot BETWEEN 1 AND 3),
  CONSTRAINT uq_certificate_badge_slot UNIQUE(certificate_id, slot),
  CONSTRAINT uq_certificate_badge_name UNIQUE(certificate_id, name)
);

CREATE INDEX IF NOT EXISTS idx_badges_certificate_id ON badges(certificate_id);
CREATE INDEX IF NOT EXISTS idx_badges_created_at ON badges(created_at);

DROP TRIGGER IF EXISTS update_badges_updated_at ON badges;
CREATE TRIGGER update_badges_updated_at BEFORE UPDATE ON badges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── badge_colors ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  color VARCHAR(50) NOT NULL,
  min_score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_badge_color_scores CHECK (min_score <= max_score)
);

CREATE INDEX IF NOT EXISTS idx_badge_colors_badge_id ON badge_colors(badge_id);

-- ── main_section ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS main_section (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  name VARCHAR(255),
  short_code VARCHAR(100),
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_main_section_certificate_id ON main_section(certificate_id);
CREATE INDEX IF NOT EXISTS idx_main_section_short_code ON main_section(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_main_section_created_at ON main_section(created_at);

DROP TRIGGER IF EXISTS update_main_section_updated_at ON main_section;
CREATE TRIGGER update_main_section_updated_at BEFORE UPDATE ON main_section
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── sections ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  main_id UUID NOT NULL REFERENCES main_section(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(100),
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sections_certificate_id ON sections(certificate_id);
CREATE INDEX IF NOT EXISTS idx_sections_main_id ON sections(main_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sections_certificate_short_code ON sections(certificate_id, short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sections_created_at ON sections(created_at);

DROP TRIGGER IF EXISTS update_sections_updated_at ON sections;
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── sub_section ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_section (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(100),
  main_id UUID NOT NULL REFERENCES main_section(id) ON DELETE CASCADE,
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_section_main_id ON sub_section(main_id);
CREATE INDEX IF NOT EXISTS idx_sub_section_certificate_id ON sub_section(certificate_id);
CREATE INDEX IF NOT EXISTS idx_sub_section_section_id ON sub_section(section_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_section_certificate_short_code ON sub_section(certificate_id, short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sub_section_created_at ON sub_section(created_at);

DROP TRIGGER IF EXISTS update_sub_section_updated_at ON sub_section;
CREATE TRIGGER update_sub_section_updated_at BEFORE UPDATE ON sub_section
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── questions ───────────────────────────────────────────────────────────────
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
  options JSONB,                                              -- 062
  parent_question_id UUID REFERENCES questions(id) ON DELETE CASCADE,  -- 068
  parent_trigger_value VARCHAR(10),                          -- 068
  ai_review_enabled BOOLEAN NOT NULL DEFAULT FALSE,          -- 075
  ai_review_criteria TEXT,                                   -- 075
  ai_review_score INTEGER,                                   -- 075
  yes_score INTEGER DEFAULT 0,                               -- 075/076
  no_score INTEGER DEFAULT 0,                                -- 075/076
  conditional_logic_enabled BOOLEAN NOT NULL DEFAULT FALSE,  -- 075
  conditional_logic JSONB,                                   -- 075
  score INTEGER NOT NULL DEFAULT 0,                          -- 076 (replaced weightage)
  is_compulsory BOOLEAN NOT NULL DEFAULT FALSE,              -- 077
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_question_level_consistency CHECK (
    (is_third_level = TRUE AND sub_section_id IS NOT NULL) OR
    (is_third_level = FALSE AND sub_section_id IS NULL)
  ),
  CONSTRAINT chk_nested_question_consistency CHECK (
    (parent_question_id IS NULL AND parent_trigger_value IS NULL) OR
    (parent_question_id IS NOT NULL AND parent_trigger_value IS NOT NULL)
  ),
  CONSTRAINT chk_question_parent_trigger_value CHECK (
    parent_trigger_value IS NULL OR parent_trigger_value IN ('yes', 'no')
  ),
  CONSTRAINT chk_question_score_range CHECK (score BETWEEN 0 AND 999),
  CONSTRAINT chk_questions_ai_review_score_range CHECK (
    ai_review_score IS NULL OR (ai_review_score >= 0 AND ai_review_score <= 9999)
  ),
  CONSTRAINT chk_questions_yes_score_range CHECK (
    yes_score IS NULL OR (yes_score >= 0 AND yes_score <= 9999)
  ),
  CONSTRAINT chk_questions_no_score_range CHECK (
    no_score IS NULL OR (no_score >= 0 AND no_score <= 9999)
  ),
  CONSTRAINT chk_questions_ai_review_required_fields CHECK (
    ai_review_enabled = FALSE OR (
      ai_review_criteria IS NOT NULL
      AND length(trim(ai_review_criteria)) > 0
      AND (type = 'boolean' OR ai_review_score IS NOT NULL)
    )
  ),
  CONSTRAINT chk_questions_conditional_logic_boolean_only CHECK (
    conditional_logic_enabled = FALSE OR (type = 'boolean' AND conditional_logic IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_questions_certificate_id ON questions(certificate_id);
CREATE INDEX IF NOT EXISTS idx_questions_main_section_id ON questions(main_section_id);
CREATE INDEX IF NOT EXISTS idx_questions_section_id ON questions(section_id);
CREATE INDEX IF NOT EXISTS idx_questions_sub_section_id ON questions(sub_section_id) WHERE sub_section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_is_third_level ON questions(is_third_level);
CREATE INDEX IF NOT EXISTS idx_questions_rank ON questions(rank);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_certificate_short_code ON questions(certificate_id, short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_short_code ON questions(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_parent_question_id ON questions(parent_question_id) WHERE parent_question_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_ai_review_enabled ON questions(ai_review_enabled) WHERE ai_review_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_questions_conditional_logic_enabled ON questions(conditional_logic_enabled) WHERE conditional_logic_enabled = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_section_rank
  ON questions(section_id, rank) WHERE is_third_level = FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_subsection_rank
  ON questions(sub_section_id, rank) WHERE is_third_level = TRUE AND sub_section_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_section_number
  ON questions(section_id, question_number) WHERE is_third_level = FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_subsection_number
  ON questions(sub_section_id, question_number) WHERE is_third_level = TRUE AND sub_section_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_certificate_number
  ON questions(certificate_id, certificate_question_number);
CREATE INDEX IF NOT EXISTS idx_questions_by_cert_and_number
  ON questions(certificate_id, certificate_question_number);

DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
