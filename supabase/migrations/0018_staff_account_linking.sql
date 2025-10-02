-- Link staff members with their authenticated profile and owner accounts
alter table if exists public.professionals
  add column if not exists owner_professional_id uuid references public.professionals(id) on delete set null;

alter table if exists public.staff_members
  add column if not exists member_professional_id uuid references public.professionals(id) on delete cascade;

create unique index if not exists staff_members_member_professional_idx
  on public.staff_members(member_professional_id);

alter table if exists public.staff_members
  add constraint staff_members_owner_member_unique
  unique (owner_professional_id, member_professional_id);

alter table if exists public.staff_members
  add constraint staff_members_owner_email_unique
  unique (owner_professional_id, email);
