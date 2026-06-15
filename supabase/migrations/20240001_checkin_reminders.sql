-- ============================================================
-- Migration: Check-in Reminder Notification System
-- ============================================================

-- 1. Reminder Preferences
-- Stores each user's reminder configuration
CREATE TABLE IF NOT EXISTS reminder_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  start_time    TIME NOT NULL DEFAULT '09:00:00',     -- HH:MM in user's local timezone
  reminder_count INT NOT NULL DEFAULT 3 CHECK (reminder_count BETWEEN 1 AND 10),
  interval_minutes INT NOT NULL DEFAULT 15 CHECK (interval_minutes > 0),
  timezone      TEXT NOT NULL DEFAULT 'UTC',          -- IANA timezone string, e.g. "Africa/Cairo"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Push Subscriptions
-- Stores Web Push subscription endpoints per user (a user can have multiple devices)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  keys          JSONB NOT NULL,                        -- { p256dh, auth }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ,
  UNIQUE (user_id, endpoint)
);

-- 3. Reminder Logs
-- Tracks daily reminder state per user for idempotency and suppression
CREATE TABLE IF NOT EXISTS reminder_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,                        -- date in user's local timezone (YYYY-MM-DD)
  suppressed     BOOLEAN NOT NULL DEFAULT FALSE,       -- TRUE once user checks in
  reminders_sent INT NOT NULL DEFAULT 0,
  last_sent_at   TIMESTAMPTZ,                          -- timestamp of the last push sent
  last_sent_slot INT NOT NULL DEFAULT 0,               -- sequential slot index for idempotency
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE reminder_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

-- Reminder Preferences: owner only
CREATE POLICY "Users can manage own reminder preferences"
  ON reminder_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Push Subscriptions: owner only
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reminder Logs: owner can read and upsert (for suppression on check-in)
CREATE POLICY "Users can manage own reminder logs"
  ON reminder_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_user_date ON reminder_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_reminder_preferences_enabled ON reminder_preferences(enabled) WHERE enabled = TRUE;

-- ============================================================
-- Scheduled Cron Job (run in Supabase Dashboard → SQL Editor)
-- Frequency: every 1 minute for accurate reminder timing
-- ============================================================
-- Prefer supabase/sql/schedule_checkin_reminders.sql for the current setup script.
-- select cron.schedule(
--   'send-checkin-reminders',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<your-project-ref>.supabase.co/functions/v1/checkin-reminders',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer <service-role-key>"}'::jsonb
--   )
--   $$
-- );
