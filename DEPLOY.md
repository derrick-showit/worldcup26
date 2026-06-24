# Deploy — Opepen World Cup

The live product: a Vite + React app with **Privy** logins (email / social / wallet + embedded
wallets) and **Supabase** for shared, persistent voting. Hosts on **Vercel**.

You need free accounts on: GitHub, Supabase, Privy (dashboard.privy.io), and Vercel.
You create the accounts and paste the keys — they're never committed to the repo.

---

## 1. Push the repo to GitHub

Unzip and push to a new repo. The root must contain:

```
index.html
vercel.json          # SPA rewrite + caching (already included)
package.json
vite.config.js
src/
public/assets/teams/ # the 40 team images
supabase.sql         # database setup
DEPLOY.md / README.md
```

## 2. Supabase (shared data)

1. Create a free project; wait for it to provision.
2. **SQL Editor → New query** → paste [`supabase.sql`](./supabase.sql) → **Run** (creates the `kv`
   table, opens it to the public key, enables realtime).
3. **Project Settings → API** → copy the **Project URL** and the **anon / publishable key**.

## 3. Privy (logins + embedded wallets)

1. Create an app at **dashboard.privy.io** → copy the **App ID**.
2. **Login methods**: enable Email, Google, Apple, Twitter/X, and External wallets.
3. **Embedded wallets**: turn on "create for users without a wallet" (so email/social users get a
   wallet automatically).
4. **Allowed origins / Redirect URLs**: you'll add your live domain in step 6 (you can add
   `http://localhost:5173` now for local dev).

## 4. Environment variables

Three values (the same three locally and on Vercel):

| Name | From |
|---|---|
| `VITE_PRIVY_APP_ID` | Privy dashboard |
| `VITE_SUPABASE_URL` | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API (anon/public) |

Local dev: `cp .env.example .env`, fill them in, then `npm install && npm run dev`.

## 5. Vercel

1. **Add New → Project** → import the GitHub repo.
2. Framework preset **Vite** (build `npm run build`, output `dist`) — `vercel.json` already sets
   this plus the SPA rewrite and asset caching.
3. **Settings → Environment Variables**: add the three `VITE_*` vars.
4. **Deploy** → you get a URL like `your-app.vercel.app`.

## 6. Wire the live domain back to Privy

Add your Vercel URL (and any custom domain) to Privy's **Allowed origins / Redirect URLs**. No
redeploy needed. (If you later use Supabase Auth emails, add the URL there too.)

## 7. Smoke test

- Open the URL; the browser console should log `data mode: shared (Supabase)`.
- Log in with email, a social, and a wallet (embedded wallet should appear for email/social).
- Vote from two different browsers and confirm tallies sync live; confirm the bracket advances at
  full time.

---

## Before a real public launch

- **Tournament start time.** `START_BASE` in `src/lib/game.js` is in **demo mode** (a match reads
  as "live" right now). Set it to your real first-kickoff time — the commented future-date version
  is right above it. Matches run back-to-back: 90s each (two 45s halves) + 30s halftime.
- **Admin passcode.** Change `ADMIN_PASSCODE` in `src/lib/game.js` from the default before sharing.
- **Data integrity / scale.** The Supabase policy is currently open read/write — fine to launch,
  but trivial to abuse at scale and there's no per-user rate limit. `supabase.sql` includes notes
  for scoping writes to the Privy identity (a third-party-auth JWT policy). For 1k+ concurrent
  voters, also move vote tallying to a server-maintained counter + broadcast the aggregate instead
  of every raw vote (the current model broadcasts every vote to every client — quadratic).

## Notes

- **Routing is hash-based** (`#/teams`, `#/bracket`, …), so the SPA rewrite in `vercel.json` is
  belt-and-suspenders; deep links work regardless.
- **Team images** live in `public/assets/teams/OpepenWC-Teams-1..40.webp`. Replace those files to
  change the roster (keep the names). They're cached aggressively — bump filenames if you swap art
  and want it to refresh immediately.
- **Privy is lazy-loaded** — the app paints before the auth SDK downloads, then prefetches it on
  idle, so first load stays fast.
