create table if not exists public.tee_sheet_operational_state (
  club_id text not null,
  sheet_date text not null,
  identity_key text not null,
  member_id text,
  bag_number text,
  player_name text,
  cart_number text,
  check_in text not null default '',
  updated_at timestamptz not null default now(),
  primary key (club_id, sheet_date, identity_key)
);

create index if not exists tee_sheet_operational_state_date_idx
  on public.tee_sheet_operational_state (club_id, sheet_date);

alter table public.tee_sheet_operational_state enable row level security;

drop policy if exists "Operational state club access"
  on public.tee_sheet_operational_state;

create policy "Operational state club access"
  on public.tee_sheet_operational_state
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.club_id::text = tee_sheet_operational_state.club_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.club_id::text = tee_sheet_operational_state.club_id
    )
  );
