-- Security hardening for the Supabase Security Advisor warnings.
--
-- REVIEW BEFORE RUNNING. Nothing here has been executed. Run section by section
-- in the Supabase SQL Editor, ideally against a branch/staging project first.
-- Sections 1, 2 and 3a are safe now. Section 3b must wait for this app version to be deployed.
-- Section 4 needs you to inspect the remote objects first.

-- ---------------------------------------------------------------------------
-- 1. leave_settings: avoid per-row auth.uid() re-evaluation (Auth RLS InitPlan)
--    Same rules as database/setup-leave-settings-rls.sql, using (select auth.uid()).
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own leave settings" ON public.leave_settings;
DROP POLICY IF EXISTS "Users can insert their own leave settings" ON public.leave_settings;
DROP POLICY IF EXISTS "Users can update their own leave settings" ON public.leave_settings;
DROP POLICY IF EXISTS "Users can delete their own leave settings" ON public.leave_settings;

CREATE POLICY "Users can view their own leave settings"
  ON public.leave_settings FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own leave settings"
  ON public.leave_settings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own leave settings"
  ON public.leave_settings FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own leave settings"
  ON public.leave_settings FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Other user-owned tables the app uses: owner-only access.
--    Check existing policies first (Dashboard > Authentication > Policies);
--    these DROP/CREATE only the policy names below.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['time_entries','pay_periods','reminder_preferences','reminder_logs','push_subscriptions']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "owner_all" ON public.%I FOR ALL TO authenticated
         USING ((select auth.uid()) = user_id)
         WITH CHECK ((select auth.uid()) = user_id)', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3a. Pre-login lookup functions (additive and safe to run now).
--     The app (SupabaseAuthContext.jsx: lookupLoginProfile) calls
--     get_login_email() and falls back to a direct profiles query if it is
--     missing, so create these BEFORE locking down profiles in 3b.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_login_email(username_in text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT email FROM public.profiles WHERE username = username_in LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public.get_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;

-- Used by the sign-up form (returns true when the username is free).
CREATE OR REPLACE FUNCTION public.check_username_availability(username_to_check text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = username_to_check);
$fn$;
REVOKE ALL ON FUNCTION public.check_username_availability(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_username_availability(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3b. profiles: owner-only access. RUN ONLY AFTER 3a AND after this app version
--     is deployed. Older deployed builds read profiles.email by username before
--     sign-in, so locking profiles earlier would break their login.
--     Also confirm the profile row is created by a DB trigger or by an
--     authenticated insert (sign-up must still work), and that the Edge Function
--     (checkin-reminders) uses the service role, which bypasses RLS.
--     Known limit: get_login_email() still lets anyone map username -> email.
--     Removing that needs a product decision (e.g. email-only sign-in).
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "owner_select" ON public.profiles;
-- DROP POLICY IF EXISTS "owner_update" ON public.profiles;
-- DROP POLICY IF EXISTS "owner_insert" ON public.profiles;
-- CREATE POLICY "owner_select" ON public.profiles FOR SELECT TO authenticated
--   USING ((select auth.uid()) = id);
-- CREATE POLICY "owner_update" ON public.profiles FOR UPDATE TO authenticated
--   USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);
-- CREATE POLICY "owner_insert" ON public.profiles FOR INSERT TO authenticated
--   WITH CHECK ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- 4. Unused legacy objects flagged by the Advisor (not referenced in the repo).
--    Their definitions are not in this repo. Inspect each in the dashboard,
--    export anything you want to keep, then uncomment to drop.
--    profiles_with_salary is the most sensitive: drop it first.
-- ---------------------------------------------------------------------------
-- DROP VIEW IF EXISTS public.profiles_with_salary;
-- DROP VIEW IF EXISTS public.profiles_public;
-- DROP VIEW IF EXISTS public.profiles_secure;
-- DROP VIEW IF EXISTS public.profiles_safe;
-- DROP VIEW IF EXISTS public.monthly_hours_summary;
-- DROP VIEW IF EXISTS public.user_stats;
-- DROP TABLE IF EXISTS public.profiles_backup;   -- confirm it is a stale copy first
