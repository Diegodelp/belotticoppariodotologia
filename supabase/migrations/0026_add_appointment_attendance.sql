alter table if exists public.appointments
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by_name text,
  add column if not exists called_at timestamptz,
  add column if not exists called_by_name text,
  add column if not exists called_box text;

create index if not exists appointments_checked_in_at_idx on public.appointments(checked_in_at desc nulls last);
create index if not exists appointments_called_at_idx on public.appointments(called_at desc nulls last);
