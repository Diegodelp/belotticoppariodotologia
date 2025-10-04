alter table if exists public.professionals
  add column if not exists time_zone text;

update public.professionals
   set time_zone = coalesce(time_zone, 'America/Argentina/Buenos_Aires');
