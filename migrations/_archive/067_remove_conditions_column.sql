-- Remove the conditions/jump system from questions table
ALTER TABLE questions DROP COLUMN IF EXISTS conditions;
