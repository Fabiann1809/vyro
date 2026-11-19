-- Deleting what belongs to a person (D21). A signed-in person cannot remove their own account with
-- the public key (that takes a secret key, which must never be in the app), so these two functions do
-- it for them. They run with the rights of their owner, but they only ever touch the rows of the one
-- who calls (auth.uid()), they refuse a call without a session, and they use no search path so that
-- nothing can be swapped under them.

-- Erases everything that the account has synced and leaves the account as it is. The children of a
-- row (repetitions, errors, steps) go with it.
create or replace function public.delete_my_cloud_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from public.sessions where user_id = auth.uid();
  delete from public.learning_paths where user_id = auth.uid();
  delete from public.custom_skills where user_id = auth.uid();
end;
$$;

-- Erases the account itself. Its synced data goes with it: every table points at the account with
-- "on delete cascade".
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_cloud_data() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_cloud_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
