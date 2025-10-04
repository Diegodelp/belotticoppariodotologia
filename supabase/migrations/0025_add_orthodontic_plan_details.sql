-- Extend patient orthodontic plan assignments with treatment details
alter table if exists public.patient_orthodontic_plans
  add column if not exists treatment_goal text,
  add column if not exists appliance text,
  add column if not exists control_frequency text,
  add column if not exists estimated_duration text,
  add column if not exists plan_notes text;
