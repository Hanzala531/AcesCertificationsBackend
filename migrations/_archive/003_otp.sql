-- Create enum type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'otp_purpose'
    ) THEN
        CREATE TYPE otp_purpose AS ENUM (
            'email_verification',
            'login',
            'password_reset'
        );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN 
        NULL;
END $$;

-- Create otp table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'otp'
    ) THEN
        CREATE TABLE otp (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            otp_code VARCHAR(6) NOT NULL,
            purpose otp_purpose NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            is_used BOOLEAN NOT NULL DEFAULT FALSE,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
EXCEPTION
    WHEN duplicate_table THEN 
        NULL;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_code ON otp(otp_code);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_is_used ON otp(is_used);
