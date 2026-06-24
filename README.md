# Opepen World Cup — React + Privy

A Vite + React port of the Opepen World Cup. A bracket pool **and** a crowd vote in one:
rank the field, build a knockout bracket to a champion, then settle every match head-to-head —
two Opepen come out, the room votes one through, and your bracket is scored against the crowd's
verdicts. Plus profiles, a leaderboard, global banter, per-match comments, Taste Points, and
TP wagering.

Auth and embedded wallets are handled by **Privy** (email, Google, Apple, X/Twitter, and external
wallets). Shared data (votes, chat, comments, player profiles) lives in **Supabase**; your bracket,
picks, and Taste Points stay on your own device.

## Tech

- Vite + React 18
- `@privy-io/react-auth` (v3) — login + embedded wallets
- `@supabase/supabase-js` (v2) — shared `kv` table + realtime

## Run locally

```bash
npm install
cp .env.example .env        # fill in values (see below)
npm run dev                 # http://localhost:5173
npm run build               # production build into dist/
npm run preview             # preview the production build
```

The app **builds and runs with blank env vars** — Privy login just won't work until you add a
real App ID, and Supabase stays in local-only demo mode until you add its URL + anon key.

## Environment variables

All client-side (Vite `import.meta.env`), kept in `.env`:

| Name | Purpose |
|---|---|
| `VITE_PRIVY_APP_ID` | Your Privy app's App ID (required for login at runtime) |
| `VITE_SUPABASE_URL` | Supabase Project URL (blank = local-only demo) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon / publishable key (public, safe in browser) |

## 1. Privy setup

1. Go to [dashboard.privy.io](https://dashboard.privy.io), create an app, and copy its **App ID**.
2. Paste it into `.env` as `VITE_PRIVY_APP_ID`.
3. In the Privy dashboard, under **Login methods**, enable: **Email**, **Google**, **Apple**,
   **Twitter (X)**, and **Wallet**. (These match the app's `loginMethods` config.)
4. Under **Embedded wallets**, leave embedded-wallet creation on — the app requests
   `createOnLogin: 'users-without-wallets'`, so users who log in with email/social automatically
   get an embedded wallet.
5. Under **Domains / allowed origins**, add your local (`http://localhost:5173`) and production
   URLs so Privy will accept logins from them.

Privy config lives in `src/main.jsx`:

```js
<PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID} config={{
  loginMethods: ['email','google','apple','twitter','wallet'],
  embeddedWallets: { createOnLogin: 'users-without-wallets' },
  appearance: { theme: 'dark', accentColor: '#13a05a' },
}}>
```

**Identity.** The app derives a stable identity from the Privy user: `id = 'privy:' + user.id`.
The display label is the user's email, else a linked wallet short (`0x1234…abcd`), else a social
handle; the short name is the first part. See `src/lib/identity.js`.

## 2. Supabase setup (optional — enables shared data)

1. Create a free project at [supabase.com](https://supabase.com) (any region).
2. **SQL Editor → New query**, paste [`supabase.sql`](./supabase.sql), **Run**. That creates the
   `kv` table, opens it to the public anon key (dev policy), and enables realtime.
3. **Project Settings → API**: copy the **Project URL** → `VITE_SUPABASE_URL` and the
   **anon key** → `VITE_SUPABASE_ANON_KEY` in `.env`.
4. Restart `npm run dev`. The console logs `data mode: shared (Supabase)` when configured.

> The app does **not** use Supabase Auth / email magic links anymore — **Privy owns auth.**
> For production write-integrity (scoping writes to a Privy-JWT third-party auth integration),
> see the commented section at the bottom of `supabase.sql`.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo and import it into [Vercel](https://vercel.com).
2. Framework preset: **Vite** (build command `npm run build`, output `dist`).
3. In **Settings → Environment Variables**, add `VITE_PRIVY_APP_ID`, `VITE_SUPABASE_URL`,
   and `VITE_SUPABASE_ANON_KEY`.
4. Add your Vercel production URL to Privy's allowed origins.
5. Deploy. The 40 team images ship from `public/assets/teams/` so the roster works immediately.

## Features

- **Play** — live match arena with field-frame voting (**every vote is a shot on goal**: decision
  speed shapes shot quality, changing your vote can be an own goal), vote %, **Match Stats**
  (possession donut + bars), **Play-by-Play** (Guardian-style), and **Match Chat**. Between matches
  it shows a countdown to kickoff. Wager TP on the live match.
- **Teams** — 40 cards with seed, group, champion odds, card modal + share.
- **Bracket & Schedule** — full 18-day, 6-round fixture list; tap to predict winners; share bracket.
- **Standings** — predictor score vs the crowd's results + the player roster.
- **Earn** — TP balance, one-click X share (+100, 5/day), bracket/daily rewards, wagers, activity.
- **Banter** — gated group chat: check in + bracket + share + **verified account**. With Privy,
  "verified account" means an authenticated user that has an **email** (Privy verifies email
  ownership at login), so any logged-in user with an email passes.
- **Profile** — display name + color on top of your Privy check-in. Sign out via `logout()`.
- **Rules / About / Sponsor / Terms / Privacy / Admin** — content pages; Admin (footer link,
  passcode `dewdOpepen082` in `src/lib/game.js`) can reset all match votes.

## Project layout

```
owc-react/
  index.html               # Vite entry (Google Fonts + #root)
  vite.config.js
  package.json
  .env.example
  supabase.sql             # kv table + dev RLS + production notes
  README.md
  public/assets/teams/     # 40 Opepen images (OpepenWC-Teams-1..40.webp)
  src/
    main.jsx               # PrivyProvider + render
    App.jsx                # shell, ticker, nav, hash router
    views.jsx              # all views + modal/toast/flash
    styles.css             # CSS copied verbatim from the original app
    components/svg.jsx      # inline OWC logo, X logo, pitch SVG
    lib/
      storage.js           # window.storage cache + Supabase kv + hydrate + realtime
      game.js              # roster, schedule engine, votes/shots, TP, wagers, chat
      identity.js          # derive stable identity from the Privy user
```

## Notes

- **Demo schedule.** `START_BASE` in `src/lib/game.js` is `Date.now() - 310*60000` so matches are
  live right now for the demo. The commented future-date version is right above it for a real event.
- **Open write policy.** `supabase.sql` opens the `kv` table to the anon key for simplicity. For
  production integrity, scope writes to authenticated Privy users (Privy JWT third-party auth) —
  see the commented section in `supabase.sql`.
- **Admin passcode** lives in the client source, so it gates casual access but isn't a true secret
  on a public site.
- **Testing Privy headlessly isn't possible** — login needs a real App ID and a browser. The build
  passing verifies wiring; actual login must be tested in a browser with a configured Privy app.
