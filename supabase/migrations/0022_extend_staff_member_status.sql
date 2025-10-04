-- Extend staff member lifecycle to support inactive and removed states with auditing
alter table if exists public.staff_members
  drop constraint if exists staff_members_status_check;

alter table if exists public.staff_members
  add constraint staff_members_status_check
    check (status in ('active', 'inactive', 'removed', 'invited'));

alter table if exists public.staff_members
  alter column status set default 'active';

alter table if exists public.staff_members
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz;

update public.staff_members
set status_changed_at = coalesce(status_changed_at, updated_at, created_at);

create index if not exists idx_staff_members_status on public.staff_members(status);
