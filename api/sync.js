// api/sync.js — Vercel serverless function.
// Pulls bracket scoring data entirely from worldcup26.ir (free, no API key needed).
// No Anthropic, no SerpApi, no external dependencies.

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

// In-memory cache — survives warm Vercel instances, resets on cold start
let cached = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function teamName(game, side) {
  // Prefer the name embedded in the game object, fall back to id map
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  // Serve from cache if still fresh
  if (cached && Date.now() - cachedAt < CACHE_TTL) {
    res.status(200).json(cached);
    return;
  }

  try {
    // Fetch games and group standings in parallel
    const [gamesRes, groupsRes] = await Promise.all([
      fetch("https://worldcup26.ir/get/games",  { signal: AbortSignal.timeout(10000) }),
      fetch("https://worldcup26.ir/get/groups", { signal: AbortSignal.timeout(10000) }),
    ]);

    if (!gamesRes.ok)  throw new Error(`games endpoint: ${gamesRes.status}`);
    if (!groupsRes.ok) throw new Error(`groups endpoint: ${groupsRes.status}`);

    const { games  = [] } = await gamesRes.json();
    const { groups = [] } = await groupsRes.json();

    // ── Group standings ─────────────────────────────────────────
    // Build groupOrder: { A: ["1st","2nd","3rd","4th"], B: [...], ... }
    // Only include groups where at least one match has been played.
    const groupOrder = {};
    groups.forEach(grp => {
      const hasPlayed = grp.teams.some(t => parseInt(t.mp) > 0);
      if (!hasPlayed) return;

      const sorted = [...grp.teams].sort((a, b) =>
        parseInt(b.pts) - parseInt(a.pts) ||
        parseInt(b.gd)  - parseInt(a.gd)  ||
        parseInt(b.gf)  - parseInt(a.gf)
      );
      groupOrder[grp.name] = sorted.map(t => TEAM_BY_ID[t.team_id] || `Team ${t.team_id}`);
    });

    // ── Best third-place teams ──────────────────────────────────
    // Collected once all 3 group-stage matchdays are done per group.
    const thirds = [];
    groups.forEach(grp => {
      const complete = grp.teams.every(t => parseInt(t.mp) === 3);
      if (!complete) return;
      const sorted = [...grp.teams].sort((a, b) =>
        parseInt(b.pts) - parseInt(a.pts) || parseInt(b.gd) - parseInt(a.gd)
      );
      const thirdTeam = TEAM_BY_ID[sorted[2]?.team_id];
      if (thirdTeam) thirds.push(thirdTeam);
    });

    // ── Knockout rounds ─────────────────────────────────────────
    const finished = games.filter(g => g.time_elapsed === "finished");

    // Winners of each round become the teams that "reached" the next round
    const winnersOf = (roundType) =>
      finished
        .filter(g => g.type === roundType)
        .map(winnerOf)
        .filter(Boolean);

    const reachedR16  = winnersOf("r32");   // winners of R32 reached R16
    const reachedQF   = winnersOf("r16");   // winners of R16 reached QF
    const reachedSF   = winnersOf("qf");    // winners of QF reached SF
    const finalists   = winnersOf("sf");    // winners of SF reached Final

    // Champion: winner of the final
    const finalGame = finished.find(g => g.type === "final");
    const champion  = finalGame ? winnerOf(finalGame) : null;

    const result = {
      groupOrder,
      thirds:    thirds.length    ? thirds    : undefined,
      reachedR16: reachedR16.length ? reachedR16 : undefined,
      reachedQF:  reachedQF.length  ? reachedQF  : undefined,
      reachedSF:  reachedSF.length  ? reachedSF  : undefined,
      finalists:  finalists.length  ? finalists  : undefined,
      champion:   champion          || undefined,
      provisional: !champion,
      lastSync: new Date().toISOString(),
      _source: "worldcup26.ir",
    };

    cached   = result;
    cachedAt = Date.now();
    res.status(200).json(result);

  } catch (err) {
    // If worldcup26.ir is down, return last cached data with a warning rather than failing
    if (cached) {
      res.status(200).json({ ...cached, _stale: true, _error: err.message });
    } else {
      res.status(500).json({ error: `Sync failed: ${err.message}` });
    }
  }
}
