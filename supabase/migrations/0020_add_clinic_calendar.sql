alter table if exists public.clinics
  add column if not exists calendar_id text;

alter table if exists public.appointments
  add column if not exists calendar_id text;
