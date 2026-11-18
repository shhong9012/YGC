-- Run once in the YGC Supabase SQL Editor after ygc_access_policies.sql.
-- Existing account roles and club rules are preserved at installation.
begin;

do $check$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'allowed_users'
      and policyname = 'YGC read own access'
  ) or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename in ('allowed_users', 'settings')
      and policyname in ('Allow all', 'Authenticated read')
  ) or has_table_privilege('anon', 'public.allowed_users', 'SELECT')
     or has_table_privilege('authenticated', 'public.allowed_users', 'INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('anon', 'public.settings', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Apply ygc_access_policies.sql before enabling site administration';
  end if;
end;
$check$;

-- The allowlist's ordinary SELECT policy exposes only the caller's own row.
-- These two functions let a verified administrator manage that list.
create or replace function public.ygc_admin_list_accounts()
returns table(email text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.allowed_users as account
    where account.email = (select auth.jwt() ->> 'email') and account.role = 'admin'
  ) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
    select account.email::text, account.role::text from public.allowed_users as account
    order by (account.role = 'admin') desc, account.email;
end;
$function$;

create or replace function public.ygc_admin_assign_account(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_email text := lower(btrim(p_email));
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.allowed_users as account
    where account.email = (select auth.jwt() ->> 'email') and account.role = 'admin'
  ) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  if target_email is null or char_length(target_email) > 254
     or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid Google login email' using errcode = '22023';
  end if;

  -- Serialize administrator assignments even if an older allowlist lacks a unique index.
  lock table public.allowed_users in share row exclusive mode;
  if not exists (
    select 1 from public.allowed_users as account
    where account.email = (select auth.jwt() ->> 'email') and account.role = 'admin'
  ) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  update public.allowed_users as account set role = 'admin'
    where account.email = target_email;
  if not found then
    insert into public.allowed_users(email, role) values (target_email, 'admin');
  end if;
end;
$function$;

create or replace function public.ygc_save_club_rules(p_content text, p_previous text)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  entry public.settings%rowtype;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.allowed_users as account
    where account.email = (select auth.jwt() ->> 'email') and account.role = 'admin'
  ) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  if p_content is null or btrim(p_content, E' \t\n\r') = '' or char_length(p_content) > 50000 then
    raise exception 'Rules must be between 1 and 50000 characters' using errcode = '22023';
  end if;

  -- Convert the text to the settings column's native type (text or JSON).
  select * into entry from jsonb_populate_record(
    null::public.settings, jsonb_build_object('key', 'club_rules_text', 'value', p_content)
  );
  update public.settings as s set value = entry.value
    where s.key = entry.key and (to_jsonb(s.value) #>> '{}') is not distinct from p_previous;
  if found then return; end if;

  if p_previous is null then
    insert into public.settings(key, value) values (entry.key, entry.value)
      on conflict (key) do nothing;
    if found then return; end if;
  end if;

  raise exception 'Club rules have changed since editing started' using errcode = '40001';
end;
$function$;

revoke all on function public.ygc_admin_list_accounts() from public, anon, authenticated;
revoke all on function public.ygc_admin_assign_account(text) from public, anon, authenticated;
revoke all on function public.ygc_save_club_rules(text, text) from public, anon, authenticated;
grant execute on function public.ygc_admin_list_accounts() to authenticated;
grant execute on function public.ygc_admin_assign_account(text) to authenticated;
grant execute on function public.ygc_save_club_rules(text, text) to authenticated;

notify pgrst, 'reload schema';
commit;

select 'YGC site administration enabled' as result;
