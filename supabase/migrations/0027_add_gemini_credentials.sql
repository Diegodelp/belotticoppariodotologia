-- Gemini OAuth credentials per professional
create table if not exists public.professional_gemini_credentials (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  google_user_id text not null,
  email text,
  access_token text not null,
  refresh_token text not null,
  scope text,
  token_type text,
  expiry_date timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create trigger set_timestamp
before update on public.professional_gemini_credentials
for each row execute function public.set_updated_at();

alter table public.professional_gemini_credentials enable row level security;

create policy "Gemini credenciales select" on public.professional_gemini_credentials
  for select using (professional_id = auth.uid());

create policy "Gemini credenciales insert" on public.professional_gemini_credentials
  for insert with check (professional_id = auth.uid());

create policy "Gemini credenciales update" on public.professional_gemini_credentials
  for update using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy "Gemini credenciales delete" on public.professional_gemini_credentials
  for delete using (professional_id = auth.uid());
