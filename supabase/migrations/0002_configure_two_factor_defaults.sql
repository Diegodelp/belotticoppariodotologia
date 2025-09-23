-- Step 2: Configure email OTP defaults

-- Ensure two-factor codes expire after five minutes by default
alter table public.two_factor_codes
  alter column expires_at set default (now() + interval '5 minutes');

-- Clean up any lingering codes automatically every hour (optional helper view)
create or replace view public.expired_two_factor_codes as
select *
from public.two_factor_codes
where expires_at < now() and consumed_at is null;
