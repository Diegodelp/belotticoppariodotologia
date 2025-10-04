-- Expand clinical history metadata with medical background, family history and odontogram data
alter table if exists public.clinical_histories
  add column if not exists reason_for_consultation text,
  add column if not exists medical_background jsonb,
  add column if not exists family_history jsonb,
  add column if not exists allergies text,
  add column if not exists odontogram jsonb;
