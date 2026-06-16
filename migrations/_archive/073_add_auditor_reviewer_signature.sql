-- Add signature column to auditor and reviewer profiles.
-- Stores a Cloudinary URL of the user's signature image; required before
-- an auditor can finalize an audit or a reviewer can finalize a review.

ALTER TABLE auditor
  ADD COLUMN IF NOT EXISTS signature VARCHAR(500);

ALTER TABLE reviewer
  ADD COLUMN IF NOT EXISTS signature VARCHAR(500);
