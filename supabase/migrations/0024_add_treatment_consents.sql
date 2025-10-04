-- Add consent metadata for treatments
alter table public.treatments
  add column if not exists consent_template_path text,
  add column if not exists consent_template_name text,
  add column if not exists consent_signature_path text,
  add column if not exists consent_patient_name text,
  add column if not exists consent_signed_at timestamptz,
  add column if not exists consent_status text default 'signed';

update public.treatments
set consent_status = 'signed'
where consent_template_path is not null
  and consent_status is null;
