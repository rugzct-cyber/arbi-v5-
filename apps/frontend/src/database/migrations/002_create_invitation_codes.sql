-- Migration: Create invitation_codes table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    level VARCHAR(10) DEFAULT 'guest' CHECK (level IN ('admin', 'guest')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    used_count INTEGER DEFAULT 0,
    max_uses INTEGER,  -- NULL = unlimited
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_active ON invitation_codes(is_active) WHERE is_active = true;

-- Insert initial codes (same as your current .env)
INSERT INTO invitation_codes (code, level, description) VALUES
    ('rugz', 'admin', 'Compte principal Rugz - Admin'),
    ('Akriix', 'admin', 'Compte admin Akriix'),
    ('guest_2024', 'guest', 'Code invité par défaut')
ON CONFLICT (code) DO NOTHING;

-- Grant access for anon role (for frontend API)
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read-only access for verification
CREATE POLICY "Allow code verification" ON invitation_codes
    FOR SELECT
    USING (is_active = true);

-- Policy: Allow update for incrementing used_count
CREATE POLICY "Allow usage tracking" ON invitation_codes
    FOR UPDATE
    USING (is_active = true)
    WITH CHECK (is_active = true);
