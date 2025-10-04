-- Replace Gemini OAuth credentials with encrypted API keys
-- Existing OAuth tokens are no longer required, so we wipe the table and store
-- per-professional API keys encrypted with their master key version.
truncate table public.professional_gemini_credentials;

alter table public.professional_gemini_credentials
  drop column if exists google_user_id,
  drop column if exists email,
  drop column if exists access_token,
  drop column if exists refresh_token,
  drop column if exists scope,
  drop column if exists token_type,
  drop column if exists expiry_date;

alter table public.professional_gemini_credentials
  add column if not exists api_key_ciphertext text,
  add column if not exists api_key_iv text,
  add column if not exists api_key_version integer,
  add column if not exists label text,
  add column if not exists last_used_at timestamp with time zone;

alter table public.professional_gemini_credentials
  alter column api_key_ciphertext set not null,
  alter column api_key_iv set not null,
  alter column api_key_version set not null;

alter table public.professional_gemini_credentials
  alter column api_key_version set default 1;
