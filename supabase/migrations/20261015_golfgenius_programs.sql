create table if not exists public.golfgenius_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  external_event_id text not null,
  directory_ggid text not null,
  event_type text not null check (event_type in ('CLINIC', 'FITTING')),
  event_name text not null,
  event_date date not null,
  start_time time without time zone,
  end_time time without time zone,
  location text,
  registration_status text,
  source_url text not null,
  source_text text,
  active boolean not null default true,
  sync_token text not null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, event_type, external_event_id)
);

create table if not exists public.golfgenius_registrations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  event_id uuid not null references public.golfgenius_events(id) on delete cascade,
  external_registration_key text not null,
  participant_name text not null,
  appointment_time time without time zone,
  registration_status text not null default 'CONFIRMED',
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, external_registration_key)
);

create table if not exists public.golfgenius_sync_runs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  sync_token text not null,
  trigger_type text not null default 'MANUAL' check (trigger_type in ('MANUAL', 'DAILY')),
  status text not null check (status in ('SUCCESS', 'PARTIAL', 'ERROR')),
  event_count integer not null default 0,
  registration_count integer not null default 0,
  directory_errors jsonb not null default '[]'::jsonb,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now()
);

create index if not exists golfgenius_events_club_date_idx
  on public.golfgenius_events (club_id, event_date, active);
create index if not exists golfgenius_registrations_event_idx
  on public.golfgenius_registrations (event_id, participant_name);
create index if not exists golfgenius_sync_runs_club_imported_idx
  on public.golfgenius_sync_runs (club_id, imported_at desc);

alter table public.golfgenius_events enable row level security;
alter table public.golfgenius_registrations enable row level security;
alter table public.golfgenius_sync_runs enable row level security;

drop policy if exists "GolfOps users can read Golf Genius events" on public.golfgenius_events;
create policy "GolfOps users can read Golf Genius events"
on public.golfgenius_events for select to authenticated
using (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "GolfOps users can read Golf Genius registrations" on public.golfgenius_registrations;
create policy "GolfOps users can read Golf Genius registrations"
on public.golfgenius_registrations for select to authenticated
using (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "GolfOps users can read Golf Genius sync runs" on public.golfgenius_sync_runs;
create policy "GolfOps users can read Golf Genius sync runs"
on public.golfgenius_sync_runs for select to authenticated
using (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "Authorized users can manage Golf Genius events" on public.golfgenius_events;
create policy "Authorized users can manage Golf Genius events"
on public.golfgenius_events for all to authenticated
using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid() and club_id = golfgenius_events.club_id and tee_sheet = true
    )
  )
)
with check (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid() and club_id = golfgenius_events.club_id and tee_sheet = true
    )
  )
);

drop policy if exists "Authorized users can manage Golf Genius registrations" on public.golfgenius_registrations;
create policy "Authorized users can manage Golf Genius registrations"
on public.golfgenius_registrations for all to authenticated
using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid() and club_id = golfgenius_registrations.club_id and tee_sheet = true
    )
  )
)
with check (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid() and club_id = golfgenius_registrations.club_id and tee_sheet = true
    )
  )
);

drop policy if exists "Authorized users can manage Golf Genius sync runs" on public.golfgenius_sync_runs;
create policy "Authorized users can manage Golf Genius sync runs"
on public.golfgenius_sync_runs for all to authenticated
using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid() and club_id = golfgenius_sync_runs.club_id and tee_sheet = true
    )
  )
)
with check (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid() and club_id = golfgenius_sync_runs.club_id and tee_sheet = true
    )
  )
);
