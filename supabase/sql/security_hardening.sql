-- Security hardening for the Supabase Security Advisor warnings.
--
-- REVIEW BEFORE RUNNING. Nothing here has been executed. Run section by section
-- in the Supabase SQL Editor, ideally against a branch/staging project first.
-- Sections 1 and 2 are safe for the current app. Section 3 needs an app change.
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
-- 3. profiles: owner-only, plus a narrow function for login-by-username.
--    DO NOT RUN until the app calls get_login_email() instead of querying
--    profiles directly. Today, login reads profiles.email by username BEFORE the
--    user is signed in (SupabaseAuthContext.jsx ~L992, ~L1516), so owner-only
--    RLS would break login and password reset.
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
--
-- CREATE OR REPLACE FUNCTION public.get_login_email(username_in text)
-- RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
--   SELECT email FROM public.profiles WHERE username = username_in LIMIT 1;
-- $fn$;
-- REVOKE ALL ON FUNCTION public.get_login_email(text) FROM public;
-- GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;
-- Note: this still lets anyone map a username to an email. Tightening that
-- (e.g. sign in with email only, or rate limiting) is a separate decision.

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
