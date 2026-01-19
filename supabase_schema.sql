-- TaskFlow Database Schema
-- Run this in Supabase SQL Editor

-- Users table to store access codes and tasks
CREATE TABLE IF NOT EXISTS taskflow_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_code TEXT UNIQUE NOT NULL,
    pin_hash TEXT DEFAULT NULL,
    email TEXT DEFAULT NULL,
    tasks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    code_rotated_at TIMESTAMPTZ DEFAULT NULL,
    previous_code TEXT DEFAULT NULL
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS taskflow_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    target_code TEXT NOT NULL,
    attempts INT DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_access_code ON taskflow_users(access_code);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON taskflow_rate_limits(ip_address, target_code);

-- Enable Row Level Security
ALTER TABLE taskflow_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE taskflow_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous access (security handled by access code validation)
CREATE POLICY "Allow all operations on taskflow_users" ON taskflow_users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on taskflow_rate_limits" ON taskflow_rate_limits
    FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_users_timestamp ON taskflow_users;
CREATE TRIGGER trigger_update_users_timestamp
    BEFORE UPDATE ON taskflow_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
