// api/sync.js — Vercel serverless function.
// Pulls live 2026 FIFA World Cup data from API-Football (api-sports.io) and returns
// the outcomes object the app scores against. No Anthropic key / billing needed.
//
// Set API_FOOTBALL_KEY in your environment — a free token from dashboard.api-football.com
// (Account -> API key). The World Cup is league=1, season=2026.

const GROUPS = {
  A: ["Mexico", "South Africa", "Korea Republic", "Czechia"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Türkiye"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

// --- team-name resolution: API-Football spellings -> the app's exact names ---
const APP_TEAMS = Object.values(GROUPS).flat();
const norm = (s) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
const APP_LOOKUP = {};
for (const t of APP_TEAMS) APP_LOOKUP[norm(t)] = t;
const ALIAS = {
  "south korea": "Korea Republic",
  "korea republic": "Korea Republic",
  "turkey": "Türkiye",
  "turkiye": "Türkiye",
  "czech republic": "Czechia",
  "usa": "United States",
  "united states of america": "United States",
  "congo dr": "DR Congo",
  "dr congo": "DR Congo",
  "democratic republic of congo": "DR Congo",
  "cote d ivoire": "Ivory Coast",
  "cabo verde": "Cape Verde",
  "bosnia": "Bosnia and Herzegovina",
};
function resolveTeam(name) {
  const n = norm(name);
  if (!n) return null;
  if (APP_LOOKUP[n]) return APP_LOOKUP[n];
  if (ALIAS[n]) return ALIAS[n];
  return null;
}

async function af(path, key) {
  const r = await fetch("https://v3.football.api-sports.io" + path, { headers: { "x-apisports-key": key } });
  const j = await r.json();
  if (j && j.errors && ((Array.isArray(j.errors) && j.errors.length) || (!Array.isArray(j.errors) && Object.keys(j.errors).length))) {
    const msg = Array.isArray(j.errors) ? j.errors.join("; ") : Object.values(j.errors).join("; ");
    if (msg) throw new Error("API-Football: " + msg);
  }
  return j;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) { res.status(500).json({ error: "Missing API_FOOTBALL_KEY environment variable" }); return; }
  const LEAGUE = 1, SEASON = 2026;
  try {
    const out = { provisional: true };

    // ---- current group standings ----
    const st = await af(`/standings?league=${LEAGUE}&season=${SEASON}`, key);
    const groupsArr = ((((st.response || [])[0] || {}).league || {}).standings) || [];
    const groupOrder = {};
    for (const grp of groupsArr) {
      if (!Array.isArray(grp) || !grp.length) continue;
      const label = String(grp[0].group || "").replace(/group/i, "").trim().toUpperCase();
      if (!label) continue;
      const ordered = grp.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99))
        .map((row) => resolveTeam(row.team && row.team.name)).filter(Boolean);
      if (ordered.length) groupOrder[label] = ordered;
    }
    if (Object.keys(groupOrder).length) out.groupOrder = groupOrder;

    // ---- knockout progression from fixtures ----
    const fx = await af(`/fixtures?league=${LEAGUE}&season=${SEASON}`, key);
    const fixtures = fx.response || [];
    const roundOf = (f) => String((f.league && f.league.round) || "").toLowerCase();
    const finished = (f) => ["FT", "AET", "PEN"].includes(String(f.fixture?.status?.short || "").toUpperCase());
    const winnerOf = (f) => {
      const h = f.teams && f.teams.home, a = f.teams && f.teams.away;
      if (h && h.winner) return resolveTeam(h.name);
      if (a && a.winner) return resolveTeam(a.name);
      return null;
    };
    const teamsIn = (f) => [resolveTeam(f.teams?.home?.name), resolveTeam(f.teams?.away?.name)].filter(Boolean);
    const winnersWhere = (test) => fixtures.filter((f) => test(roundOf(f)) && finished(f)).map(winnerOf).filter(Boolean);
    const participantsWhere = (test) => { const s = new Set(); fixtures.filter((f) => test(roundOf(f))).forEach((f) => teamsIn(f).forEach((t) => s.add(t))); return [...s]; };

    const r16 = winnersWhere((r) => r.includes("round of 32"));
    const qf = winnersWhere((r) => r.includes("round of 16"));
    const sf = winnersWhere((r) => r.includes("quarter"));
    const isFinal = (r) => r.includes("final") && !r.includes("semi") && !r.includes("quarter") && !r.includes("3rd") && !r.includes("third");
    const finalists = participantsWhere(isFinal);
    let champion = "";
    fixtures.filter((f) => isFinal(roundOf(f)) && finished(f)).forEach((f) => { const w = winnerOf(f); if (w) champion = w; });

    if (r16.length) out.reachedR16 = r16;
    if (qf.length) out.reachedQF = qf;
    if (sf.length) out.reachedSF = sf;
    if (finalists.length) out.finalists = finalists;
    if (champion) { out.champion = champion; out.provisional = false; }

    // ---- qualified thirds: 3rd-placed teams that reached the Round of 32 ----
    const r32Teams = new Set(participantsWhere((r) => r.includes("round of 32")));
    if (r32Teams.size) {
      const thirds = [];
      for (const grp of groupsArr) {
        const third = (grp || []).find((row) => row.rank === 3);
        const t = third && resolveTeam(third.team && third.team.name);
        if (t && r32Teams.has(t)) thirds.push(t);
      }
      if (thirds.length) out.thirds = thirds;
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
