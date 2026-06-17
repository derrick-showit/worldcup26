# Office Bracket Challenge — FIFA World Cup 2026

An office bracket pool for the 2026 FIFA World Cup. Players rank all 12 groups,
pick 8 best third-placed teams, then build their knockout bracket all the way
to the champion. Points are awarded as real results come in.

## Live Widgets

Eight free embeddable World Cup widgets are included in `src/widgets/`:

| Widget | What it shows |
|---|---|
| `<HubWidget />` | Live count, next match, group leaders |
| `<LivescoreWidget />` | Live + today's scores (refreshes every 30s) |
| `<StandingsWidget />` | Group table with W/D/L, GF, GA, GD, Pts |
| `<BracketWidget />` | Knockout bracket R32 → Final |
| `<MatchCentreWidget />` | Single-match deep dive |
| `<SquadWidget />` | Any team's fixtures and group rivals |
| `<TopscorersWidget />` | Teams ranked by goals |
| `<TournamentLivescoreWidget />` | All 104 matches grouped by date |

**No API key required.** Data comes from [worldcup26.ir](https://worldcup26.ir)
(open-source, free, no signup).

Use them anywhere in the app:
```jsx
import { LivescoreWidget, StandingsWidget } from './widgets/WorldCupWidgets';
<LivescoreWidget />
<StandingsWidget group="A" />
```

Preview all widgets at `/widgets` (add `WidgetDemo` to your router).

## Setup

### 1. Supabase (required)

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `supabase.sql` in the SQL editor to create the `kv` table
3. Run `supabase-auth.sql` to configure auth (disable email confirmation)

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your Supabase keys:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

`ANTHROPIC_API_KEY` is optional — only needed as a fallback for bracket
scoring sync if the free data source is unavailable.

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

```bash
vercel --prod
```

Add the environment variables in Vercel → Project Settings → Environment Variables.

## How scoring works

| Achievement | Points |
|---|---|
| Predict group winner | +3 |
| Predict a top-2 team | +1 each |
| Predict a qualifying third | +2 each |
| Team reaches Round of 16 | +4 |
| Team reaches Quarter-final | +6 |
| Team reaches Semi-final | +9 |
| Team reaches Final | +12 |
| Correct champion | +25 |

Brackets lock at the first kick-off (June 11, 2026 15:00 ET).
