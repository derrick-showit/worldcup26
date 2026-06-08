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

## Step 1 — Supabase (database + auth)

1. Create a new Supabase project. Wait for it to finish provisioning.
2. Open **SQL Editor → New query**, paste [`supabase.sql`](./supabase.sql), **Run** (creates the `kv` table).
3. Then paste [`supabase-auth.sql`](./supabase-auth.sql), **Run**. This does two things:
   - rejects any sign-up whose email isn't `@showit.com` (enforced in the database), and
   - restricts all pool data so only signed-in users can read/write it.
4. **Authentication → Sign In / Providers**: make sure **Email** is enabled.
5. **Authentication → Email Templates → Magic Link**: so users get a typeable 6-digit code,
   make sure the template body includes the token, e.g. add a line:
   `Your sign-in code is: {{ .Token }}`
   (Leaving the link in is fine too — clicking it also signs them in.)
6. **Project Settings → API**, copy two values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

### How sign-in works for your office
Everyone signs in with their **@showit.com** identity — no passwords, no PINs. Two ways:

- **Continue with Google** (recommended) — one click, and it automatically brings their name and
  Google profile photo into the pool. Best if Showit uses Google Workspace.
- **Email code** — enter the work email, get a 6-digit code, type it in. (No photo this way; they
  can paste one in their profile.)

Either way the `@showit.com` rule from `supabase-auth.sql` is enforced in the database.

#### Enabling Google sign-in (one-time)
1. In **Google Cloud Console**, create an OAuth 2.0 Client ID (type: Web application).
2. Add the Supabase callback as an **Authorized redirect URI** — Supabase shows the exact URL under
   **Authentication → Sign In / Providers → Google** (looks like
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
3. Copy the Client ID + Client Secret into that Supabase Google provider screen and **Save**.
4. In **Authentication → URL Configuration**, set **Site URL** to your Vercel URL (and add
   `http://localhost:5173` to Redirect URLs for local dev).

The app passes a `hd=showit.com` hint so Google steers people to their work account; the database
rule is the hard guarantee. To change the allowed domain later, edit `@showit.com` in
`supabase-auth.sql` (re-run it) and `ALLOWED_DOMAIN` near the top of `src/App.jsx`.

#### Email-code template
For the email-code fallback, in **Authentication → Email Templates → Magic Link**, make sure the
body includes the code, e.g. `Your sign-in code is: {{ .Token }}`.

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
