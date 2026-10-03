create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approved is distinct from old.approved and auth.uid() is not null and not public.has_role(auth.uid(),'admin') then
    new.approved := old.approved;
  end if;
  return new;
end $$;
revoke execute on function public.protect_profile() from anon, authenticated, public;