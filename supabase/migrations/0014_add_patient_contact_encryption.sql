-- Add encrypted contact payload columns for patients
alter table public.patients
  add column if not exists contact_payload_ciphertext text,
  add column if not exists contact_payload_iv text,
  add column if not exists contact_payload_version integer;

create index if not exists patients_contact_payload_version_idx
  on public.patients(contact_payload_version);
