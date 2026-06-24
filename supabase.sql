-- Run this in the Supabase SQL Editor (Dashboard -> SQL -> New query -> Run).
-- Creates the single key/value table the app uses for all shared data.

create table if not exists public.kv (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table public.kv enable row level security;

-- Office honour-system pool: anyone with the site can read/write.
-- (The browser uses the public "anon" key, so these policies are required.)
-- For stricter control later, replace these with authenticated policies.
drop policy if exists "public read" on public.kv;
drop policy if exists "public insert" on public.kv;
drop policy if exists "public update" on public.kv;
drop policy if exists "public delete" on public.kv;

create policy "public read"   on public.kv for select using (true);
create policy "public insert" on public.kv for insert with check (true);
create policy "public update" on public.kv for update using (true) with check (true);
create policy "public delete" on public.kv for delete using (true);
