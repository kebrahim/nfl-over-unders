-- Keeps profiles.email in sync when a user's Supabase Auth email
-- actually changes. auth.users.email only updates once Supabase's
-- built-in email-change confirmation flow completes (supabase.auth.
-- updateUser({ email }) just requests the change and sends a
-- confirmation link) — this trigger fires at that point, mirroring how
-- handle_new_user (0001_init.sql) seeds it on signup.
create function sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function sync_profile_email();
