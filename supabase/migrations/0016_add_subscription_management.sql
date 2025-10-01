-- Ensure professional records store subscription metadata for trials and paid plans
alter table if exists public.professionals
  add column if not exists dni text,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists password_hash text,
  add column if not exists subscription_plan text not null default 'starter',
  add column if not exists subscription_status text not null default 'trialing',
  add column if not exists trial_started_at timestamp with time zone not null default now(),
  add column if not exists trial_ends_at timestamp with time zone not null default (now() + interval '30 days'),
  add column if not exists subscription_locked_at timestamp with time zone,
  add column if not exists subscription_notes text;

create index if not exists professionals_subscription_status_idx
  on public.professionals(subscription_status);
