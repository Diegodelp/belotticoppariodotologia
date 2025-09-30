-- Create orthodontic plans and budgets support

create table if not exists public.orthodontic_plans (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  name text not null,
  monthly_fee numeric(10,2) not null,
  has_initial_fee boolean not null default false,
  initial_fee numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists orthodontic_plans_professional_name_idx
  on public.orthodontic_plans (professional_id, lower(name));

create table if not exists public.patient_orthodontic_plans (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  plan_id uuid not null references public.orthodontic_plans(id) on delete cascade,
  plan_name text not null,
  monthly_fee numeric(10,2) not null,
  has_initial_fee boolean not null default false,
  initial_fee numeric(10,2),
  assigned_at timestamptz not null default now(),
  unique(patient_id)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  notes text,
  total numeric(10,2) not null default 0,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  practice text not null,
  description text,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists budget_items_budget_id_idx on public.budget_items (budget_id);

-- updated_at triggers
create trigger set_orthodontic_plans_updated_at
before update on public.orthodontic_plans
for each row execute function public.set_updated_at();

create trigger set_budgets_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();
