-- Schedule the check-in reminder Edge Function.
--
-- The cron job authenticates with a random CRON_SECRET that is NOT a Supabase
-- key, so leaking this file again cannot expose database access.
--
-- Setup (once):
--   1. Generate a random secret, e.g. in a terminal:  openssl rand -hex 32
--   2. Store secrets for the function (the sb_secret_... value comes from
--      Project Settings > API Keys):
--        npx supabase secrets set CRON_SECRET=<random-secret> SB_SECRET_KEY=<sb_secret_...>
--   3. Deploy the function WITHOUT gateway JWT verification (it checks CRON_SECRET itself):
--        npx supabase functions deploy checkin-reminders --no-verify-jwt
--   4. Run this script in the Supabase SQL Editor after replacing:
--        <project-ref>   with your Supabase project ref
--        <cron-secret>   with the same CRON_SECRET from step 1
--
-- NEVER commit the filled-in version of this file.

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
      'Authorization', 'Bearer <cron-secret>'
    ),
    body := '{}'::jsonb
  );
  $$
);
