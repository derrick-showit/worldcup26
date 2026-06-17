// api/sync.js — Vercel serverless function.
// Fetches live World Cup results from worldcup26.ir (free, no key needed).
// Falls back to Anthropic web search if the free API is unavailable.

const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czech Republic"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

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

// In-memory cache (warm Vercel instance)
let cached = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (tighter since it's free)

async function fetchFromFreeAPI() {
  const [gamesRes, groupsRes] = await Promise.all([
    fetch("https://worldcup26.ir/get/games",  { signal: AbortSignal.timeout(8000) }),
    fetch("https://worldcup26.ir/get/groups", { signal: AbortSignal.timeout(8000) }),
  ]);

  if (!gamesRes.ok || !groupsRes.ok) throw new Error("worldcup26.ir returned non-200");

  const gamesData  = await gamesRes.json();
  const groupsData = await groupsRes.json();

  const games  = gamesData.games  || [];
  const groups = groupsData.groups || [];

  // Build group order from standings (sorted by pts → gd → gf)
  const groupOrder = {};
  groups.forEach(grp => {
    const sorted = [...grp.teams]
      .sort((a, b) =>
        parseInt(b.pts) - parseInt(a.pts) ||
        parseInt(b.gd)  - parseInt(a.gd)  ||
        parseInt(b.gf)  - parseInt(a.gf)
      );
    // Only include if at least one match played
    if (sorted.some(t => parseInt(t.mp) > 0)) {
      groupOrder[grp.name] = sorted.map(t => TEAM_BY_ID[t.team_id] || `Team ${t.team_id}`);
    }
  });

  // Third-place teams (position 3 in each group, only if group is complete — 3 matchdays played)
  const thirds = [];
  groups.forEach(grp => {
    const allPlayed = grp.teams.every(t => parseInt(t.mp) === 3);
    if (allPlayed && grp.teams.length >= 3) {
      const sorted = [...grp.teams]
        .sort((a, b) => parseInt(b.pts) - parseInt(a.pts) || parseInt(b.gd) - parseInt(a.gd));
      const third = TEAM_BY_ID[sorted[2]?.team_id];
      if (third) thirds.push(third);
    }
  });

  // Knockout progression
  const finished = games.filter(g => g.time_elapsed === "finished");
  const roundTeams = (type) =>
    finished
      .filter(g => g.type === type)
      .map(g => {
        const hScore = parseInt(g.home_score);
        const aScore = parseInt(g.away_score);
        const winner = hScore > aScore
          ? (g.home_team_name_en || TEAM_BY_ID[g.home_team_id])
          : (g.away_team_name_en || TEAM_BY_ID[g.away_team_id]);
        return winner;
      })
      .filter(Boolean);

  const reachedR16    = roundTeams("r32");
  const reachedQF     = roundTeams("r16");
  const reachedSF     = roundTeams("qf");
  const finalistsRaw  = roundTeams("sf");
  const championGames = finished.filter(g => g.type === "final");
  let champion = null;
  if (championGames.length > 0) {
    const cg = championGames[0];
    const hs = parseInt(cg.home_score), as_ = parseInt(cg.away_score);
    champion = hs > as_
      ? (cg.home_team_name_en || TEAM_BY_ID[cg.home_team_id])
      : (cg.away_team_name_en || TEAM_BY_ID[cg.away_team_id]);
  }

  const provisional = !champion;

  return {
    groupOrder,
    thirds: thirds.length > 0 ? thirds : undefined,
    reachedR16: reachedR16.length > 0 ? reachedR16 : undefined,
    reachedQF:  reachedQF.length  > 0 ? reachedQF  : undefined,
    reachedSF:  reachedSF.length  > 0 ? reachedSF  : undefined,
    finalists:  finalistsRaw.length > 0 ? finalistsRaw : undefined,
    champion:   champion || undefined,
    provisional,
    _source: "worldcup26.ir",
  };
}

// Fallback: use Anthropic web search (original approach)
async function fetchFromAI(apiKey) {
  const gkeys = Object.keys(GROUPS);
  const groupsList = gkeys.map(g => `${g}: ${GROUPS[g].join(", ")}`).join("\n");
  const prompt = `Search for "2026 FIFA World Cup group standings results" to find current standings. Today is ${new Date().toDateString()}.

Groups:
${groupsList}

Return ONLY this JSON (no markdown, no text):
{"groupOrder":{"A":["1st","2nd","3rd","4th"]},"thirds":[],"reachedR16":[],"reachedQF":[],"reachedSF":[],"finalists":[],"champion":null,"provisional":true}

- groupOrder: current standings for groups with at least one match played. All 4 teams, best to worst.
- Use EXACT team names from the list above.
- provisional: true until a champion is decided.
- Output ONLY valid JSON.`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: "You are a sports data API. Do one web search, then return the requested JSON only.",
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  const data = await r.json();
  if (data.error) throw new Error(data.error.message);

  const texts = (data.content || []).filter(b => b.type === "text").map(b => b.text);
  for (const text of [texts[texts.length - 1], texts.join("\n")]) {
    if (!text) continue;
    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    try { return { ...JSON.parse(clean), _source: "anthropic" }; } catch {}
    const i = clean.indexOf("{"), j = clean.lastIndexOf("}");
    if (i >= 0 && j > i) try { return { ...JSON.parse(clean.slice(i, j + 1)), _source: "anthropic" }; } catch {}
  }
  throw new Error("Could not parse AI response");
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }

  // Serve cache if fresh
  if (cached && (Date.now() - cachedAt < CACHE_TTL)) {
    res.status(200).json(cached); return;
  }

  let result = null;

  // Try free API first
  try {
    result = await fetchFromFreeAPI();
  } catch (e) {
    console.warn("worldcup26.ir failed, falling back to AI:", e.message);
  }

  // Fallback to Anthropic web search
  if (!result) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      res.status(500).json({ error: "worldcup26.ir is unavailable and ANTHROPIC_API_KEY is not set." });
      return;
    }
    try {
      result = await fetchFromAI(key);
    } catch (e) {
      res.status(500).json({ error: String(e.message) }); return;
    }
  }

  cached   = result;
  cachedAt = Date.now();
  res.status(200).json(result);
}
