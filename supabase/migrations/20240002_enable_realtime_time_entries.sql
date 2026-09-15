-- ============================================================
-- Migration: Enable Supabase Realtime on time_entries table
-- ============================================================
-- This allows the PC session to automatically receive live
-- push notifications when another device (e.g. phone) inserts,
-- updates, or deletes a time entry — without requiring a
-- manual page refresh or "Sync Now" click.
--
-- Run this once in Supabase Dashboard → SQL Editor.
-- ============================================================

-- Add the time_entries table to the supabase_realtime publication
-- so Postgres CDC changes are broadcast via the Realtime service.
ALTER PUBLICATION supabase_realtime ADD TABLE time_entries;
