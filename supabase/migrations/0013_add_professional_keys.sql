-- Per-professional encryption key storage
create table if not exists public.professional_keys (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  encrypted_key text not null,
  key_iv text not null,
  version integer not null default 1,
  rotated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create trigger set_timestamp
before update on public.professional_keys
for each row execute function public.set_updated_at();

alter table public.professional_keys enable row level security;

create policy "Profesional gestiona su clave" on public.professional_keys
  for select using (professional_id = auth.uid());

create policy "Profesional rota su clave" on public.professional_keys
  for update using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy "Profesional inicializa su clave" on public.professional_keys
  for insert with check (professional_id = auth.uid());
