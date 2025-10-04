alter table if exists public.appointments
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

create index if not exists appointments_clinic_id_idx on public.appointments(clinic_id);
