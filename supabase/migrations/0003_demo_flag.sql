alter table profiles add column is_demo boolean not null default false;

-- Prevent a signed-in user from self-escalating privileges by calling
-- profiles.update() directly with the anon key (the existing "users can
-- update their own profile" policy only checks auth.uid() = id, which
-- would otherwise let anyone flip their own is_commissioner or is_demo).
-- Direct SQL editor / service-role writes are unaffected since those run
-- outside the 'authenticated' request role.
create function protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    new.is_commissioner := old.is_commissioner;
    new.is_demo := old.is_demo;
  end if;
  return new;
end;
$$;

create trigger protect_profile_privileges
  before update on profiles
  for each row execute function protect_privileged_profile_columns();
