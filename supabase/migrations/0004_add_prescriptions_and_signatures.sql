-- Add prescription storage and professional signatures

create table if not exists public.professional_signatures (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  file_size integer,
  updated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.prescriptions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  title text not null,
  diagnosis text,
  medication text not null,
  instructions text not null,
  notes text,
  document_path text not null,
  signature_path text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists prescriptions_patient_idx on public.prescriptions(patient_id);
create index if not exists prescriptions_professional_idx on public.prescriptions(professional_id);

alter table public.professional_signatures enable row level security;
alter table public.prescriptions enable row level security;

create policy "Professional owns signature"
  on public.professional_signatures
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy "Professional manages prescriptions"
  on public.prescriptions
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());


grant select, insert, update, delete on table public.professional_signatures to authenticated, service_role;
grant select, insert, update, delete on table public.prescriptions to authenticated, service_role;

