-- Run AFTER supabase.sql, in the Supabase SQL Editor.
-- 1) Reject any sign-up whose email is not @showit.com (enforced in the database,
--    so it cannot be bypassed from the browser).
-- 2) Restrict the pool data so only signed-in users can read/write it.

-- ---- 1) Domain allowlist -------------------------------------------------
create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.email is null or lower(new.email) not like '%@showit.com' then
    raise exception 'Only @showit.com email addresses are allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_domain on auth.users;
create trigger enforce_email_domain
  before insert on auth.users
  for each row execute function public.enforce_email_domain();

-- ---- 2) Lock the kv table to authenticated users -------------------------
drop policy if exists "public read"   on public.kv;
drop policy if exists "public insert" on public.kv;
drop policy if exists "public update" on public.kv;
drop policy if exists "public delete" on public.kv;

create policy "auth read"   on public.kv for select to authenticated using (true);
create policy "auth insert" on public.kv for insert to authenticated with check (true);
create policy "auth update" on public.kv for update to authenticated using (true) with check (true);
create policy "auth delete" on public.kv for delete to authenticated using (true);

-- Note: if the trigger errors with a permissions/ownership message, your project may
-- restrict triggers on auth.users. In that case use Authentication -> Hooks ->
-- "Before User Created" and call enforce_email_domain() there instead.
