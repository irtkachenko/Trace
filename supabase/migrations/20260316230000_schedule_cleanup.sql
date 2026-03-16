-- Schedule the rate limit cleanup task using pg_cron
-- This is the cheapest and most reliable way to automate cleanup on Supabase

-- 1) Enable pg_cron if not already enabled
create extension if not exists "pg_cron" with schema "pg_catalog";

-- 2) Schedule the cleanup function to run every day at 3:00 AM
-- Note: 'cron.schedule' takes (job_name, schedule, command)
-- We use 'select public.cleanup_rate_limits()' as the command
select cron.schedule(
    'cleanup-rate-limits-daily',
    '0 3 * * *',
    $$ select public.cleanup_rate_limits() $$
);

-- 3) Define or update the storage cleanup function
-- This ensures that attachments bucket stays clean
create or replace function public.delete_expired_assets()
returns void
language plpgsql
security definer
as $$
begin
  -- Delete metadata from Supabase Storage
  -- The underlying files are usually cleaned up by Supabase's internal processes
  delete from storage.objects
  where created_at < now() - interval '24 hours'
    and bucket_id = 'attachments';
end;
$$;

-- 4) Schedule the task
select cron.schedule(
    'delete-expired-storage-assets',
    '0 4 * * *',
    $$ select public.delete_expired_assets() $$
);

comment on function public.cleanup_rate_limits() is 'Cleans up rate limit logs older than 24h. Scheduled via pg_cron.';
comment on function public.delete_expired_assets() is 'Deletes storage objects older than 24h from attachments bucket.';
