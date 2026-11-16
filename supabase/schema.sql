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

-- Instant sync: let Supabase Realtime announce changes to flood_reports, so phones fetch a new
-- report the moment it is added instead of on the next poll. (Realtime still applies the
-- "read recent reports" policy above.) Safe to run more than once.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'flood_reports'
  ) then
    alter publication supabase_realtime add table public.flood_reports;
  end if;
end $$;

-- Flood-prone spots: places riders have reported water on two or more different days.
-- Returns only aggregates (about 110 m cells), never individual reports, so history can be
-- shared without opening up the 24-hour read policy above. The live app highlights these
-- spots as "predicted" when heavy rain is falling or forecast.
create index if not exists flood_reports_created_at on public.flood_reports (created_at);

create or replace function public.flood_hotspots(p_days integer default 90)
returns table (
  lat double precision,
  lng double precision,
  name text,
  khan text,
  reports integer,
  deep integer,
  days integer,
  last_reported timestamptz
)
language sql stable security definer set search_path = public as $$
  select round(avg(r.lat)::numeric, 5)::double precision,
         round(avg(r.lng)::numeric, 5)::double precision,
         mode() within group (order by r.name),
         mode() within group (order by r.khan),
         count(*)::integer,
         (count(*) filter (where r.depth in ('knee', 'waist')))::integer,
         count(distinct (r.created_at at time zone 'Asia/Phnom_Penh')::date)::integer,
         max(r.created_at)
    from public.flood_reports r
   where r.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365))
     and r.id not like 's-%'
   group by round(r.lat::numeric, 3), round(r.lng::numeric, 3)
  having count(distinct (r.created_at at time zone 'Asia/Phnom_Penh')::date) >= 2
   order by 7 desc, 5 desc
   limit 300;
$$;

revoke all on function public.flood_hotspots(integer) from public;
grant execute on function public.flood_hotspots(integer) to anon;
