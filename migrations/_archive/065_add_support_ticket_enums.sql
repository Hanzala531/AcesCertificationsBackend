-- Add 'support_ticket' to chat_thread_type enum
ALTER TYPE chat_thread_type ADD VALUE IF NOT EXISTS 'support_ticket';

-- Add 'admin' to chat_participant_role enum (for admin participation in support ticket chats)
ALTER TYPE chat_participant_role ADD VALUE IF NOT EXISTS 'admin';

-- Add 'support' to notification_module enum
ALTER TYPE notification_module ADD VALUE IF NOT EXISTS 'support';
