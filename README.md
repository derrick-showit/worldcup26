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
4. An [Anthropic API key](https://console.anthropic.com) — only if you want automatic results
   (otherwise enter results by hand in the Admin section)

---

## Step 1 — Supabase (database)

1. Create a new Supabase project. Wait for it to finish provisioning.
2. Open **SQL Editor → New query**, paste the contents of [`supabase.sql`](./supabase.sql), and **Run**.
   This creates one `kv` table the app uses for all shared data.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **anon public** key → this is `VITE_SUPABASE_ANON_KEY`

> The anon key is meant to be public (it ships to the browser). The SQL above allows open
> read/write, which suits an honour-system office pool. For stricter control, add Supabase Auth
> later and tighten the policies.

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
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon public key |
   | `ANTHROPIC_API_KEY` | your Anthropic key (only for auto-results) |
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

`/api/sync` asks Claude (with web search) for confirmed group standings, qualified third-placed
teams, who advanced through each knockout round, the finalists, and the champion, and returns them
as JSON. The app stores that and scores every bracket against it. It runs automatically after the
tournament starts and via the **Sync now** button on the Standings → Tournament tab. If you'd
rather not use an API key, skip `ANTHROPIC_API_KEY` and use the Admin section to enter results.

If the API ever rejects the model name or web-search tool version, update the two strings near the
top of [`api/sync.js`](./api/sync.js) using the current values from https://docs.claude.com .

## Scoring

group winner +3 · each correct top-2 team +1 · qualified third +2 · reach Round of 16 +4 ·
quarter-final +6 · semi-final +9 · finalist +12 · champion +25.

The whole bracket locks at the first kick-off (11 June 2026) and is read-only after that.
