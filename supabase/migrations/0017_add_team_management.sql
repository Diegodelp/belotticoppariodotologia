-- Gestion de consultorios y equipo
create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  owner_professional_id uuid not null references professionals(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz,
  constraint clinics_owner_name_unique unique (owner_professional_id, name)
);

create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  owner_professional_id uuid not null references professionals(id) on delete cascade,
  clinic_id uuid references clinics(id) on delete set null,
  full_name text,
  email text,
  role text not null check (role in ('admin','professional','assistant')),
  status text not null default 'active' check (status in ('active','invited')),
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz
);

create table if not exists staff_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_professional_id uuid not null references professionals(id) on delete cascade,
  clinic_id uuid references clinics(id) on delete set null,
  email text,
  role text not null check (role in ('admin','professional','assistant')),
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  invited_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  accepted_at timestamptz,
  token_hash text not null unique
);

create index if not exists idx_staff_members_owner on staff_members(owner_professional_id);
create index if not exists idx_staff_members_clinic on staff_members(clinic_id);
create index if not exists idx_staff_invitations_owner on staff_invitations(owner_professional_id);
create index if not exists idx_staff_invitations_clinic on staff_invitations(clinic_id);
