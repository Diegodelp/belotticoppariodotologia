-- Add signature metadata to clinical histories
alter table if exists public.clinical_histories
  add column if not exists signature_clarification text,
  add column if not exists signature_path text,
  add column if not exists signature_uploaded_at timestamp with time zone;
