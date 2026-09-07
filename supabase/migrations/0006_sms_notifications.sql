-- Phone numbers for SMS/MMS group-thread notifications (E.164, e.g.
-- +15551234567). Each player sets their own from /my-picks; the existing
-- "users can update their own profile" policy (0001_init.sql) already
-- allows this, and it isn't a privileged column, so the self-escalation
-- trigger from 0003_demo_flag.sql doesn't touch it.
alter table profiles add column phone text;

-- Single-row-per-key settings table. Currently holds the Twilio
-- Conversation SID for the group MMS thread, created once by the
-- commissioner from /admin. No RLS policies are defined on purpose: RLS
-- is enabled with an empty policy set, so anon/authenticated clients get
-- nothing and only the service role (used server-side, after our own
-- commissioner check) can read or write it.
create table app_settings (
  key text primary key,
  value text
);

alter table app_settings enable row level security;
