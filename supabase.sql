-- Opepen World Cup (React + Privy) — Supabase setup
-- Run once: Dashboard → SQL Editor → New query → paste → Run.
-- Creates the single key/value table the app shares (the match + every vote),
-- opens it for the public anon key, and turns on realtime so tallies update live.

create table if not exists public.kv (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

alter table public.kv enable row level security;

-- ── DEV / OPEN policy (honour system) ─────────────────────────────────────────
-- Anyone using the site (the public anon key) can read and write. Simplest setup
-- and matches a fun, open voting app. Fine for a prototype / friendly event.
drop policy if exists "public read"  on public.kv;
drop policy if exists "public write" on public.kv;

create policy "public read"  on public.kv for select using (true);
create policy "public write" on public.kv for all    using (true) with check (true);

-- Turn on realtime so votes/results update without a refresh.
-- (If this errors with "already member", the table is already published — ignore.)
alter publication supabase_realtime add table public.kv;

-- ── PRODUCTION integrity (recommended) ────────────────────────────────────────
-- For a real event you want writes scoped to authenticated Privy users so each
-- person can only write their own per-user keys. Privy can act as a third-party
-- auth provider: configure Privy to mint a JWT and add it to Supabase under
--   Authentication → Sign In / Providers → Third-party Auth (add your Privy issuer/JWKS).
-- Then send that token as the Supabase access token from the client (e.g.
--   supabase.auth.setSession / a custom fetch Authorization header), and replace
-- the open "public write" policy above with scoped policies. Example sketch:
--
--   -- Anyone can read aggregate data (votes/chat/comments/players are public):
--   create policy "auth read"  on public.kv for select using (true);
--
--   -- Only an authenticated Privy user may write, and only rows keyed to their id.
--   -- The Privy subject is available as auth.jwt() ->> 'sub'  (e.g. 'privy:abc123').
--   -- The app keys per-user vote rows as  vote:<matchId>:privy:<sub>  and player rows
--   -- as  player:privy:<sub>  — so a write check can require the key to embed the
--   -- caller's own subject:
--   create policy "owner write" on public.kv for all
--     to authenticated
--     using ( true )
--     with check ( key like ('%' || (auth.jwt() ->> 'sub')) );
--
-- Adjust the LIKE/key convention to your exact key format. The goal: a user can
-- only upsert/delete rows that embed their own Privy subject, preventing vote and
-- profile spoofing while still letting everyone read the shared tallies.
