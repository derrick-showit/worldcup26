// api/sync.js — Vercel serverless function.
// Derives bracket scoring data from worldcup26.ir (free, no API key needed).
//
// worldcup26.ir can be slow (8–15s per endpoint). This function:
//   - Runs endpoints sequentially (not parallel) to avoid compounding timeouts
//   - Retries once on timeout with a fresh connection
//   - Returns stale cached data rather than failing if the API is unreachable
//   - Uses a 25s timeout per request (Vercel function max is 30s on hobby)

const TEAM_BY_ID = {
  "1":"Mexico","2":"South Africa","3":"South Korea","4":"Czech Republic",
  "5":"Canada","6":"Bosnia and Herzegovina","7":"Qatar","8":"Switzerland",
  "9":"Brazil","10":"Morocco","11":"Haiti","12":"Scotland",
  "13":"United States","14":"Paraguay","15":"Australia","16":"Turkey",
  "17":"Germany","18":"Curaçao","19":"Ivory Coast","20":"Ecuador",
  "21":"Netherlands","22":"Japan","23":"Sweden","24":"Tunisia",
  "25":"Belgium","26":"Egypt","27":"Iran","28":"New Zealand",
  "29":"Spain","30":"Cape Verde","31":"Saudi Arabia","32":"Uruguay",
  "33":"France","34":"Senegal","35":"Iraq","36":"Norway",
  "37":"Argentina","38":"Algeria","39":"Austria","40":"Jordan",
  "41":"Portugal","42":"DR Congo","43":"Uzbekistan","44":"Colombia",
  "45":"England","46":"Croatia","47":"Ghana","48":"Panama",
};

// Module-level cache — survives warm Vercel instances
let cached   = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch with one automatic retry on timeout/network error
async function fetchWithRetry(url, timeoutMs = 25000) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      // Short pause before retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

function teamName(game, side) {
  const nameKey = side === "home" ? "home_team_name_en" : "away_team_name_en";
  const idKey   = side === "home" ? "home_team_id"     : "away_team_id";
  return game[nameKey] || TEAM_BY_ID[game[idKey]] || null;
}

function winnerOf(game) {
  const hs = parseInt(game.home_score);
  const as = parseInt(game.away_score);
  if (isNaN(hs) || isNaN(as)) return null;
  return hs > as ? teamName(game, "home") : teamName(game, "away");
}

function buildResult(games, groups) {
  // Group standings
  const groupOrder = {};
  groups.forEach(grp => {
    if (!grp.teams.some(t => parseInt(t.mp) > 0)) return;
    const sorted = [...grp.teams].sort((a, b) =>
      parseInt(b.pts) - parseInt(a.pts) ||
      parseInt(b.gd)  - parseInt(a.gd)  ||
      parseInt(b.gf)  - parseInt(a.gf)
    );
    groupOrder[grp.name] = sorted.map(t => TEAM_BY_ID[t.team_id] || `Team ${t.team_id}`);
  });

  // Best third-place teams (only once a group has played all 3 matchdays)
  const thirds = [];
  groups.forEach(grp => {
    if (!grp.teams.every(t => parseInt(t.mp) === 3)) return;
    const sorted = [...grp.teams].sort((a, b) =>
      parseInt(b.pts) - parseInt(a.pts) || parseInt(b.gd) - parseInt(a.gd)
    );
    const third = TEAM_BY_ID[sorted[2]?.team_id];
    if (third) thirds.push(third);
  });

  // Knockout progression — winners of each round
  const finished = games.filter(g => g.time_elapsed === "finished");
  const winnersOf = type => finished.filter(g => g.type === type).map(winnerOf).filter(Boolean);

  const reachedR16 = winnersOf("r32");
  const reachedQF  = winnersOf("r16");
  const reachedSF  = winnersOf("qf");
  const finalists  = winnersOf("sf");
  const finalGame  = finished.find(g => g.type === "final");
  const champion   = finalGame ? winnerOf(finalGame) : null;

  return {
    groupOrder,
    thirds:     thirds.length     ? thirds     : undefined,
    reachedR16: reachedR16.length ? reachedR16 : undefined,
    reachedQF:  reachedQF.length  ? reachedQF  : undefined,
    reachedSF:  reachedSF.length  ? reachedSF  : undefined,
    finalists:  finalists.length  ? finalists  : undefined,
    champion:   champion          || undefined,
    provisional: !champion,
    lastSync: new Date().toISOString(),
    _source: "worldcup26.ir",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  // Serve cache if still fresh
  if (cached && Date.now() - cachedAt < CACHE_TTL) {
    res.status(200).json(cached);
    return;
  }

  let gamesData  = null;
  let groupsData = null;
  let fetchError = null;

  // Fetch sequentially — worldcup26.ir is slow; parallel requests compound the wait
  try {
    gamesData = await fetchWithRetry("https://worldcup26.ir/get/games");
  } catch (e) {
    fetchError = `games: ${e.message}`;
  }

  if (gamesData) {
    try {
      groupsData = await fetchWithRetry("https://worldcup26.ir/get/groups");
    } catch (e) {
      fetchError = `groups: ${e.message}`;
    }
  }

  // If we got both, build and cache a fresh result
  if (gamesData && groupsData) {
    const result = buildResult(gamesData.games || [], groupsData.groups || []);
    cached   = result;
    cachedAt = Date.now();
    res.status(200).json(result);
    return;
  }

  // If the API was slow/down but we have stale data, return it with a warning
  if (cached) {
    res.status(200).json({
      ...cached,
      _stale: true,
      _staleReason: fetchError,
      _staleAge: Math.round((Date.now() - cachedAt) / 60000) + " min",
    });
    return;
  }

  // Nothing at all — return a clear error the UI can display
  res.status(503).json({
    error: `Data source temporarily unavailable (${fetchError}). Try again in a moment.`,
  });
}
