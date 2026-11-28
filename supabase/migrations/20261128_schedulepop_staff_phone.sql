alter table public.schedulepop_shifts
  add column if not exists phone_number text;
