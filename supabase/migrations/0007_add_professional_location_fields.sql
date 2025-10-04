-- Add optional geographic fields for professional profiles
alter table if exists public.professionals
  add column if not exists country text;

alter table if exists public.professionals
  add column if not exists province text;

alter table if exists public.professionals
  add column if not exists locality text;
