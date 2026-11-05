-- Ensure pay_periods exists with the columns the app writes, and that RLS lets a
-- signed-in user insert/update/delete/select their own rows.
-- Idempotent: safe to run on an existing table. Review before running in Supabase SQL editor.

create table if not exists public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns the client sends (missing columns make every insert fail with PGRST204)
alter table public.pay_periods add column if not exists label text;
alter table public.pay_periods add column if not exists is_active boolean not null default false;
alter table public.pay_periods add column if not exists is_current boolean not null default false;
alter table public.pay_periods add column if not exists created_at timestamptz not null default now();
alter table public.pay_periods add column if not exists updated_at timestamptz not null default now();
alter table public.pay_periods alter column user_id set default auth.uid();

create index if not exists pay_periods_user_start_idx on public.pay_periods (user_id, start_date desc);

alter table public.pay_periods enable row level security;

drop policy if exists "pay_periods_select_own" on public.pay_periods;
create policy "pay_periods_select_own" on public.pay_periods
  for select using (auth.uid() = user_id);

drop policy if exists "pay_periods_insert_own" on public.pay_periods;
create policy "pay_periods_insert_own" on public.pay_periods
  for insert with check (auth.uid() = user_id);

drop policy if exists "pay_periods_update_own" on public.pay_periods;
create policy "pay_periods_update_own" on public.pay_periods
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pay_periods_delete_own" on public.pay_periods;
create policy "pay_periods_delete_own" on public.pay_periods
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.pay_periods to authenticated;

-- Diagnostic (run separately): find users whose entries synced but who have no period
-- select te.user_id, count(*) from public.time_entries te
-- left join public.pay_periods pp on pp.user_id = te.user_id
-- where pp.id is null group by te.user_id;
