# Office Bracket Challenge — World Cup 2026

A FIFA-style bracket pool: rank the groups, pick the 8 best third-placed teams, build a knockout
bracket to a champion, then watch the shared leaderboard update as real results come in.

- **Shared data** (roster, brackets, results, chat) → Supabase
- **Device identity** (who's signed in on this browser) → localStorage
- **Automatic results** → a Vercel serverless function (`/api/sync`) that web-searches the live
  FIFA outcomes using your Anthropic API key (the key stays on the server, never in the browser)

---

## What you need (all free tiers)

1. A [GitHub](https://github.com) account
2. A [Supabase](https://supabase.com) account (the database)
3. A [Vercel](https://vercel.com) account (the hosting)
4. A **funded** [Anthropic API key](https://console.anthropic.com) — only if you want automatic
   live results (the account/org needs a credit balance). Otherwise enter results by hand in Admin.

---

## Step 1 — Supabase (database + auth)

1. Create a new Supabase project. Wait for it to finish provisioning.
2. Open **SQL Editor → New query**, paste [`supabase.sql`](./supabase.sql), **Run** (creates the `kv` table).
3. Then paste [`supabase-auth.sql`](./supabase-auth.sql), **Run**. This does two things:
   - rejects any sign-up whose email isn't `@showit.com` (enforced in the database), and
   - restricts all pool data so only signed-in users can read/write it.
4. **Authentication → Sign In / Providers → Email**: make sure **Email** is enabled, and turn
   **OFF** the **"Confirm email"** toggle. This is the important one — with it off, accounts are
   created instantly and **no email is ever sent**, so you never need an email/SMTP setup.
5. **Project Settings → API Keys** (or the **Connect** dialog), copy two values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`), or the legacy **anon** key → `VITE_SUPABASE_ANON_KEY`

### How sign-in works for your office
Everyone makes a personal account with their **@showit.com email + a password** of their choosing.
On first visit they tap **Create account**; after that they **Sign in**. Because Supabase's
"Confirm email" is off (step 4 above), **no verification email is sent** — the account is live
immediately. The `@showit.com` rule from `supabase-auth.sql` is enforced in the database, so no
other domain can register, even though nothing is emailed.

Honest tradeoff: since nothing is emailed, this doesn't *prove* a person owns that inbox — they
need a valid `@showit.com` address and a password. For an internal office pool that's the right
amount of friction. There's also no automated "forgot password" (that would need email); if someone
forgets theirs, an admin can reset it for them in **Supabase → Authentication → Users**.

To change the allowed domain later, edit `@showit.com` in `supabase-auth.sql` (re-run it) and
`ALLOWED_DOMAIN` near the top of `src/App.jsx`.

#### Want one-click Google sign-in + auto profile photos instead?
Optional. Enable the **Google** provider in **Authentication → Sign In / Providers**, create an
OAuth client in Google Cloud Console, paste its Client ID/Secret into Supabase, and set your
**Site URL** under **Authentication → URL Configuration**. Google sign-in sends no email either and
pulls in names + photos automatically. (The current build uses email + password; ask if you want it
switched back to Google.)

> The anon key is meant to be public (it ships to the browser). With the auth SQL applied, the data
> is only reachable by signed-in `@showit.com` users.

## Step 2 — Push to GitHub

```bash
npm install          # install dependencies
git init
git add .
git commit -m "Office bracket pool"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/bracket-pool.git
git branch -M main
git push -u origin main
```

## Step 3 — Deploy on Vercel

1. In Vercel, **Add New → Project**, and import your GitHub repo.
2. Vercel auto-detects Vite (build command `vite build`, output `dist`). Leave defaults.
3. Add **Environment Variables** (Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase publishable (or legacy anon) key |
   | `ANTHROPIC_API_KEY` | a funded Anthropic key (only for auto-results) |
4. **Deploy**. You'll get a live URL like `your-pool.vercel.app` — share it with the office.

That's it. Everyone who opens the URL shares one leaderboard.

---

## Run it locally first (optional)

```bash
cp .env.example .env     # fill in your three values
npm install
npm run dev              # opens the app, shared data works against Supabase
```

The UI and Supabase work under `npm run dev`. To also test the `/api/sync` function locally,
use the Vercel CLI: `npm i -g vercel` then `vercel dev`.

---

## How automatic results work

`/api/sync` asks Claude (with web search) for each group's current standings, the qualified
third-placed teams, who advanced through each knockout round, the finalists, and the champion, and
returns them as JSON. Standings are read **live**, so the leaderboard updates during the group stage
(shown as "provisional") and firms up as groups finish. It runs automatically after the tournament
starts and via the **Sync now** button on the Standings → Tournament tab. This uses the Anthropic
API, so the key's account/org must have a **credit balance** (it's pennies — one web-search call per
sync). If you'd rather not fund a key, use the Admin section to enter results by hand.

If the API ever rejects the model name or web-search tool version, update the two strings near the
top of [`api/sync.js`](./api/sync.js) using the current values from https://docs.claude.com .

## Scoring

group winner +3 · each correct top-2 team +1 · qualified third +2 · reach Round of 16 +4 ·
quarter-final +6 · semi-final +9 · finalist +12 · champion +25.

The whole bracket locks at the first kick-off (11 June 2026) and is read-only after that.
