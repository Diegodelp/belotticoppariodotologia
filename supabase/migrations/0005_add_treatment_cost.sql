alter table if exists public.treatments
  add column if not exists cost numeric(12,2) default 0 not null;

create index if not exists treatments_cost_idx on public.treatments(cost);
