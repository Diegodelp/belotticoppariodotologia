-- Step 10: patient registration invites

create table if not exists public.patient_invites (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  token_hash text not null,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists patient_invites_token_hash_idx on public.patient_invites(token_hash);
create index if not exists patient_invites_professional_idx on public.patient_invites(professional_id);

alter table public.patient_invites enable row level security;

create policy "Professionals manage patient invites"
  on public.patient_invites
  for all
  using (public.is_professional_member(professional_id))
  with check (public.is_professional_member(professional_id));
