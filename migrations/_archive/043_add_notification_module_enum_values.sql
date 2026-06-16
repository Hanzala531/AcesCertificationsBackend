-- Add missing notification_module enum values for assessment-invitation and auditor modules
ALTER TYPE notification_module ADD VALUE IF NOT EXISTS 'assessment-invitation';
ALTER TYPE notification_module ADD VALUE IF NOT EXISTS 'auditor';
