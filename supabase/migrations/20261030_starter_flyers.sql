create table if not exists public.starter_flyers (
  id uuid primary key default gen_random_uuid(),
  club_id text not null,
  source_url text not null,
  title text not null,
  source text not null default 'foretees-home',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, source_url),
  constraint starter_flyers_foretees_source_url_check
    check (
      source_url ~* '^https://web\.foretees\.com/v5/AEimages/twineaglesclub/.+\.(png|jpe?g|gif|webp)(\?.*)?$'
    )
);

create index if not exists starter_flyers_club_last_seen_idx
  on public.starter_flyers (club_id, last_seen_at desc);

alter table public.starter_flyers enable row level security;

drop policy if exists "GolfOps users can read starter flyers"
  on public.starter_flyers;

create policy "GolfOps users can read starter flyers"
  on public.starter_flyers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.club_id::text = starter_flyers.club_id
    )
  );

drop policy if exists "Tee sheet users can sync starter flyers"
  on public.starter_flyers;

create policy "Tee sheet users can sync starter flyers"
  on public.starter_flyers
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.club_id::text = starter_flyers.club_id
        and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid()
        and club_id::text = starter_flyers.club_id
        and (tee_sheet = true or starter = true)
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.club_id::text = starter_flyers.club_id
        and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.user_permissions
      where user_id = auth.uid()
        and club_id::text = starter_flyers.club_id
        and (tee_sheet = true or starter = true)
    )
  );

grant select, insert, update, delete on public.starter_flyers to authenticated;
