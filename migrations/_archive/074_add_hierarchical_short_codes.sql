ALTER TABLE certificates ADD COLUMN IF NOT EXISTS short_code VARCHAR(50);
ALTER TABLE main_section ADD COLUMN IF NOT EXISTS short_code VARCHAR(100);
ALTER TABLE sections ADD COLUMN IF NOT EXISTS short_code VARCHAR(100);
ALTER TABLE sub_section ADD COLUMN IF NOT EXISTS short_code VARCHAR(100);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS short_code VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_short_code
  ON certificates(short_code)
  WHERE short_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_main_section_short_code
  ON main_section(short_code)
  WHERE short_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sections_certificate_short_code
  ON sections(certificate_id, short_code)
  WHERE short_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_section_certificate_short_code
  ON sub_section(certificate_id, short_code)
  WHERE short_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_certificate_short_code
  ON questions(certificate_id, short_code)
  WHERE short_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_short_code
  ON questions(short_code)
  WHERE short_code IS NOT NULL;

UPDATE main_section ms
SET short_code = CASE
  WHEN ms.rank IS NULL OR ms.rank <= 1 THEN c.short_code
  ELSE c.short_code || ms.rank::text
END
FROM certificates c
WHERE ms.certificate_id = c.id
  AND ms.short_code IS NULL
  AND c.short_code IS NOT NULL;

UPDATE sections s
SET short_code = ms.short_code || s.rank::text
FROM main_section ms
WHERE s.main_id = ms.id
  AND s.short_code IS NULL
  AND ms.short_code IS NOT NULL
  AND s.rank IS NOT NULL;

UPDATE sub_section ss
SET short_code = s.short_code || '.' || ss.rank::text
FROM sections s
WHERE ss.section_id = s.id
  AND ss.short_code IS NULL
  AND s.short_code IS NOT NULL
  AND ss.rank IS NOT NULL;

UPDATE questions q
SET short_code = s.short_code || '.0.' || q.question_number::text
FROM sections s
WHERE q.section_id = s.id
  AND q.is_third_level = FALSE
  AND q.parent_question_id IS NULL
  AND q.short_code IS NULL
  AND s.short_code IS NOT NULL
  AND q.question_number IS NOT NULL;

UPDATE questions q
SET short_code = s.short_code || '.' || ss.rank::text || '.' || q.question_number::text
FROM sections s
JOIN sub_section ss ON ss.section_id = s.id
WHERE q.sub_section_id = ss.id
  AND q.is_third_level = TRUE
  AND q.parent_question_id IS NULL
  AND q.short_code IS NULL
  AND s.short_code IS NOT NULL
  AND ss.rank IS NOT NULL
  AND q.question_number IS NOT NULL;
