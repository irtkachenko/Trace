-- Schedule the rate limit cleanup task using pg_cron
-- This is the cheapest and most reliable way to automate cleanup on Supabase

-- 1) Enable pg_cron if not already enabled (usually requires superuser, 
-- but on Supabase we usually have it if the extension is created)
create extension if not exists "pg_cron" with schema "pg_catalog";

-- 2) Schedule the cleanup function to run every day at 3:00 AM
-- Note: 'cron.schedule' takes (job_name, schedule, command)
-- We use 'select public.cleanup_rate_limits()' as the command
select cron.schedule(
    'cleanup-rate-limits-daily',
    '0 3 * * *',
    $$ select public.cleanup_rate_limits() $$
);

-- 3) Also schedule a task to delete expired storage assets (from audit Point 7)
-- We saw 'delete_expired_assets' in the dump.
select cron.schedule(
    'delete-expired-storage-assets',
    '0 4 * * *',
    $$ select public.delete_expired_assets() $$
);

comment on function public.cleanup_rate_limits() is 'Cleans up rate limit logs older than 24h. Scheduled via pg_cron.';
