create table if not exists public.schedulepop_employees (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  schedulepop_user_id bigint not null,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  primary_duty text,
  duties jsonb not null default '[]'::jsonb,
  zones jsonb not null default '[]'::jsonb,
  routing_override text check (routing_override in ('INSIDE', 'OUTSIDE') or routing_override is null),
  resolved_department text not null default 'REVIEW' check (resolved_department in ('INSIDE', 'OUTSIDE', 'REVIEW')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, schedulepop_user_id)
);

create table if not exists public.team_pto_imports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  location_id bigint not null,
  date_start date not null,
  date_end date not null,
  employee_count integer not null default 0,
  request_count integer not null default 0,
  source_complete boolean not null default false,
  imported_by uuid not null references auth.users(id) on delete cascade,
  imported_at timestamptz not null default now()
);

create table if not exists public.team_pto_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  employee_id uuid references public.schedulepop_employees(id) on delete set null,
  schedulepop_request_id bigint not null,
  schedulepop_user_id bigint not null,
  employee_first_name text not null default '',
  employee_last_name text not null default '',
  start_local timestamp without time zone not null,
  end_local timestamp without time zone not null,
  all_day boolean not null default true,
  approved boolean not null default false,
  is_deleted boolean not null default false,
  request_type text not null default 'PTO',
  manager_note text,
  source_created_at timestamp without time zone,
  source_updated_at timestamp without time zone,
  raw_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, schedulepop_request_id)
);

create table if not exists public.pto_calendar_syncs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  group_key text not null,
  department text not null check (department in ('INSIDE', 'OUTSIDE')),
  employee_name text not null,
  start_date date not null,
  end_date date not null,
  google_event_id text,
  content_hash text not null,
  sync_status text not null default 'PENDING' check (sync_status in ('PENDING', 'SYNCED', 'ERROR', 'REMOVED')),
  attempt_count integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, group_key)
);

create index if not exists schedulepop_employees_club_department_idx
  on public.schedulepop_employees (club_id, resolved_department, last_name);
create index if not exists team_pto_requests_club_dates_idx
  on public.team_pto_requests (club_id, start_local, approved, is_deleted);
create index if not exists pto_calendar_syncs_club_dates_idx
  on public.pto_calendar_syncs (club_id, start_date, end_date, sync_status);
create index if not exists team_pto_imports_club_imported_idx
  on public.team_pto_imports (club_id, imported_at desc);

alter table public.schedulepop_employees enable row level security;
alter table public.team_pto_imports enable row level security;
alter table public.team_pto_requests enable row level security;
alter table public.pto_calendar_syncs enable row level security;

drop policy if exists "GolfOps users can read SchedulePop employees" on public.schedulepop_employees;
create policy "GolfOps users can read SchedulePop employees"
on public.schedulepop_employees for select to authenticated
using (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "GolfOps users can read TEAM PTO imports" on public.team_pto_imports;
create policy "GolfOps users can read TEAM PTO imports"
on public.team_pto_imports for select to authenticated
using (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "GolfOps users can read TEAM PTO requests" on public.team_pto_requests;
create policy "GolfOps users can read TEAM PTO requests"
on public.team_pto_requests for select to authenticated
using (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "GolfOps users can read PTO calendar syncs" on public.pto_calendar_syncs;
create policy "GolfOps users can read PTO calendar syncs"
on public.pto_calendar_syncs for select to authenticated
using (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "Admins can manage SchedulePop employees" on public.schedulepop_employees;
create policy "Admins can manage SchedulePop employees"
on public.schedulepop_employees for all to authenticated
using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admins can manage TEAM PTO imports" on public.team_pto_imports;
create policy "Admins can manage TEAM PTO imports"
on public.team_pto_imports for all to authenticated
using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admins can manage TEAM PTO requests" on public.team_pto_requests;
create policy "Admins can manage TEAM PTO requests"
on public.team_pto_requests for all to authenticated
using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admins can manage PTO calendar syncs" on public.pto_calendar_syncs;
create policy "Admins can manage PTO calendar syncs"
on public.pto_calendar_syncs for all to authenticated
using (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
)
with check (
  club_id = (select club_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
