-- pg_cron Scheduled Jobs for Edge Functions
-- Note: These schedules invoke the edge functions via HTTP
-- Requires the pg_cron and pg_net extensions (already enabled in Supabase)

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function to invoke edge functions
CREATE OR REPLACE FUNCTION invoke_edge_function(function_name TEXT)
RETURNS VOID AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get configuration from environment (set via vault secrets)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Supabase URL or service key not configured';
    RETURN;
  END IF;
  
  -- Make HTTP request to edge function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO request_id;
  
  RAISE NOTICE 'Invoked edge function % with request_id %', function_name, request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule sync functions at staggered intervals to avoid overwhelming the system

-- Critical data (every 5 minutes)
SELECT cron.schedule(
  'sync-markets',
  '*/5 * * * *',
  $$SELECT invoke_edge_function('sync-markets')$$
);

SELECT cron.schedule(
  'sync-news',
  '*/5 * * * *',
  $$SELECT invoke_edge_function('sync-news')$$
);

SELECT cron.schedule(
  'sync-weather',
  '*/5 * * * *',
  $$SELECT invoke_edge_function('sync-weather')$$
);

-- Secondary data (every 10 minutes, offset by 2 minutes)
SELECT cron.schedule(
  'sync-hazards',
  '2-57/10 * * * *',
  $$SELECT invoke_edge_function('sync-hazards')$$
);

SELECT cron.schedule(
  'sync-storms',
  '3-58/10 * * * *',
  $$SELECT invoke_edge_function('sync-storms')$$
);

-- Tertiary data (every 15 minutes, offset by 5 minutes)
SELECT cron.schedule(
  'sync-intel',
  '5-50/15 * * * *',
  $$SELECT invoke_edge_function('sync-intel')$$
);

SELECT cron.schedule(
  'sync-environmental',
  '7-52/15 * * * *',
  $$SELECT invoke_edge_function('sync-environmental')$$
);

-- Slow data (every hour)
SELECT cron.schedule(
  'sync-slow',
  '15 * * * *',
  $$SELECT invoke_edge_function('sync-slow')$$
);

-- Fed data (daily at 6 AM UTC - Fed releases data weekly on Thursdays)
SELECT cron.schedule(
  'sync-fed',
  '0 6 * * *',
  $$SELECT invoke_edge_function('sync-fed')$$
);

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION invoke_edge_function(TEXT) TO service_role;

-- Create a view to monitor cron job status
CREATE OR REPLACE VIEW cron_job_status AS
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY jobid;

-- Grant access to the view
GRANT SELECT ON cron_job_status TO authenticated;
GRANT SELECT ON cron_job_status TO service_role;

COMMENT ON VIEW cron_job_status IS 'View to monitor scheduled cron jobs for edge function sync';
