ALTER TABLE issued_certificates
  ADD COLUMN IF NOT EXISTS badge_color VARCHAR(50);

ALTER TABLE issued_certificates
  DROP COLUMN IF EXISTS badge_slot;
