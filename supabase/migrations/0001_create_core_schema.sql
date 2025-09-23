-- Step 1: Core relational schema for Dentalist on Supabase
-- Run with: supabase db push or psql

-- Enable required extensions -------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Domains & enums -------------------------------------------------------------
create type public.patient_status as enum ('active', 'inactive', 'pending', 'archived');
create type public.treatment_stage as enum ('baseline', 'initial', 'intermediate', 'final');
create type public.media_category as enum ('photo', 'radiograph', 'document');
create type public.media_label as enum (
  'frente', 'izquierdo', 'derecho', 'panoramica', 'teleradiografia',
  'perfil', 'inicial', 'final', 'otros'
);

-- Professionals ---------------------------------------------------------------
create table if not exists public.professionals (
  id uuid primary key default auth.uid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clinic_name text,
  license_number text,
  phone text,
  address text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists professionals_user_id_idx on public.professionals(user_id);

-- Patients --------------------------------------------------------------------
create table if not exists public.patients (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  url_id text unique,
  first_name text not null,
  last_name text not null,
  dni text,
  email text,
  phone text,
  address text,
  obra_social text,
  afiliado text,
  status public.patient_status not null default 'pending',
  two_factor_enabled boolean not null default false,
  monthly_fee numeric(12,2),
  outstanding_balance numeric(12,2) default 0,
  start_date date,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists patients_professional_id_idx on public.patients(professional_id);
create index if not exists patients_email_idx on public.patients(email);

-- Patient credentials (optional local login for patient portal) ---------------
create table if not exists public.patient_credentials (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  password_hash text not null,
  two_factor_secret text,
  last_login_at timestamp with time zone
);

-- Orthodontic plans -----------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  name text not null,
  description text,
  total_amount numeric(12,2),
  down_payment numeric(12,2),
  monthly_fee numeric(12,2),
  duration_months integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists plans_professional_id_idx on public.plans(professional_id);

create table if not exists public.patient_plans (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  custom_plan jsonb,
  entrega_date date,
  cuota numeric(12,2),
  start_date date,
  update_date date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(patient_id)
);

-- Treatments & payments -------------------------------------------------------
create table if not exists public.treatments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  title text not null,
  description text,
  status text,
  start_date date,
  end_date date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists treatments_patient_id_idx on public.treatments(patient_id);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  treatment_id uuid references public.treatments(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'ARS',
  due_date date,
  paid_at timestamp with time zone,
  method text,
  reference text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists payments_patient_id_idx on public.payments(patient_id);
create index if not exists payments_professional_id_idx on public.payments(professional_id);

-- Two factor codes ------------------------------------------------------------
create table if not exists public.two_factor_codes (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid references public.professionals(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists two_factor_codes_email_idx on public.two_factor_codes(email);

-- Clinical history ------------------------------------------------------------
create table if not exists public.clinical_histories (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  summary text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists clinical_histories_patient_id_idx on public.clinical_histories(patient_id);

create table if not exists public.cephalometric_records (
  id uuid primary key default uuid_generate_v4(),
  clinical_history_id uuid not null references public.clinical_histories(id) on delete cascade,
  stage public.treatment_stage not null,
  biotipo text,
  patron_esqueletal text,
  sna text,
  snb text,
  anb text,
  na_mm text,
  na_angle text,
  nb_mm text,
  nb_angle text,
  plano_mandibular text,
  recorded_at timestamp with time zone not null default now(),
  unique(clinical_history_id, stage)
);

-- Clinical media (photos, radiographs, documents) -----------------------------
create table if not exists public.clinical_media (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  category public.media_category not null,
  label public.media_label not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size integer,
  uploaded_by uuid references public.professionals(id) on delete set null,
  uploaded_at timestamp with time zone not null default now(),
  valid_until date,
  notes text
);

create index if not exists clinical_media_patient_idx on public.clinical_media(patient_id);
create index if not exists clinical_media_professional_idx on public.clinical_media(professional_id);

-- Clinical documents (PDFs, etc.) ---------------------------------------------
create table if not exists public.clinical_documents (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  clinical_history_id uuid references public.clinical_histories(id) on delete set null,
  title text not null,
  description text,
  storage_path text not null,
  mime_type text,
  uploaded_at timestamp with time zone not null default now(),
  uploaded_by uuid references public.professionals(id) on delete set null
);

-- Appointments metadata -------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references public.patients(id) on delete set null,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  google_event_id text,
  status text not null default 'scheduled',
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  location text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists appointments_professional_idx on public.appointments(professional_id);
create index if not exists appointments_google_event_id_idx on public.appointments(google_event_id);

-- Audit triggers --------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_timestamp
before update on public.professionals
for each row execute function public.set_updated_at();

create trigger set_timestamp
before update on public.patients
for each row execute function public.set_updated_at();

create trigger set_timestamp
before update on public.plans
for each row execute function public.set_updated_at();

create trigger set_timestamp
before update on public.patient_plans
for each row execute function public.set_updated_at();

create trigger set_timestamp
before update on public.treatments
for each row execute function public.set_updated_at();

create trigger set_timestamp
before update on public.payments
for each row execute function public.set_updated_at();

create trigger set_timestamp
before update on public.clinical_histories
for each row execute function public.set_updated_at();

create trigger set_timestamp
before update on public.appointments
for each row execute function public.set_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.professionals enable row level security;
alter table public.patients enable row level security;
alter table public.patient_credentials enable row level security;
alter table public.plans enable row level security;
alter table public.patient_plans enable row level security;
alter table public.treatments enable row level security;
alter table public.payments enable row level security;
alter table public.two_factor_codes enable row level security;
alter table public.clinical_histories enable row level security;
alter table public.cephalometric_records enable row level security;
alter table public.clinical_media enable row level security;
alter table public.clinical_documents enable row level security;
alter table public.appointments enable row level security;

-- Helper function to check professional ownership ----------------------------
create or replace function public.is_professional_member(professional uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.professionals p
    where p.id = professional and p.user_id = auth.uid()
  );
$$;

grant execute on function public.is_professional_member to authenticated;

grant usage on type public.patient_status to authenticated;
grant usage on type public.treatment_stage to authenticated;
grant usage on type public.media_category to authenticated;
grant usage on type public.media_label to authenticated;

-- Policies -------------------------------------------------------------------
create policy "Professionals can manage themselves"
  on public.professionals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Professionals manage their patients"
  on public.patients
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));

create policy "Professionals manage patient credentials"
  on public.patient_credentials
  for all
  using (public.is_professional_member((select professional_id from public.patients where id = patient_id)))
  with check (public.is_professional_member((select professional_id from public.patients where id = patient_id)));

create policy "Professionals manage their plans"
  on public.plans
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));

create policy "Professionals manage patient plans"
  on public.patient_plans
  for all
  using (public.is_professional_member((select professional_id from public.patients where id = patient_id)))
  with check (public.is_professional_member((select professional_id from public.patients where id = patient_id)));

create policy "Professionals manage treatments"
  on public.treatments
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));

