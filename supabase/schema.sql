-- PhnomFlood live app: shared flood reports.
-- Run once in the Supabase SQL editor, then set VITE_SUPABASE_URL and
-- VITE_SUPABASE_ANON_KEY in Vercel (and .env for local development).
--
-- Security model: the anon key is public. Anonymous clients can read reports from the
-- last 24 hours and insert new ones inside Phnom Penh. They cannot update or delete rows
-- directly; confirming and clearing go through two narrow functions.

create table if not exists public.flood_reports (
  id            text primary key check (char_length(id) between 3 and 64),
  name          text not null check (char_length(name) between 1 and 120),
  area          text not null check (char_length(area) between 1 and 120),
  khan          text not null default '' check (char_length(khan) <= 80),
  sangkat       text not null default '' check (char_length(sangkat) <= 80),
  lat           double precision not null check (lat between 11.3 and 11.8),
  lng           double precision not null check (lng between 104.7 and 105.1),
  depth         text not null check (depth in ('ankle', 'knee', 'waist')),
  source        text not null default 'rider' check (source in ('rider', 'citizen')),
  ai            jsonb check (ai is null or pg_column_size(ai) < 4000),
  confirmations integer not null default 0,
  cleared_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists flood_reports_updated_at on public.flood_reports (updated_at);

alter table public.flood_reports enable row level security;

drop policy if exists "read recent reports" on public.flood_reports;
create policy "read recent reports" on public.flood_reports
  for select to anon
  using (created_at > now() - interval '24 hours');

drop policy if exists "insert new reports" on public.flood_reports;
create policy "insert new reports" on public.flood_reports
  for insert to anon
  with check (
    cleared_at is null
    and confirmations = 0
    and created_at > now() - interval '5 minutes'
    and created_at < now() + interval '1 minute'
  );

-- Confirm ("still flooded") and clear ("water gone"), the only changes anonymous users can make.
create or replace function public.confirm_report(p_id text) returns void
language sql security definer set search_path = public as $$
  update public.flood_reports
     set confirmations = confirmations + 1, updated_at = now()
   where id = p_id and cleared_at is null and created_at > now() - interval '24 hours';
$$;

create or replace function public.clear_report(p_id text) returns void
language sql security definer set search_path = public as $$
  update public.flood_reports
     set cleared_at = now(), updated_at = now()
   where id = p_id and cleared_at is null and created_at > now() - interval '24 hours';
$$;

revoke all on function public.confirm_report(text) from public;
revoke all on function public.clear_report(text) from public;
grant execute on function public.confirm_report(text) to anon;
grant execute on function public.clear_report(text) to anon;
