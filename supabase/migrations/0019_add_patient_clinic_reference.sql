-- Add clinic reference to patients for consultorio assignments
alter table public.patients
  add column if not exists clinic_id uuid references clinics(id) on delete set null,
  add column if not exists clinic_name text;

create index if not exists patients_clinic_id_idx on public.patients(clinic_id);
