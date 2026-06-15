-- Schedule the check-in reminder Edge Function.
--
-- Replace:
--   <project-ref> with your Supabase project ref
--   <service-role-key> with the service role key
--
-- Run this from the Supabase SQL Editor after deploying:
--   supabase/functions/checkin-reminders

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('send-checkin-reminders')
where exists (
  select 1
  from cron.job
  where jobname = 'send-checkin-reminders'
);

select cron.schedule(
  'send-checkin-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/checkin-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <service-role-key>'
    ),
    body := '{}'::jsonb
  );
  $$
);
