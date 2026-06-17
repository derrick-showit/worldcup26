// api/highlights.js — Vercel serverless function
// Fetches YouTube highlight links from SerpApi's Google Sports Results.
//
// Strategy:
//   - One SerpApi query: `FIFA World Cup 2026` → returns game_spotlight + games[]
//   - Each finished game entry includes video_highlights.link (YouTube)
//   - We cache each match's highlights permanently (they never change once a game ends)
//   - The full tournament search is cached for 10 minutes to avoid burning credits
//   - Free tier: 100 searches/month. At ~3 matches/day × 1 query/match = ~90/month ✓
//
// Endpoints:
//   POST /api/highlights          → fetch & cache latest highlights from SerpApi
//   GET  /api/highlights?match=X  → return cached highlight for a specific match key
//
// Match key format: "TeamA_vs_TeamB" (alphabetical order, URL-safe)

// In-memory cache (survives warm Vercel instance restarts gracefully)
const HIGHLIGHT_CACHE = {};   // matchKey → { link, thumbnail, duration, fetchedAt }
let LAST_SERP_FETCH = 0;
let LAST_SERP_DATA  = null;
const SERP_TTL = 10 * 60 * 1000; // 10 minutes between SerpApi calls

function matchKey(team1, team2) {
  // Canonical key regardless of home/away order
  return [team1, team2].sort().join("_vs_").replace(/\s+/g, "_");
}

function normaliseName(name) {
  // SerpApi uses short team names ("USA", "USMNT", "United States")
  // Map common variants to our canonical names
  const MAP = {
    "USA": "United States",
    "USMNT": "United States",
    "US": "United States",
    "England": "England",
    "South Korea": "South Korea",
    "Korea Republic": "South Korea",
    "Korea": "South Korea",
    "Turkey": "Turkey",
    "Türkiye": "Turkey",
    "Czech Republic": "Czech Republic",
    "Czechia": "Czech Republic",
    "DR Congo": "DR Congo",
    "Dem. Rep. Congo": "DR Congo",
    "Congo DR": "DR Congo",
  };
  return MAP[name] || name;
}

async function fetchSerpApi(apiKey) {
  const now = Date.now();
  // Return cached data if fresh
  if (LAST_SERP_DATA && (now - LAST_SERP_FETCH) < SERP_TTL) {
    return LAST_SERP_DATA;
  }

  const params = new URLSearchParams({
    q: "FIFA World Cup 2026",
    api_key: apiKey,
    hl: "en",
    gl: "us",
    engine: "google",
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`SerpApi ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = await res.json();
  LAST_SERP_DATA  = data;
  LAST_SERP_FETCH = now;
  return data;
}

function extractHighlights(serpData) {
  const sports = serpData?.sports_results;
  if (!sports) return {};

  const found = {};

  // Pull from games[] array (recent results)
  for (const game of sports.games || []) {
    if (!game.video_highlights?.link) continue;
    if (!game.teams || game.teams.length < 2) continue;
    // Only index finished games (have a score)
    const t1 = normaliseName(game.teams[0]?.name || "");
    const t2 = normaliseName(game.teams[1]?.name || "");
    if (!t1 || !t2) continue;

    const key = matchKey(t1, t2);
    found[key] = {
      link:      game.video_highlights.link,
      thumbnail: game.video_highlights.thumbnail || null,
      duration:  game.video_highlights.duration  || null,
      team1:     t1,
      team2:     t2,
      date:      game.date || null,
      score:     game.teams.map(t => t.score).join(" – "),
      tournament: game.tournament || "FIFA World Cup 2026",
    };
  }

  // Also pull from game_spotlight if it has highlights
  const spotlight = sports.game_spotlight;
  if (spotlight?.video_highlights?.link && spotlight.teams?.length >= 2) {
    const t1 = normaliseName(spotlight.teams[0]?.name || "");
    const t2 = normaliseName(spotlight.teams[1]?.name || "");
    if (t1 && t2) {
      const key = matchKey(t1, t2);
      // spotlight is higher quality — prefer it
      found[key] = {
        link:      spotlight.video_highlights.link,
        thumbnail: spotlight.video_highlights.thumbnail || null,
        duration:  spotlight.video_highlights.duration  || null,
        team1:     t1,
        team2:     t2,
        date:      spotlight.date || null,
        score:     spotlight.teams.map(t => t.score?.total ?? t.score ?? "").join(" – "),
        tournament: spotlight.league || "FIFA World Cup 2026",
        spotlight:  true,
      };
    }
  }

  return found;
}

export default async function handler(req, res) {
  const apiKey = process.env.SERPAPI_KEY;

  // GET — return cached highlights (no SerpApi call)
  if (req.method === "GET") {
    const matchParam = req.query?.match;
    if (matchParam) {
      const hit = HIGHLIGHT_CACHE[matchParam];
      res.status(200).json({ match: matchParam, highlight: hit || null });
    } else {
      res.status(200).json({ highlights: HIGHLIGHT_CACHE, count: Object.keys(HIGHLIGHT_CACHE).length });
    }
    return;
  }

  // POST — fetch fresh data from SerpApi and update cache
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use GET or POST" });
    return;
  }

  if (!apiKey) {
    res.status(200).json({
      ok: false,
      reason: "SERPAPI_KEY not set — highlights unavailable",
      highlights: HIGHLIGHT_CACHE,
    });
    return;
  }

  try {
    const serpData  = await fetchSerpApi(apiKey);
    const newFound  = extractHighlights(serpData);
    let added = 0;

    // Merge into permanent cache — only add, never remove
    for (const [key, val] of Object.entries(newFound)) {
      if (!HIGHLIGHT_CACHE[key]) {
        HIGHLIGHT_CACHE[key] = { ...val, fetchedAt: new Date().toISOString() };
        added++;
      }
    }

    res.status(200).json({
      ok: true,
      added,
      total: Object.keys(HIGHLIGHT_CACHE).length,
      highlights: HIGHLIGHT_CACHE,
      _serpCreditsUsed: 1,
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      error: err.message,
      highlights: HIGHLIGHT_CACHE,
    });
  }
}
