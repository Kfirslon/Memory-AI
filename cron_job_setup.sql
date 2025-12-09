-- pg_cron Job to Check Reminders Every Minute
-- Prerequisites: Enable pg_cron extension in Supabase Dashboard > Database > Extensions

-- Enable pg_cron if not already enabled (run in Dashboard SQL editor)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job to call the edge function every minute
SELECT cron.schedule(
    'check-push-notifications',  -- Job name
    '* * * * *',                 -- Every minute (cron syntax)
    $$
    SELECT
        net.http_post(
            url := 'https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/send-push-notifications',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY'
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove the job:
-- SELECT cron.unschedule('check-push-notifications');
