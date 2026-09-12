-- Tracks phone-number opt-out state reported by Twilio's inbound
-- webhook (STOP/START replies to the group text thread). Set only by
-- the webhook handler (src/app/api/twilio/inbound/route.ts) using the
-- service role — never by a direct user profile edit.
alter table profiles add column sms_opted_out_at timestamptz;

-- Extend the self-escalation guard from 0003_demo_flag.sql so a
-- signed-in user can't fake or clear their own opt-out status by
-- calling profiles.update() directly with the anon key.
create or replace function protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    new.is_commissioner := old.is_commissioner;
    new.is_demo := old.is_demo;
    new.sms_opted_out_at := old.sms_opted_out_at;
  end if;
  return new;
end;
$$;
