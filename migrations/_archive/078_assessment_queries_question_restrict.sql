-- Protects submitted assessment data from being silently destroyed.
--
-- Previously assessment_queries.question_id referenced questions(id) ON DELETE CASCADE,
-- which meant deleting a certificate question would also delete every applicant answer
-- tied to it (losing assessment history and affecting already-computed scores).
--
-- We switch the constraint to ON DELETE RESTRICT so the database physically refuses to
-- delete a question that has answers. The service layer surfaces a friendly error before
-- this fires. Questions with no answers can still be freely deleted.
--
-- Idempotent: drops the old/new constraint by every name it may have, then re-adds it.

ALTER TABLE assessment_queries
  DROP CONSTRAINT IF EXISTS assessment_queries_question_id_fkey;

ALTER TABLE assessment_queries
  DROP CONSTRAINT IF EXISTS fk_assessment_queries_question_restrict;

ALTER TABLE assessment_queries
  ADD CONSTRAINT fk_assessment_queries_question_restrict
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT;
