-- Google OAuth tokens for Calendar sync
CREATE TABLE IF NOT EXISTS google_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    calendar_sync_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own tokens
CREATE POLICY "Users can read own tokens"
    ON google_tokens FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert own tokens"
    ON google_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update own tokens"
    ON google_tokens FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete own tokens"
    ON google_tokens FOR DELETE
    USING (auth.uid() = user_id);
