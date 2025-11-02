-- Add index on auth_id for faster user lookups
-- This will dramatically speed up the getCurrentUser query

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- Analyze the table to update statistics
ANALYZE public.users;
