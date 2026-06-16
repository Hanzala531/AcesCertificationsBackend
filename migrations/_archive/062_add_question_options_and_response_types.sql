-- Add options column to questions table for checkbox and multiple_choice type questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS options JSONB;

COMMENT ON COLUMN questions.options IS 'Array of option strings for checkbox and multiple_choice type questions';

-- Add new values to response_type enum: number, checkbox, multiple_choice, rating
DO $$ BEGIN
    ALTER TYPE response_type ADD VALUE IF NOT EXISTS 'number';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE response_type ADD VALUE IF NOT EXISTS 'checkbox';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE response_type ADD VALUE IF NOT EXISTS 'multiple_choice';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE response_type ADD VALUE IF NOT EXISTS 'rating';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
