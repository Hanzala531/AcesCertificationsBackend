-- Add action_status column to notifications table
-- Used for action-required notifications (e.g. invitations) so the frontend
-- knows whether the user has accepted/declined and can hide the action buttons.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_status VARCHAR(20) DEFAULT NULL;