create policy "Professionals manage payments"
  on public.payments
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));

create policy "Professionals manage 2FA codes"
  on public.two_factor_codes
  for all
  using (public.is_professional_member(coalesce(professional_id, (select professional_id from public.patients where id = patient_id))))
  with check (public.is_professional_member(coalesce(professional_id, (select professional_id from public.patients where id = patient_id))));

create policy "Professionals manage clinical histories"
  on public.clinical_histories
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));

create policy "Professionals manage cephalometric records"
  on public.cephalometric_records
  for all
  using (public.is_professional_member((select professional_id from public.clinical_histories where id = clinical_history_id)))
  with check (public.is_professional_member((select professional_id from public.clinical_histories where id = clinical_history_id)));

create policy "Professionals manage clinical media"
  on public.clinical_media
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));

create policy "Professionals manage clinical documents"
  on public.clinical_documents
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));

create policy "Professionals manage appointments"
  on public.appointments
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));

-- Index to find patients by URL id quickly ------------------------------------
create index if not exists patients_url_id_idx on public.patients(url_id);

-- Sample storage policies (executed separately in Supabase dashboard) ---------
-- Uncomment and adapt bucket names as needed
-- insert into storage.buckets(id, name, public) values ('clinical-media', 'clinical-media', false);
-- create policy "Authenticated users can access their media"
--   on storage.objects for select using (
--     bucket_id = 'clinical-media' and
--     (metadata->>'professional_id')::uuid in (
--       select id from public.professionals where user_id = auth.uid()
--     )
--   );

