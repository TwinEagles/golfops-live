create table if not exists public.tee_sheet_player_arrivals (
  club_id text not null,
  sheet_date text not null,
  identity_key text not null,
  member_id text,
  bag_number text,
  player_name text not null,
  arrived_at timestamptz not null default now(),
  arrived_by uuid,
  primary key (club_id, sheet_date, identity_key)
);

create index if not exists tee_sheet_player_arrivals_date_idx
  on public.tee_sheet_player_arrivals (club_id, sheet_date);

alter table public.tee_sheet_player_arrivals enable row level security;

drop policy if exists "GolfOps users can read player arrivals"
  on public.tee_sheet_player_arrivals;

create policy "GolfOps users can read player arrivals"
  on public.tee_sheet_player_arrivals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.club_id::text = tee_sheet_player_arrivals.club_id
    )
  );

drop policy if exists "Tee sheet users can manage player arrivals"
  on public.tee_sheet_player_arrivals;

create policy "Tee sheet users can manage player arrivals"
  on public.tee_sheet_player_arrivals
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and club_id::text = tee_sheet_player_arrivals.club_id
        and role = 'admin'
    )
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid()
        and club_id::text = tee_sheet_player_arrivals.club_id
        and tee_sheet = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and club_id::text = tee_sheet_player_arrivals.club_id
        and role = 'admin'
    )
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid()
        and club_id::text = tee_sheet_player_arrivals.club_id
        and tee_sheet = true
    )
  );
