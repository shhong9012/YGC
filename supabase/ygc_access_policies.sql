-- Run in the YGC project's Supabase SQL Editor as postgres.
-- Changes database access policies only. Gallery storage is configured separately.
begin;

do $migration$
declare
  app_tables constant text[] := array[
    'awards', 'cart_teams', 'expenses', 'hat_history', 'members',
    'round_attendees', 'rounds', 'scores', 'settings'
  ];
  app_table text;
begin
  if not exists (
    select 1 from public.allowed_users
    where role = 'admin' and btrim(email::text) <> ''
  ) then
    raise exception 'No administrator email is registered in public.allowed_users';
  end if;

  -- Abort if policies have changed since review. Unknown permissive policies
  -- could otherwise grant access alongside the new ones.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and (
        (tablename = 'allowed_users'
          and policyname not in ('Authenticated read', 'YGC read own access'))
        or
        (tablename::text = any(app_tables)
          and policyname not in ('Allow all', 'YGC member read', 'YGC admin access'))
      )
  ) then
    raise exception 'Unexpected YGC access policy; review pg_policies before applying';
  end if;

  alter table public.allowed_users enable row level security;
  revoke all privileges on table public.allowed_users from public, anon, authenticated;
  grant select on table public.allowed_users to authenticated;
  drop policy if exists "Authenticated read" on public.allowed_users;
  drop policy if exists "YGC read own access" on public.allowed_users;
  create policy "YGC read own access"
    on public.allowed_users for select to authenticated
    using (
      (select auth.uid()) is not null
      and email = (select auth.jwt() ->> 'email')
    );

  foreach app_table in array app_tables loop
    execute format('alter table public.%I enable row level security', app_table);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', app_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', app_table);

    execute format('drop policy if exists "Allow all" on public.%I', app_table);
    execute format('drop policy if exists "YGC member read" on public.%I', app_table);
    execute format('drop policy if exists "YGC admin access" on public.%I', app_table);

    -- RLS on allowed_users limits the subquery to the caller's own row.
    execute format($policy$
      create policy "YGC member read" on public.%I
        for select to authenticated
        using (exists (
          select 1 from public.allowed_users
          where nullif(role::text, '') is not null
        ))
    $policy$, app_table);

    execute format($policy$
      create policy "YGC admin access" on public.%I
        for all to authenticated
        using (exists (select 1 from public.allowed_users where role = 'admin'))
        with check (exists (select 1 from public.allowed_users where role = 'admin'))
    $policy$, app_table);
  end loop;
end;
$migration$;

commit;

select 'YGC access policies applied' as result;
