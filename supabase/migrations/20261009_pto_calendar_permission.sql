alter table public.user_permissions
  add column if not exists pto_calendar boolean not null default false;
