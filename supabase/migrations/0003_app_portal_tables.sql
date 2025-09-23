-- Step 3: Tablas base utilizadas por el portal Next.js
-- Se utilizan los nombres históricos (profesionales, pacientes, etc.)
-- para ser compatibles con la estructura que ya tenías en Firebase/Supabase.

create table if not exists public.profesionales (
  id uuid primary key default uuid_generate_v4(),
  dni text not null unique,
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pacientes (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.profesionales(id) on delete cascade,
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

create or replace function public.portal_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pacientes_set_updated_at
before update on public.pacientes
for each row execute function public.portal_set_updated_at();

create table if not exists public.turnos (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.profesionales(id) on delete cascade,
  patient_id uuid references public.pacientes(id) on delete set null,
  title text not null,
  status text not null default 'confirmed',
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tratamientos (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.profesionales(id) on delete cascade,
  patient_id uuid not null references public.pacientes(id) on delete cascade,
  type text not null,
  description text,
  cost numeric(12,2) not null,
  treatment_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pagos (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.profesionales(id) on delete cascade,
  patient_id uuid not null references public.pacientes(id) on delete cascade,
  amount numeric(12,2) not null,
  method text not null,
  status text not null default 'completed',
  payment_date timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.codigos_doble_factor (
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

create index if not exists codigos_doble_factor_user_idx
  on public.codigos_doble_factor(user_id, user_type);

create index if not exists codigos_doble_factor_email_idx
  on public.codigos_doble_factor(email);
