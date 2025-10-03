-- Google Calendar OAuth credentials per professional
create table if not exists public.professional_google_credentials (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  google_user_id text not null,
  email text,
  calendar_id text,
  access_token text not null,
  refresh_token text not null,
  scope text,
  token_type text,
  expiry_date timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (professional_id)
);

create index if not exists professional_google_credentials_professional_id_idx
  on public.professional_google_credentials(professional_id);

create index if not exists professional_google_credentials_google_user_id_idx
  on public.professional_google_credentials(google_user_id);
