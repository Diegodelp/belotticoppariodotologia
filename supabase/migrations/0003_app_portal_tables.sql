-- Step 3: Simplified application tables used by the Next.js portal
-- These tables provide a pragmatic bridge while we finish wiring the
-- richer clinical schema defined in 0001_create_core_schema.sql.

create table if not exists public.app_professionals (
  id uuid primary key default uuid_generate_v4(),
  dni text not null unique,
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_patients (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.app_professionals(id) on delete cascade,
  dni text,
  first_name text not null,
  last_name text not null,
  email text,
  password_hash text,
  phone text,
  address text,
  health_insurance text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.app_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger app_patients_set_updated_at
before update on public.app_patients
for each row execute function public.app_set_updated_at();

create table if not exists public.app_appointments (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.app_professionals(id) on delete cascade,
  patient_id uuid references public.app_patients(id) on delete set null,
  title text not null,
  status text not null default 'confirmed',
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_treatments (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.app_professionals(id) on delete cascade,
  patient_id uuid not null references public.app_patients(id) on delete cascade,
  type text not null,
  description text,
  cost numeric(12,2) not null,
  treatment_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_payments (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.app_professionals(id) on delete cascade,
  patient_id uuid not null references public.app_patients(id) on delete cascade,
  amount numeric(12,2) not null,
  method text not null,
  status text not null default 'completed',
  payment_date timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_two_factor_codes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  user_type text not null check (user_type in ('profesional', 'paciente')),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_two_factor_codes_user_idx
  on public.app_two_factor_codes(user_id, user_type);

create index if not exists app_two_factor_codes_email_idx
  on public.app_two_factor_codes(email);

