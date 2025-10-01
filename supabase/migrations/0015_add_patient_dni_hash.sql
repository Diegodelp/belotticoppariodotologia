-- Add a deterministic hash for patient DNI values so we can mask the
-- plaintext column while still supporting lookups (e.g. login).
alter table public.patients
  add column if not exists dni_hash text;

create index if not exists patients_dni_hash_idx on public.patients(dni_hash);

update public.patients
set dni_hash = encode(digest(trim(dni), 'sha256'), 'hex')
where dni_hash is null
  and dni is not null
  and length(trim(dni)) > 0;
