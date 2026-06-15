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
    url := 'https://wjfnmncthgpjcthattmo.supabase.co/functions/v1/checkin-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZm5tbmN0aGdwamN0aGF0dG1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk0MDUyMywiZXhwIjoyMDg3NTE2NTIzfQ.Wrlfe3y4m5uqF66l27cius3816GP0YQXLetiWMNRJ78'
    ),
    body := '{}'::jsonb
  );
  $$
);
