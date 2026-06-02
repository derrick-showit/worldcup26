import { useState, useEffect, useRef } from "react";

/* ============================================================
   OFFICE BRACKET CHALLENGE — 2026 FIFA WORLD CUP
   FIFA-style flow: rank groups -> pick 8 best thirds -> knockout
   bracket -> champion. Persists & shares via window.storage.
   ============================================================ */

const FLAGS = {
  Mexico: "🇲🇽", "South Africa": "🇿🇦", "Korea Republic": "🇰🇷", Czechia: "🇨🇿",
  Canada: "🇨🇦", "Bosnia and Herzegovina": "🇧🇦", Qatar: "🇶🇦", Switzerland: "🇨🇭",
  Brazil: "🇧🇷", Morocco: "🇲🇦", Haiti: "🇭🇹", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "United States": "🇺🇸", Paraguay: "🇵🇾", Australia: "🇦🇺", "Türkiye": "🇹🇷",
  Germany: "🇩🇪", "Curaçao": "🇨🇼", "Ivory Coast": "🇨🇮", Ecuador: "🇪🇨",
  Netherlands: "🇳🇱", Japan: "🇯🇵", Sweden: "🇸🇪", Tunisia: "🇹🇳",
  Belgium: "🇧🇪", Egypt: "🇪🇬", Iran: "🇮🇷", "New Zealand": "🇳🇿",
  Spain: "🇪🇸", "Cape Verde": "🇨🇻", "Saudi Arabia": "🇸🇦", Uruguay: "🇺🇾",
  France: "🇫🇷", Senegal: "🇸🇳", Iraq: "🇮🇶", Norway: "🇳🇴",
  Argentina: "🇦🇷", Algeria: "🇩🇿", Austria: "🇦🇹", Jordan: "🇯🇴",
  Portugal: "🇵🇹", "DR Congo": "🇨🇩", Uzbekistan: "🇺🇿", Colombia: "🇨🇴",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Croatia: "🇭🇷", Ghana: "🇬🇭", Panama: "🇵🇦",
};
const flag = (t) => FLAGS[t] || "⚽";
const SHORT = {
  Mexico: "MEX", "South Africa": "RSA", "Korea Republic": "KOR", Czechia: "CZE",
  Canada: "CAN", "Bosnia and Herzegovina": "BIH", Qatar: "QAT", Switzerland: "SUI",
  Brazil: "BRA", Morocco: "MAR", Haiti: "HAI", Scotland: "SCO",
  "United States": "USA", Paraguay: "PAR", Australia: "AUS", "Türkiye": "TUR",
  Germany: "GER", "Curaçao": "CUW", "Ivory Coast": "CIV", Ecuador: "ECU",
  Netherlands: "NED", Japan: "JPN", Sweden: "SWE", Tunisia: "TUN",
  Belgium: "BEL", Egypt: "EGY", Iran: "IRN", "New Zealand": "NZL",
  Spain: "ESP", "Cape Verde": "CPV", "Saudi Arabia": "KSA", Uruguay: "URU",
  France: "FRA", Senegal: "SEN", Iraq: "IRQ", Norway: "NOR",
  Argentina: "ARG", Algeria: "ALG", Austria: "AUT", Jordan: "JOR",
  Portugal: "POR", "DR Congo": "COD", Uzbekistan: "UZB", Colombia: "COL",
  England: "ENG", Croatia: "CRO", Ghana: "GHA", Panama: "PAN",
};
const ALL_TEAMS = Object.keys(FLAGS).sort();

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
const GKEYS = Object.keys(GROUPS);

/* Round of 32 pairings (slot tokens). third = eligible groups for a 3rd-place team. */
const R32 = [
  { id: "ko1", a: "A2", b: "B2", venue: "SoFi Stadium · Inglewood", dt: "2026-06-28T15:00:00-04:00" },
  { id: "ko2", a: "C1", b: "F2", venue: "NRG Stadium · Houston", dt: "2026-06-29T13:00:00-04:00" },
  { id: "ko3", a: "E1", b: { third: ["A", "B", "C", "D", "F"] }, venue: "Gillette Stadium · Boston", dt: "2026-06-29T16:30:00-04:00" },
  { id: "ko4", a: "F1", b: "C2", venue: "Estadio BBVA · Monterrey", dt: "2026-06-29T21:00:00-04:00" },
  { id: "ko5", a: "E2", b: "I2", venue: "AT&T Stadium · Dallas", dt: "2026-06-30T13:00:00-04:00" },
  { id: "ko6", a: "I1", b: { third: ["C", "D", "F", "G", "H"] }, venue: "MetLife Stadium · New Jersey", dt: "2026-06-30T17:00:00-04:00" },
  { id: "ko7", a: "A1", b: { third: ["C", "E", "F", "H", "I"] }, venue: "Estadio Azteca · Mexico City", dt: "2026-06-30T21:00:00-04:00" },
  { id: "ko8", a: "L1", b: { third: ["E", "H", "I", "J", "K"] }, venue: "Mercedes-Benz Stadium · Atlanta", dt: "2026-07-01T12:00:00-04:00" },
  { id: "ko9", a: "G1", b: { third: ["A", "E", "H", "I", "J"] }, venue: "Lumen Field · Seattle", dt: "2026-07-01T16:00:00-04:00" },
  { id: "ko10", a: "D1", b: { third: ["B", "E", "F", "I", "J"] }, venue: "Levi's Stadium · Bay Area", dt: "2026-07-01T20:00:00-04:00" },
  { id: "ko11", a: "H1", b: "J2", venue: "SoFi Stadium · Inglewood", dt: "2026-07-02T15:00:00-04:00" },
  { id: "ko12", a: "K2", b: "L2", venue: "BMO Field · Toronto", dt: "2026-07-02T19:00:00-04:00" },
  { id: "ko13", a: "B1", b: { third: ["E", "F", "G", "I", "J"] }, venue: "BC Place · Vancouver", dt: "2026-07-02T23:00:00-04:00" },
  { id: "ko14", a: "D2", b: "G2", venue: "AT&T Stadium · Dallas", dt: "2026-07-03T14:00:00-04:00" },
  { id: "ko15", a: "J1", b: "H2", venue: "Hard Rock Stadium · Miami", dt: "2026-07-03T18:00:00-04:00" },
  { id: "ko16", a: "K1", b: { third: ["D", "E", "I", "J", "L"] }, venue: "Arrowhead Stadium · Kansas City", dt: "2026-07-03T21:30:00-04:00" },
];

/* children (which two earlier matches feed each later match) + meta */
const KO_META = {
  ko17: { venue: "NRG Stadium · Houston", dt: "2026-07-04T13:00:00-04:00" },
  ko18: { venue: "Lincoln Financial · Philadelphia", dt: "2026-07-04T17:00:00-04:00" },
  ko19: { venue: "MetLife · New Jersey", dt: "2026-07-05T16:00:00-04:00" },
  ko20: { venue: "Estadio Azteca · Mexico City", dt: "2026-07-05T20:00:00-04:00" },
  ko21: { venue: "AT&T · Dallas", dt: "2026-07-06T15:00:00-04:00" },
  ko22: { venue: "Lumen Field · Seattle", dt: "2026-07-06T20:00:00-04:00" },
  ko23: { venue: "Mercedes-Benz · Atlanta", dt: "2026-07-07T12:00:00-04:00" },
  ko24: { venue: "BC Place · Vancouver", dt: "2026-07-07T16:00:00-04:00" },
  ko25: { venue: "Gillette · Boston", dt: "2026-07-09T16:00:00-04:00" },
  ko26: { venue: "SoFi · Inglewood", dt: "2026-07-10T15:00:00-04:00" },
  ko27: { venue: "Hard Rock · Miami", dt: "2026-07-11T17:00:00-04:00" },
  ko28: { venue: "Arrowhead · Kansas City", dt: "2026-07-11T21:00:00-04:00" },
  ko29: { venue: "AT&T · Dallas", dt: "2026-07-14T15:00:00-04:00" },
  ko30: { venue: "Mercedes-Benz · Atlanta", dt: "2026-07-15T15:00:00-04:00" },
  ko31: { venue: "Hard Rock · Miami", dt: "2026-07-18T17:00:00-04:00" },
  ko32: { venue: "MetLife · New Jersey", dt: "2026-07-19T15:00:00-04:00" },
};
const CHILDREN = {
  ko17: ["ko1", "ko2"], ko18: ["ko3", "ko4"], ko19: ["ko5", "ko6"], ko20: ["ko7", "ko8"],
  ko21: ["ko9", "ko10"], ko22: ["ko11", "ko12"], ko23: ["ko13", "ko14"], ko24: ["ko15", "ko16"],
  ko25: ["ko17", "ko18"], ko26: ["ko19", "ko20"], ko27: ["ko21", "ko22"], ko28: ["ko23", "ko24"],
  ko29: ["ko25", "ko26"], ko30: ["ko27", "ko28"], ko32: ["ko29", "ko30"],
};
const R32_IDS = R32.map((m) => m.id);
const R16_IDS = ["ko17", "ko18", "ko19", "ko20", "ko21", "ko22", "ko23", "ko24"];
const QF_IDS = ["ko25", "ko26", "ko27", "ko28"];
const SF_IDS = ["ko29", "ko30"];
const ROUNDS = [
  { key: "r32", label: "Round of 32", ids: R32_IDS },
  { key: "r16", label: "Round of 16", ids: R16_IDS },
  { key: "qf", label: "Quarter-finals", ids: QF_IDS },
  { key: "sf", label: "Semi-finals", ids: SF_IDS },
  { key: "final", label: "Final", ids: ["ko32"] },
];
const BRACKET_LOCK = new Date("2026-06-11T15:00:00-04:00").getTime();

/* ---------- bracket resolution ---------- */
function matchThirds(groups, slots) {
  const res = {}; const used = new Set();
  const bt = (i) => {
    if (i >= slots.length) return true;
    const s = slots[i];
    for (const g of groups) {
      if (used.has(g) || !s.allow.includes(g)) continue;
      used.add(g); res[s.id] = g;
      if (bt(i + 1)) return true;
      used.delete(g); delete res[s.id];
    }
    if (groups.length < slots.length) { res[s.id] = null; if (bt(i + 1)) return true; delete res[s.id]; }
    return false;
  };
  if (!bt(0)) {
    const left = groups.filter((g) => !Object.values(res).includes(g)); let li = 0;
    for (const s of slots) if (!res[s.id] && li < left.length) res[s.id] = left[li++];
  }
  return res;
}
function resolveBracket(bracket) {
  const ranks = (bracket && bracket.ranks) || {};
  const ko = (bracket && bracket.ko) || {};
  const arrOf = (g) => ranks[g] || GROUPS[g];
  const slot = (tok) => { const g = tok[0], pos = +tok[1] - 1; const a = arrOf(g); return a ? a[pos] : null; };
  const groupOf = {}; for (const g of GKEYS) { const a = arrOf(g); if (a[2]) groupOf[a[2]] = g; }
  const chosen = ((bracket && bracket.thirds) || []).filter(Boolean);
  const chosenGroups = chosen.map((t) => groupOf[t]).filter(Boolean);
  const slots = R32.filter((m) => m.b && m.b.third).map((m) => ({ id: m.id, allow: m.b.third }));
  const assign = matchThirds(chosenGroups, slots);
  const teams = {};
  for (const m of R32) {
    let b;
    if (m.b && m.b.third) { const g = assign[m.id]; b = g ? arrOf(g)[2] : null; } else b = slot(m.b);
    teams[m.id] = { a: slot(m.a), b };
  }
  const winnerOf = (id) => { const t = teams[id]; if (!t) return null; const w = ko[id]; return w === t.a || w === t.b ? w : null; };
  for (const id of [...R16_IDS, ...QF_IDS, ...SF_IDS, "ko32"]) {
    const [c1, c2] = CHILDREN[id]; teams[id] = { a: winnerOf(c1), b: winnerOf(c2) };
  }
  const loserOf = (id) => { const t = teams[id], w = ko[id]; if (!t || !w) return null; return w === t.a ? t.b : w === t.b ? t.a : null; };
  teams.ko31 = { a: loserOf("ko29"), b: loserOf("ko30") };
  return { teams, winnerOf, champion: winnerOf("ko32"), finalists: [teams.ko32.a, teams.ko32.b].filter(Boolean) };
}

/* ---------- scoring ---------- */
const PTS = { groupWinner: 3, top2: 1, third: 2, r16: 4, qf: 6, sf: 9, finalist: 12, champion: 25 };
function bracketPoints(bracket, actual) {
  const a = actual || {}; const r = resolveBracket(bracket); let pts = 0;
  if (a.groupOrder) for (const g of GKEYS) {
    const act = a.groupOrder[g]; const pr = (bracket.ranks && bracket.ranks[g]) || [];
    if (act && act.length >= 2) {
      if (pr[0] && pr[0] === act[0]) pts += PTS.groupWinner;
      const top2 = new Set([act[0], act[1]]);
      [pr[0], pr[1]].forEach((t) => { if (t && top2.has(t)) pts += PTS.top2; });
    }
  }
  if (a.thirds) { const s = new Set(a.thirds); (bracket.thirds || []).forEach((t) => { if (t && s.has(t)) pts += PTS.third; }); }
  const inter = (arr, set) => arr.reduce((n, t) => n + (set && set.has(t) ? 1 : 0), 0);
  if (a.reachedR16) pts += PTS.r16 * inter(R32_IDS.map(r.winnerOf).filter(Boolean), new Set(a.reachedR16));
  if (a.reachedQF) pts += PTS.qf * inter(R16_IDS.map(r.winnerOf).filter(Boolean), new Set(a.reachedQF));
  if (a.reachedSF) pts += PTS.sf * inter(QF_IDS.map(r.winnerOf).filter(Boolean), new Set(a.reachedSF));
  if (a.finalists) pts += PTS.finalist * inter(SF_IDS.map(r.winnerOf).filter(Boolean), new Set(a.finalists));
  if (a.champion && r.champion === a.champion) pts += PTS.champion;
  return { pts, champion: r.champion };
}
function computeStandings(roster, brackets, actual) {
  return roster.map((p) => {
    const { pts, champion } = bracketPoints(brackets[p.id] || {}, actual);
    return { id: p.id, name: p.name || p.username, username: p.username, favTeam: p.favTeam, color: p.color || "#0E7A56", photo: p.photo, points: pts, champion };
  }).sort((x, y) => y.points - x.points || x.name.localeCompare(y.name));
}

/* ---------- storage ---------- */
const hasStore = typeof window !== "undefined" && window.storage;
async function sGet(k, sh = true) { if (!hasStore) return null; try { const r = await window.storage.get(k, sh); return r ? r.value : null; } catch { return null; } }
async function sSet(k, v, sh = true) { if (!hasStore) return false; try { await window.storage.set(k, v, sh); return true; } catch { return false; } }
const jget = async (k, sh, fb) => { const v = await sGet(k, sh); if (v == null) return fb; try { return JSON.parse(v); } catch { return fb; } };
const jset = (k, o, sh) => sSet(k, JSON.stringify(o), sh);
async function loadAllBrackets() {
  const out = {}; if (!hasStore) return out;
  try { const l = await window.storage.list("wc26:bracket:", true); for (const k of (l?.keys || [])) out[k.replace("wc26:bracket:", "")] = await jget(k, true, {}); } catch {}
  return out;
}

/* ---------- misc ---------- */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" }); } catch { return ""; } };
const ago = (ts) => { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; };

const C = { paper: "#F2EEE3", card: "#FBF9F3", ink: "#1B1B17", muted: "#76715F", line: "#E4DECE", green: "#0E7A56", greenSoft: "#E7F0EA", red: "#BE3A2B", gold: "#B9892E", chip: "#EFE9DA", orange: "#E8722C", orangeSoft: "#FBEADF", blue: "#1E40C8" };
const FONT = "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "'Fraunces', Georgia, serif";
const S = {
  page: { minHeight: "100%", background: C.paper, color: C.ink, fontFamily: FONT },
  wrap: { maxWidth: 820, margin: "0 auto", padding: "0 16px 64px" },
  display: { fontFamily: SERIF },
  btn: (a) => ({ flex: 1, padding: "11px 8px", borderRadius: 10, cursor: "pointer", fontSize: 13.5, border: "1px solid " + (a ? C.ink : C.line), background: a ? C.ink : C.card, color: a ? C.paper : C.ink, fontWeight: a ? 700 : 500, transition: "all .14s" }),
  card: { background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: 14 },
  chip: { display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted, background: C.chip, padding: "3px 8px", borderRadius: 999 },
  input: { width: "100%", padding: "11px 12px", border: "1px solid " + C.line, borderRadius: 10, fontSize: 15, background: "#fff", color: C.ink },
};
const styleTag = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
    * { box-sizing: border-box; }
    ::selection { background: ${C.green}; color: #fff; }
    .wc-fade { animation: wcfade .35s ease both; }
    @keyframes wcfade { from { opacity: 0; transform: translateY(6px);} to {opacity:1; transform:none;} }
    input:focus, select:focus, textarea:focus { outline: 2px solid ${C.green}; outline-offset: 1px; }
    .hidescroll::-webkit-scrollbar { display:none; }
  `}</style>
);

function Avatar({ player, size = 48 }) {
  const [ok, setOk] = useState(true);
  const color = player.color || C.green, fav = player.favTeam, photo = player.photo;
  const initial = ((player.name || player.username || "?")[0] || "?").toUpperCase();
  const badge = Math.round(size * 0.46);
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontWeight: 700, fontSize: Math.round(size * 0.42), boxShadow: "0 0 0 1px " + C.line }}>
        {photo && ok ? <img src={photo} alt="" onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
      </div>
      {fav && <div style={{ position: "absolute", right: -2, bottom: -2, width: badge, height: badge, borderRadius: "50%", background: "#fff", border: "2px solid " + C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.26), lineHeight: 1, boxShadow: "0 1px 3px rgba(0,0,0,.18)" }}>{flag(fav)}</div>}
    </div>
  );
}

function buildSyncPrompt() {
  const groups = GKEYS.map((g) => `${g}: ${GROUPS[g].join(", ")}`).join("\n");
  return `Find official 2026 FIFA World Cup outcomes using web search. Today is ${new Date().toDateString()}.

Groups:
${groups}

Respond with ONLY this JSON (no markdown, no commentary). Include data ONLY where officially confirmed; otherwise omit the key or use an empty value:
{
 "groupOrder": {"A":["1st","2nd","3rd","4th"]},
 "thirds": ["the 8 third-placed teams that officially qualified to the Round of 32"],
 "reachedR16": ["the 16 teams that won their Round of 32 match"],
 "reachedQF": ["the 8 teams in the quarter-finals"],
 "reachedSF": ["the 4 teams in the semi-finals"],
 "finalists": ["the 2 teams in the final"],
 "champion": "the World Cup winner"
}
Use the exact team names from the groups list above. If the tournament has not produced a result yet, return {}.`;
}

/* ============================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [roster, setRoster] = useState([]);
  const [brackets, setBrackets] = useState({});
  const [actual, setActual] = useState({});
  const [adminPin, setAdminPin] = useState(null);
  const [chat, setChat] = useState([]);
  const [tab, setTab] = useState("picks");
  const [standingsView, setStandingsView] = useState("board");

  const [bracket, setBracket] = useState({ ranks: {}, thirds: [], ko: {} });
  const [step, setStep] = useState("groups");
  const [koRound, setKoRound] = useState("r32");
  const [saveState, setSaveState] = useState("idle");
  const firstWrite = useRef(true);

  const [isAdmin, setIsAdmin] = useState(false);
  const savingRef = useRef(false);

  const defaultBracket = () => ({ ranks: Object.fromEntries(GKEYS.map((g) => [g, [...GROUPS[g]]])), thirds: [], ko: {} });

  useEffect(() => {
    (async () => {
      const r = await jget("wc26:roster", true, []);
      const ac = await jget("wc26:results", true, {});
      const pin = await sGet("wc26:adminpin", true);
      const ch = await jget("wc26:chat", true, []);
      const meLocal = await jget("wc26:me", false, null);
      const bs = await loadAllBrackets();
      setRoster(r); setActual(ac); setAdminPin(pin); setChat(ch); setBrackets(bs);
      const meRow = meLocal && r.find((p) => p.id === meLocal.id);
      if (meRow) { setMe(meRow); setBracket(bs[meRow.id] || defaultBracket()); }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!me) return; let alive = true;
    const tick = async () => { const ch = await jget("wc26:chat", true, []); const ac = await jget("wc26:results", true, {}); if (!alive) return; setChat(ch); if (!savingRef.current) setActual(ac); };
    const iv = setInterval(tick, 12000); return () => { alive = false; clearInterval(iv); };
  }, [me]);

  const refreshBoard = async () => { const r = await jget("wc26:roster", true, []); const bs = await loadAllBrackets(); setRoster(r); setBrackets(bs); };
  useEffect(() => { if (me && tab === "standings") refreshBoard(); /* eslint-disable-next-line */ }, [tab, me]);

  /* autosave my bracket */
  useEffect(() => {
    if (!me) return;
    if (firstWrite.current) { firstWrite.current = false; return; }
    setSaveState("saving");
    const t = setTimeout(async () => { await jset("wc26:bracket:" + me.id, bracket, true); setBrackets((p) => ({ ...p, [me.id]: bracket })); setSaveState("saved"); setTimeout(() => setSaveState("idle"), 1300); }, 600);
    return () => clearTimeout(t);
  }, [bracket, me]);

  /* automatic results */
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const didAutoSync = useRef(false);
  const syncResults = async (silent = false) => {
    if (syncing) return; setSyncing(true); if (!silent) setSyncMsg("Checking live FIFA results…");
    try {
      const resp = await fetch("/api/sync", { method: "POST" });
      const json = await resp.json();
      if (json && json.error) throw new Error(json.error);
      const merged = { ...json, lastSync: Date.now() };
      savingRef.current = true; await jset("wc26:results", merged, true); setActual(merged); savingRef.current = false;
      const got = (json.champion ? 1 : 0) + (json.groupOrder ? Object.keys(json.groupOrder).length : 0);
      setSyncMsg(got ? "Updated from live data ✓" : "No confirmed results yet — the tournament starts June 11.");
    } catch { savingRef.current = false; setSyncMsg("Couldn't reach live results just now — try again shortly."); }
    setSyncing(false);
  };
  useEffect(() => {
    if (!me || didAutoSync.current) return; didAutoSync.current = true;
    (async () => { const cur = await jget("wc26:results", true, {}); const now = Date.now(); const started = now >= BRACKET_LOCK; const stale = !cur.lastSync || now - cur.lastSync > 600000; if (started && stale) syncResults(true); })();
    /* eslint-disable-next-line */
  }, [me]);

  /* join / rejoin */
  const [joinUser, setJoinUser] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [joinMode, setJoinMode] = useState("new");
  const [joinErr, setJoinErr] = useState("");
  const pin6 = (v) => v.replace(/\D/g, "").slice(0, 6);
  const doJoin = async () => {
    setJoinErr(""); const username = joinUser.trim(), pin = joinPin.trim();
    if (username.length < 2) return setJoinErr("Pick a username (2+ characters).");
    if (!/^\d{6}$/.test(pin)) return setJoinErr("PIN must be 6 digits.");
    const fresh = await jget("wc26:roster", true, []);
    if (joinMode === "new") {
      if (fresh.some((p) => (p.username || "").toLowerCase() === username.toLowerCase())) return setJoinErr("That username is taken — try “I'm returning”.");
      const player = { id: uid(), username, name: username, pin, favTeam: "", color: C.green, photo: "" };
      const next = [...fresh, player]; await jset("wc26:roster", next, true); await jset("wc26:me", { id: player.id }, false);
      setRoster(next); setMe(player); setBracket(defaultBracket()); firstWrite.current = true; setTab("profile");
    } else {
      const player = fresh.find((p) => (p.username || "").toLowerCase() === username.toLowerCase());
      if (!player) return setJoinErr("No account with that username yet.");
      if (player.pin !== pin) return setJoinErr("Wrong PIN.");
      await jset("wc26:me", { id: player.id }, false);
      const b = await jget("wc26:bracket:" + player.id, true, defaultBracket());
      setRoster(fresh); setMe(player); setBracket(b); firstWrite.current = true; setTab("picks");
    }
    setJoinUser(""); setJoinPin("");
  };
  const switchUser = async () => { try { await window.storage.delete("wc26:me", false); } catch {} setMe(null); setBracket({ ranks: {}, thirds: [], ko: {} }); setTab("picks"); setIsAdmin(false); };

  const saveProfile = async (patch) => { const fresh = await jget("wc26:roster", true, []); const next = fresh.map((p) => (p.id === me.id ? { ...p, ...patch } : p)); await jset("wc26:roster", next, true); setRoster(next); setMe((m) => ({ ...m, ...patch })); };

  /* admin actual edits */
  const queueActualSave = async (next) => { savingRef.current = true; setActual(next); await jset("wc26:results", next, true); setTimeout(() => (savingRef.current = false), 400); };
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
  const unlockAdmin = async () => { setAdminMsg(""); const pin = adminPinInput.trim(); if (!adminPin) { if (!/^\d{6}$/.test(pin)) return setAdminMsg("Choose a 6-digit admin PIN."); await sSet("wc26:adminpin", pin, true); setAdminPin(pin); setIsAdmin(true); setAdminPinInput(""); } else { if (pin !== adminPin) return setAdminMsg("Wrong admin PIN."); setIsAdmin(true); setAdminPinInput(""); } };
  const resetEverything = async () => { if (!window.confirm("Erase ALL players, brackets, chat and results?")) return; try { for (const pre of ["wc26:", "wc26:bracket:"]) { const a = await window.storage.list(pre, true); for (const k of (a?.keys || [])) { try { await window.storage.delete(k, true); } catch {} } } } catch {} setRoster([]); setBrackets({}); setActual({}); setChat([]); setAdminPin(null); setIsAdmin(false); setMe(null); };

  /* chat */
  const [chatInput, setChatInput] = useState("");
  const [asUpdate, setAsUpdate] = useState(false);
  const sendChat = async () => { const text = chatInput.trim(); if (!text) return; const fresh = await jget("wc26:chat", true, []); const msg = { id: uid(), uid: me.id, name: me.name || me.username, color: me.color || C.green, text: text.slice(0, 500), ts: Date.now(), update: isAdmin && asUpdate }; const next = [...fresh, msg].slice(-200); await jset("wc26:chat", next, true); setChat(next); setChatInput(""); };

  /* bracket editing */
  const locked = Date.now() >= BRACKET_LOCK;
  const resolved = resolveBracket(bracket);
  const moveTeam = (g, idx, dir) => {
    if (locked) return;
    setBracket((b) => { const arr = [...(b.ranks[g] || GROUPS[g])]; const j = idx + dir; if (j < 0 || j >= arr.length) return b; [arr[idx], arr[j]] = [arr[j], arr[idx]]; return { ...b, ranks: { ...b.ranks, [g]: arr } }; });
  };
  const resetGroup = (g) => { if (locked) return; setBracket((b) => ({ ...b, ranks: { ...b.ranks, [g]: [...GROUPS[g]] } })); };
  const shuffleGroup = (g) => { if (locked) return; setBracket((b) => ({ ...b, ranks: { ...b.ranks, [g]: shuffle(b.ranks[g] || GROUPS[g]) } })); };
  const validThirds = GKEYS.map((g) => (bracket.ranks[g] || GROUPS[g])[2]);
  const cleanThirds = (bracket.thirds || []).filter((t) => validThirds.includes(t));
  const toggleThird = (team) => {
    if (locked) return;
    setBracket((b) => { let sel = (b.thirds || []).filter((t) => validThirds.includes(t)); if (sel.includes(team)) sel = sel.filter((t) => t !== team); else if (sel.length < 8) sel = [...sel, team]; return { ...b, thirds: sel }; });
  };
  const pickWinner = (id, team) => { if (locked || !team) return; setBracket((b) => ({ ...b, ko: { ...b.ko, [id]: b.ko[id] === team ? "" : team } })); };
  const autoFill = () => {
    if (locked) return;
    const ranks = Object.fromEntries(GKEYS.map((g) => [g, shuffle(GROUPS[g])]));
    const thirds = shuffle(GKEYS.map((g) => ranks[g][2])).slice(0, 8);
    const b0 = { ranks, thirds, ko: {} }; const ko = {};
    const rr = resolveBracket(b0);
    for (const m of R32) { const t = rr.teams[m.id]; const pick = Math.random() < 0.5 ? t.a : t.b; if (pick) ko[m.id] = pick; }
    let cur = { ...b0, ko };
    for (const id of [...R16_IDS, ...QF_IDS, ...SF_IDS, "ko32"]) { const rx = resolveBracket(cur); const t = rx.teams[id]; const pick = Math.random() < 0.5 ? t.a : t.b; if (pick) cur = { ...cur, ko: { ...cur.ko, [id]: pick } }; }
    setBracket(cur);
  };

  const standings = computeStandings(roster, brackets, actual);

  if (loading) return (<div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 360 }}>{styleTag}<div style={{ textAlign: "center", color: C.muted }}><div style={{ fontSize: 34 }}>⚽</div><div style={{ marginTop: 8 }}>Loading the bracket…</div></div></div>);
  if (!hasStore) return (<div style={S.page}>{styleTag}<div style={{ ...S.wrap, paddingTop: 40 }}><div style={S.card}><h2 style={{ ...S.display, margin: 0 }}>Storage unavailable</h2><p style={{ color: C.muted }}>This app saves through Claude's artifact storage — open it inside the Claude preview panel.</p></div></div></div>);

  /* ---------------- LANDING ---------------- */
  if (!me) {
    return (
      <div style={S.page}>{styleTag}
        <div style={S.wrap}>
          <div style={{ padding: "44px 0 14px", textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>🏆⚽</div>
            <h1 style={{ ...S.display, fontSize: 40, lineHeight: 1.02, margin: "10px 0 6px", fontWeight: 700 }}>Office Bracket Challenge</h1>
            <div style={{ ...S.display, fontSize: 19, color: C.green, fontWeight: 600 }}>FIFA World Cup 2026</div>
            <div style={{ ...S.chip, marginTop: 12 }}>11 Jun – 19 Jul · USA · Canada · Mexico</div>
            <p style={{ color: C.muted, maxWidth: 470, margin: "16px auto 0", lineHeight: 1.55 }}>Predict the whole tournament — rank the groups, pick the best third-placed teams, then build your knockout bracket all the way to the champion. Lock it in before the first kick-off.</p>
          </div>
          <div style={{ display: "flex", gap: 10, margin: "8px 0 22px", flexWrap: "wrap" }}>
            {[["1️⃣", "Rank groups", "Order all 12 groups"], ["2️⃣", "Pick 8 thirds", "Fill the Round of 32"], ["3️⃣", "Build bracket", "Pick winners to the final"]].map(([e, t, d]) => (
              <div key={t} style={{ ...S.card, flex: "1 1 30%", minWidth: 150, textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>{e}</div><div style={{ fontWeight: 700, marginTop: 4 }}>{t}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{d}</div>
              </div>
            ))}
          </div>
          <div className="wc-fade" style={S.card}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button style={S.btn(joinMode === "new")} onClick={() => { setJoinMode("new"); setJoinErr(""); }}>Create account</button>
              <button style={S.btn(joinMode === "back")} onClick={() => { setJoinMode("back"); setJoinErr(""); }}>I&apos;m returning</button>
            </div>
            <label style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>Username</label>
            <input value={joinUser} onChange={(e) => setJoinUser(e.target.value)} placeholder="e.g. sam_accounts" style={{ ...S.input, margin: "5px 0 12px" }} />
            <label style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>{joinMode === "new" ? "Choose a 6-digit PIN" : "Your 6-digit PIN"}</label>
            <input value={joinPin} onChange={(e) => setJoinPin(pin6(e.target.value))} placeholder="••••••" inputMode="numeric" style={{ ...S.input, margin: "5px 0 6px", letterSpacing: 8 }} />
            <p style={{ fontSize: 11.5, color: C.muted, margin: "2px 0 12px" }}>The PIN keeps others from editing your bracket — honour-system office pool, not a bank.</p>
            {joinErr && <div style={{ color: C.red, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{joinErr}</div>}
            <button onClick={doJoin} style={{ width: "100%", padding: 13, borderRadius: 11, border: "none", background: C.green, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{joinMode === "new" ? "Join the pool →" : "Sign in →"}</button>
            {roster.length > 0 && <div style={{ marginTop: 14, fontSize: 12.5, color: C.muted }}>{roster.length} already playing: {roster.map((p) => p.name || p.username).join(", ")}</div>}
          </div>
        </div>
      </div>
    );
  }

  const tabs = [["picks", "My Bracket"], ["standings", "Standings"], ["chat", "Chat"], ["profile", "Profile"]];
  const accent = me.color || C.green;
  const groupsDone = GKEYS.length;
  const thirdsDone = cleanThirds.length;

  return (
    <div style={S.page}>{styleTag}
      <div style={S.wrap}>
        <div style={{ padding: "22px 0 12px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ ...S.display, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>Bracket Challenge</div>
            <div style={{ ...S.display, fontSize: 14, color: C.green, fontWeight: 600 }}>World Cup 2026</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13 }}><strong style={{ color: accent }}>{me.name || me.username}</strong></div>
              <button onClick={switchUser} style={{ marginTop: 4, fontSize: 12, color: C.muted, background: "none", border: "1px solid " + C.line, padding: "4px 9px", borderRadius: 8, cursor: "pointer" }}>Switch user</button>
            </div>
            <Avatar player={me} size={42} />
          </div>
        </div>

        <div className="hidescroll" style={{ display: "flex", gap: 7, marginBottom: 18, position: "sticky", top: 0, background: C.paper, padding: "8px 0", zIndex: 5, overflowX: "auto" }}>
          {tabs.map(([k, label]) => (<button key={k} style={{ ...S.btn(tab === k), flex: "1 0 auto", minWidth: 84 }} onClick={() => setTab(k)}>{label}</button>))}
        </div>

        {/* ---------- MY BRACKET ---------- */}
        {tab === "picks" && (
          <div className="wc-fade">
            {locked && <div style={{ ...S.card, marginBottom: 14, background: C.orangeSoft, borderColor: C.orange, fontSize: 13, fontWeight: 600 }}>🔒 The tournament has started — your bracket is locked and now being scored.</div>}

            {/* stepper */}
            <div style={{ display: "flex", gap: 7, marginBottom: 4 }}>
              {[["groups", "1 · Groups", groupsDone === 12], ["thirds", "2 · Best thirds", thirdsDone === 8], ["knockout", "3 · Knockout", !!resolved.champion]].map(([k, label, done]) => (
                <button key={k} onClick={() => setStep(k)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: step === k ? 700 : 500, border: "1px solid " + (step === k ? C.ink : C.line), background: step === k ? C.ink : C.card, color: step === k ? C.paper : C.ink }}>
                  {label}{done ? " ✓" : ""}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 14px" }}>
              <button onClick={autoFill} disabled={locked} style={{ fontSize: 12.5, color: locked ? C.muted : C.ink, background: C.card, border: "1px solid " + C.line, padding: "7px 12px", borderRadius: 9, cursor: locked ? "default" : "pointer", fontWeight: 600 }}>🎲 Auto-fill my bracket</button>
              <span style={{ fontSize: 12.5, color: saveState === "saved" ? C.green : C.muted, fontWeight: 600 }}>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : ""}</span>
            </div>

            {step === "groups" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12 }}>
                {GKEYS.map((g) => <GroupCard key={g} g={g} order={bracket.ranks[g] || GROUPS[g]} locked={locked} onMove={moveTeam} onReset={resetGroup} onShuffle={shuffleGroup} />)}
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => setStep("thirds")} style={{ padding: "12px 22px", borderRadius: 11, border: "none", background: C.green, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Next: best thirds →</button>
                </div>
              </div>
            )}

            {step === "thirds" && (
              <ThirdsStep validThirds={validThirds} chosen={cleanThirds} onToggle={toggleThird} locked={locked} onBack={() => setStep("groups")} onNext={() => setStep("knockout")} />
            )}

            {step === "knockout" && (
              <KnockoutStep bracket={bracket} resolved={resolved} koRound={koRound} setKoRound={setKoRound} pickWinner={pickWinner} locked={locked} onBack={() => setStep("thirds")} />
            )}
          </div>
        )}

        {/* ---------- STANDINGS ---------- */}
        {tab === "standings" && (
          <div className="wc-fade">
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button style={S.btn(standingsView === "board")} onClick={() => setStandingsView("board")}>🏅 Leaderboard</button>
              <button style={S.btn(standingsView === "results")} onClick={() => setStandingsView("results")}>⚽ Tournament</button>
            </div>
            {standingsView === "board" && (<>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={S.chip}>{standings.length} players</span>
                <button onClick={refreshBoard} style={{ fontSize: 12.5, color: C.muted, background: "none", border: "1px solid " + C.line, padding: "5px 10px", borderRadius: 8, cursor: "pointer" }}>↻ Refresh</button>
              </div>
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                {standings.length === 0 && <div style={{ padding: 20, color: C.muted }}>No players yet.</div>}
                {standings.map((row, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null; const isMe = row.id === me.id;
                  return (
                    <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", borderTop: i ? "1px solid " + C.line : "none", background: isMe ? C.greenSoft : "transparent", borderLeft: "4px solid " + (row.color || "transparent") }}>
                      <div style={{ width: 20, textAlign: "center", fontWeight: 700, color: C.muted, fontSize: 14 }}>{medal || i + 1}</div>
                      <Avatar player={row} size={36} />
                      <div style={{ flex: 1, fontWeight: isMe ? 700 : 600 }}>
                        {row.name}{isMe && <span style={{ color: C.green, fontSize: 12, fontWeight: 700 }}> · you</span>}
                        <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 500 }}>{row.champion ? "Picks " + flag(row.champion) + " " + row.champion : "Bracket incomplete"}</div>
                      </div>
                      <div style={{ ...S.display, fontSize: 24, fontWeight: 700 }}>{row.points}<span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}> pts</span></div>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11.5, color: C.muted, marginTop: 12 }}>Scoring: group winner +3 · each top-2 team +1 · qualified third +2 · reach R16 +4 · QF +6 · SF +9 · finalist +12 · champion +25.</p>
            </>)}
            {standingsView === "results" && <TournamentView actual={actual} syncing={syncing} syncMsg={syncMsg} onSync={() => syncResults(false)} />}
          </div>
        )}

        {/* ---------- CHAT ---------- */}
        {tab === "chat" && <ChatPanel chat={chat} me={me} isAdmin={isAdmin} chatInput={chatInput} setChatInput={setChatInput} asUpdate={asUpdate} setAsUpdate={setAsUpdate} sendChat={sendChat} />}

        {/* ---------- PROFILE ---------- */}
        {tab === "profile" && <Profile me={me} saveProfile={saveProfile} bracket={bracket} resolved={resolved} actual={actual} />}

        {/* ---------- ADMIN ---------- */}
        {tab === "admin" && (
          <div className="wc-fade">
            {!isAdmin ? (
              <div style={S.card}>
                <h3 style={{ ...S.display, marginTop: 0 }}>{adminPin ? "Admin sign-in" : "Optional: manual results"}</h3>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 0 }}>{adminPin ? "Enter the admin PIN to correct results or reset the pool." : "Results sync automatically from live FIFA data, so you don't need this. It's a backup — set a 6-digit PIN to correct outcomes by hand or reset the pool."}</p>
                <input value={adminPinInput} onChange={(e) => setAdminPinInput(pin6(e.target.value))} placeholder="6-digit admin PIN" inputMode="numeric" style={{ ...S.input, letterSpacing: 8 }} />
                {adminMsg && <div style={{ color: C.red, fontSize: 13, margin: "8px 0", fontWeight: 600 }}>{adminMsg}</div>}
                <button onClick={unlockAdmin} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 11, border: "none", background: C.ink, color: C.paper, fontWeight: 700, cursor: "pointer" }}>{adminPin ? "Unlock" : "Create admin PIN"}</button>
              </div>
            ) : (
              <AdminPanel actual={actual} onSave={queueActualSave} onSync={() => syncResults(false)} syncing={syncing} onReset={resetEverything} />
            )}
          </div>
        )}

        <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid " + C.line, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: C.muted }}>Office Bracket Challenge · World Cup 2026</span>
          <button onClick={() => setTab(tab === "admin" ? "picks" : "admin")} style={{ fontSize: 11.5, color: C.muted, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
            {tab === "admin" ? "← Back to my bracket" : "Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== GROUP CARD ===================== */
function GroupCard({ g, order, locked, onMove, onReset, onShuffle }) {
  const tint = (i) => i < 2 ? C.greenSoft : i === 2 ? C.orangeSoft : "transparent";
  const tag = (i) => i < 2 ? { t: "Advances", c: C.green } : i === 2 ? { t: "3rd", c: C.orange } : { t: "Out", c: C.muted };
  return (
    <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
      <div style={{ background: C.blue, color: "#fff", padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...S.display, fontWeight: 700, fontSize: 16 }}>Group {g}</span>
        <span style={{ fontSize: 14 }}>{GROUPS[g].map((t) => flag(t)).join(" ")}</span>
      </div>
      <div>
        {order.map((team, i) => {
          const tg = tag(i);
          return (
            <div key={team} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: i ? "1px solid " + C.line : "none", background: tint(i) }}>
              <div style={{ width: 16, fontWeight: 700, color: C.muted, fontSize: 13 }}>{i + 1}</div>
              <span style={{ fontSize: 18 }}>{flag(team)}</span>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{team}<span style={{ fontSize: 10.5, color: tg.c, fontWeight: 700, marginLeft: 6 }}>{tg.t}</span></div>
              {!locked && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => onMove(g, i, -1)} disabled={i === 0} style={arrowBtn(i === 0)}>▲</button>
                  <button onClick={() => onMove(g, i, 1)} disabled={i === order.length - 1} style={arrowBtn(i === order.length - 1)}>▼</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!locked && (
        <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid " + C.line }}>
          <button onClick={() => onReset(g)} style={miniBtn}>↺ Reset</button>
          <button onClick={() => onShuffle(g)} style={miniBtn}>🎲 Shuffle</button>
        </div>
      )}
    </div>
  );
}
const arrowBtn = (dis) => ({ width: 26, height: 18, lineHeight: "14px", fontSize: 10, borderRadius: 5, border: "1px solid " + C.line, background: dis ? C.chip : "#fff", color: dis ? C.line : C.ink, cursor: dis ? "default" : "pointer" });
const miniBtn = { flex: 1, fontSize: 12, padding: "7px", borderRadius: 8, border: "1px solid " + C.line, background: "#fff", color: C.ink, cursor: "pointer", fontWeight: 600 };

/* ===================== THIRDS STEP ===================== */
function ThirdsStep({ validThirds, chosen, onToggle, locked, onBack, onNext }) {
  const teams = GKEYS.map((g, i) => ({ g, team: validThirds[i] }));
  const full = chosen.length === 8;
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <h2 style={{ ...S.display, fontSize: 26, fontWeight: 700, margin: "4px 0" }}>Pick the best third-placed teams</h2>
        <p style={{ color: C.muted, fontSize: 13.5, margin: 0 }}>Choose 8 of the 12 third-placed teams to advance to the Round of 32.</p>
      </div>
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <div style={{ background: C.blue, color: "#fff", padding: "11px 15px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13.5 }}>
          <span>PICK THE BEST THIRD-PLACED TEAMS</span><span>{chosen.length} / 8</span>
        </div>
        {teams.map(({ g, team }, i) => {
          const sel = chosen.includes(team);
          const disabled = locked || (!sel && full);
          return (
            <button key={g} onClick={() => onToggle(team)} disabled={disabled} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderTop: i ? "1px solid " + C.line : "none", background: sel ? C.orange : "#fff", color: sel ? "#fff" : (disabled ? C.muted : C.ink), cursor: disabled ? "default" : "pointer", border: "none", borderLeft: sel ? "none" : "none" }}>
              <span style={{ fontSize: 11, fontWeight: 700, width: 22, opacity: .7 }}>{g}</span>
              <span style={{ fontSize: 20 }}>{flag(team)}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{team}</span>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid " + (sel ? "#fff" : C.line), background: sel ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{sel && <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange }} />}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <button onClick={onBack} style={{ padding: "12px 18px", borderRadius: 11, border: "1px solid " + C.line, background: C.card, color: C.ink, fontWeight: 600, cursor: "pointer" }}>← Groups</button>
        <button onClick={onNext} disabled={!full} style={{ padding: "12px 22px", borderRadius: 11, border: "none", background: full ? C.green : C.chip, color: full ? "#fff" : C.muted, fontWeight: 700, cursor: full ? "pointer" : "default" }}>Next: knockout →</button>
      </div>
    </div>
  );
}

/* ===================== KNOCKOUT STEP ===================== */
function KnockoutStep({ bracket, resolved, koRound, setKoRound, pickWinner, locked, onBack }) {
  const round = ROUNDS.find((r) => r.key === koRound) || ROUNDS[0];
  const champ = resolved.champion;
  const TeamRow = ({ team, picked, onPick, dim }) => (
    <button onClick={() => team && onPick()} disabled={locked || !team} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", border: "none", borderTop: dim ? "1px solid " + C.line : "none", background: picked ? C.orange : "#fff", color: picked ? "#fff" : (team ? C.ink : C.muted), cursor: locked || !team ? "default" : "pointer", textAlign: "left" }}>
      <span style={{ fontSize: 17 }}>{team ? flag(team) : "—"}</span>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{team || "To be decided"}</span>
      <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid " + (picked ? "#fff" : C.line), background: picked ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{picked && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange }} />}</span>
    </button>
  );

  return (
    <div>
      <div className="hidescroll" style={{ display: "flex", gap: 7, marginBottom: 14, overflowX: "auto" }}>
        {ROUNDS.map((r) => <button key={r.key} onClick={() => setKoRound(r.key)} style={{ ...S.btn(koRound === r.key), flex: "1 0 auto", minWidth: 92, padding: "9px 10px", fontSize: 12.5 }}>{r.label}</button>)}
      </div>

      {champ && (
        <div style={{ ...S.card, marginBottom: 14, textAlign: "center", background: C.blue, color: "#fff", borderColor: C.blue }}>
          <div style={{ fontSize: 12, letterSpacing: ".08em", opacity: .85 }}>YOUR WORLD CUP 2026 WINNER</div>
          <div style={{ ...S.display, fontSize: 30, fontWeight: 700, marginTop: 4 }}>{flag(champ)} {champ}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: round.ids.length > 4 ? "repeat(auto-fill, minmax(240px, 1fr))" : "1fr", gap: 12 }}>
        {round.ids.map((id) => {
          const t = resolved.teams[id] || {}; const meta = id.startsWith("ko") && R32.find((m) => m.id === id) ? R32.find((m) => m.id === id) : KO_META[id];
          const w = bracket.ko[id];
          return (
            <div key={id} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "8px 11px", fontSize: 11, color: C.muted, fontWeight: 600, borderBottom: "1px solid " + C.line, background: C.chip }}>
                {meta ? fmtDate(meta.dt) + " · " + (meta.venue || "") : id}
              </div>
              <TeamRow team={t.a} picked={w && w === t.a} onPick={() => pickWinner(id, t.a)} dim={false} />
              <TeamRow team={t.b} picked={w && w === t.b} onPick={() => pickWinner(id, t.b)} dim={true} />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={onBack} style={{ padding: "12px 18px", borderRadius: 11, border: "1px solid " + C.line, background: C.card, color: C.ink, fontWeight: 600, cursor: "pointer" }}>← Best thirds</button>
      </div>
      <p style={{ fontSize: 11.5, color: C.muted, marginTop: 12 }}>Tap a team to advance them. Later rounds fill in as you pick. Third-place teams are slotted into the bracket respecting each match&apos;s eligible groups.</p>
    </div>
  );
}

/* ===================== TOURNAMENT (actual) ===================== */
function TournamentView({ actual, syncing, syncMsg, onSync }) {
  const a = actual || {};
  const winners = a.groupOrder ? GKEYS.filter((g) => a.groupOrder[g]).map((g) => ({ g, team: a.groupOrder[g][0] })) : [];
  return (
    <div>
      <div style={{ ...S.card, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>⚡ Automatic results</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{syncMsg || (a.lastSync ? "Last checked " + ago(a.lastSync) + " ago" : "Pulls verified outcomes from live data.")}</div>
        </div>
        <button onClick={onSync} disabled={syncing} style={{ padding: "9px 14px", borderRadius: 10, border: "none", background: syncing ? C.chip : C.green, color: syncing ? C.muted : "#fff", fontWeight: 700, fontSize: 13, cursor: syncing ? "default" : "pointer" }}>{syncing ? "Syncing…" : "Sync now"}</button>
      </div>
      {a.champion && (
        <div style={{ ...S.card, marginBottom: 14, textAlign: "center", background: C.blue, color: "#fff", borderColor: C.blue }}>
          <div style={{ fontSize: 12, letterSpacing: ".08em", opacity: .85 }}>WORLD CUP 2026 CHAMPION</div>
          <div style={{ ...S.display, fontSize: 30, fontWeight: 700, marginTop: 4 }}>{flag(a.champion)} {a.champion}</div>
        </div>
      )}
      {a.finalists && a.finalists.length === 2 && <div style={{ ...S.card, marginBottom: 14, textAlign: "center" }}><span style={S.chip}>Finalists</span><div style={{ marginTop: 8, fontWeight: 700 }}>{flag(a.finalists[0])} {a.finalists[0]} &nbsp;v&nbsp; {flag(a.finalists[1])} {a.finalists[1]}</div></div>}
      <span style={S.chip}>Group winners</span>
      <div style={{ ...S.card, padding: 0, overflow: "hidden", marginTop: 10 }}>
        {winners.length === 0 ? <div style={{ padding: 18, color: C.muted, fontSize: 14 }}>No group results confirmed yet — the tournament starts June 11.</div> :
          winners.map(({ g, team }, i) => (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderTop: i ? "1px solid " + C.line : "none" }}>
              <span style={{ width: 20, fontWeight: 700, color: C.muted }}>{g}</span><span style={{ fontSize: 18 }}>{flag(team)}</span><span style={{ fontWeight: 600 }}>{team}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ===================== CHAT ===================== */
function ChatPanel({ chat, me, isAdmin, chatInput, setChatInput, asUpdate, setAsUpdate, sendChat }) {
  const endRef = useRef(null);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" }); }, [chat.length]);
  return (
    <div className="wc-fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={S.chip}>Group chat & live updates</span><span style={{ fontSize: 11.5, color: C.muted }}>● refreshes every 12s</span>
      </div>
      <div style={{ ...S.card, padding: 0, height: 440, display: "flex", flexDirection: "column" }}>
        <div className="hidescroll" style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px" }}>
          {chat.length === 0 && <div style={{ color: C.muted, fontSize: 14, textAlign: "center", marginTop: 40 }}>No messages yet. Kick things off! 👋</div>}
          {chat.map((m) => {
            const mine = m.uid === me.id;
            if (m.update) return (
              <div key={m.id} style={{ margin: "10px 0", padding: "10px 12px", borderRadius: 12, background: "#FFF6E6", border: "1px solid " + C.gold }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: ".05em" }}>📣 UPDATE · {m.name} · {ago(m.ts)}</div>
                <div style={{ fontSize: 14, marginTop: 3, fontWeight: 600 }}>{m.text}</div>
              </div>
            );
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "8px 0" }}>
                <div style={{ maxWidth: "78%" }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 2, textAlign: mine ? "right" : "left" }}><span style={{ color: m.color, fontWeight: 700 }}>{m.name}</span> · {ago(m.ts)}</div>
                  <div style={{ padding: "8px 11px", borderRadius: 12, fontSize: 14, lineHeight: 1.35, background: mine ? C.green : C.chip, color: mine ? "#fff" : C.ink, borderTopRightRadius: mine ? 3 : 12, borderTopLeftRadius: mine ? 12 : 3, wordBreak: "break-word" }}>{m.text}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div style={{ borderTop: "1px solid " + C.line, padding: 10 }}>
          {isAdmin && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.gold, fontWeight: 600, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={asUpdate} onChange={(e) => setAsUpdate(e.target.checked)} /> 📣 Post as match update</label>}
          <div style={{ display: "flex", gap: 8 }}>
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} placeholder="Say something…" style={{ ...S.input, padding: "10px 12px" }} />
            <button onClick={sendChat} style={{ padding: "0 18px", borderRadius: 10, border: "none", background: C.green, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== PROFILE ===================== */
function Profile({ me, saveProfile, bracket, resolved, actual }) {
  const ACCENTS = [["Pitch", "#0E7A56"], ["Royal", "#2563A8"], ["Rosso", "#BE3A2B"], ["Grape", "#6D4AA8"], ["Amber", "#C9742B"], ["Teal", "#0E7A7A"], ["Berry", "#B83A6E"], ["Slate", "#44506B"]];
  const [name, setName] = useState(me.name || me.username);
  const [fav, setFav] = useState(me.favTeam || "");
  const [color, setColor] = useState(me.color || C.green);
  const [photo, setPhoto] = useState(me.photo || "");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setName(me.name || me.username); setFav(me.favTeam || ""); setColor(me.color || C.green); setPhoto(me.photo || ""); }, [me.id]);
  const dirty = name.trim() !== (me.name || me.username) || fav !== (me.favTeam || "") || color !== (me.color || C.green) || photo.trim() !== (me.photo || "");
  const save = async () => { await saveProfile({ name: name.trim() || me.username, favTeam: fav, color, photo: photo.trim() }); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const preview = { name, username: me.username, favTeam: fav, color, photo: photo.trim() };
  const { pts } = bracketPoints(bracket, actual);

  return (
    <div className="wc-fade">
      <span style={S.chip}>Your profile</span>
      <div style={{ ...S.card, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Avatar player={preview} size={58} />
          <div><div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div><div style={{ fontSize: 12.5, color: C.muted }}>@{me.username}{fav ? " · supports " + fav : ""}</div></div>
        </div>
        <label style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>Profile photo</label>
        <input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="Paste an image URL (e.g. your Google photo link)" style={{ ...S.input, margin: "5px 0 4px" }} />
        <p style={{ fontSize: 11.5, color: C.muted, margin: "0 0 14px" }}>Leave blank to use your initials.</p>
        <label style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...S.input, margin: "5px 0 14px" }} />
        <label style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>Favourite team</label>
        <select value={fav} onChange={(e) => setFav(e.target.value)} style={{ ...S.input, margin: "5px 0 14px", appearance: "auto" }}>
          <option value="">— none —</option>{ALL_TEAMS.map((t) => <option key={t} value={t}>{flag(t)} {t}</option>)}
        </select>
        <label style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>Accent colour</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, margin: "8px 0 16px" }}>
          {ACCENTS.map(([n, v]) => <button key={v} onClick={() => setColor(v)} title={n} style={{ width: 34, height: 34, borderRadius: "50%", background: v, cursor: "pointer", border: color === v ? "3px solid " + C.ink : "3px solid transparent", boxShadow: "0 0 0 1px " + C.line }} />)}
        </div>
        <button onClick={save} disabled={!dirty} style={{ width: "100%", padding: 12, borderRadius: 11, border: "none", background: dirty ? C.green : C.chip, color: dirty ? "#fff" : C.muted, fontWeight: 700, cursor: dirty ? "pointer" : "default" }}>{saved ? "Saved ✓" : "Save profile"}</button>
        <p style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>Username and PIN can&apos;t change — they&apos;re how you sign back in.</p>
      </div>

      <div style={{ ...S.chip, marginTop: 18 }}>Your bracket</div>
      <div style={{ ...S.card, marginTop: 10, display: "flex", gap: 10 }}>
        <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700 }}>{pts}</div><div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>Points</div></div>
        <div style={{ flex: 2, textAlign: "center", borderLeft: "1px solid " + C.line }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Your champion pick</div>
          <div style={{ ...S.display, fontSize: 20, fontWeight: 700, marginTop: 2 }}>{resolved.champion ? flag(resolved.champion) + " " + resolved.champion : "—"}</div>
          {resolved.finalists.length === 2 && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>Final: {SHORT[resolved.finalists[0]]} v {SHORT[resolved.finalists[1]]}</div>}
        </div>
      </div>
    </div>
  );
}

/* ===================== ADMIN ===================== */
function AdminPanel({ actual, onSave, onSync, syncing, onReset }) {
  const a = actual || {};
  const setGroupPos = (g, pos, team) => {
    const go = { ...(a.groupOrder || {}) }; const arr = [...(go[g] || ["", "", "", ""])]; arr[pos] = team; go[g] = arr; onSave({ ...a, groupOrder: go });
  };
  const setField = (k, v) => onSave({ ...a, [k]: v });
  const setFinalist = (i, v) => { const f = [...(a.finalists || ["", ""])]; f[i] = v; onSave({ ...a, finalists: f }); };
  return (
    <div>
      <div style={{ ...S.card, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: C.muted }}>Results are automatic. Use these only to correct or seed outcomes by hand.</div>
        <button onClick={onSync} disabled={syncing} style={{ padding: "8px 13px", borderRadius: 9, border: "none", background: syncing ? C.chip : C.green, color: syncing ? C.muted : "#fff", fontWeight: 700, fontSize: 12.5, cursor: syncing ? "default" : "pointer" }}>{syncing ? "Syncing…" : "Re-sync"}</button>
      </div>

      <span style={S.chip}>Champion & finalists</span>
      <div style={{ ...S.card, marginTop: 10, marginBottom: 16, display: "grid", gap: 10 }}>
        <Sel label="Champion" value={a.champion || ""} onChange={(v) => setField("champion", v)} options={ALL_TEAMS} />
        <Sel label="Finalist 1" value={(a.finalists || [])[0] || ""} onChange={(v) => setFinalist(0, v)} options={ALL_TEAMS} />
        <Sel label="Finalist 2" value={(a.finalists || [])[1] || ""} onChange={(v) => setFinalist(1, v)} options={ALL_TEAMS} />
      </div>

      <span style={S.chip}>Group 1st & 2nd (for scoring)</span>
      <div style={{ ...S.card, marginTop: 10, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
        {GKEYS.map((g) => (
          <div key={g}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Group {g}</div>
            <Sel label="1st" value={(a.groupOrder?.[g] || [])[0] || ""} onChange={(v) => setGroupPos(g, 0, v)} options={GROUPS[g]} small />
            <div style={{ height: 6 }} />
            <Sel label="2nd" value={(a.groupOrder?.[g] || [])[1] || ""} onChange={(v) => setGroupPos(g, 1, v)} options={GROUPS[g]} small />
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>Thirds and deeper knockout rounds (R16/QF/SF) are filled by the automatic sync.</p>
      <button onClick={onReset} style={{ width: "100%", padding: 11, borderRadius: 10, border: "1px solid " + C.red, background: "#fff", color: C.red, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Reset entire pool (delete everything)</button>
    </div>
  );
}
function Sel({ label, value, onChange, options, small }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...S.input, marginTop: 4, padding: small ? "8px 10px" : "11px 12px", fontSize: small ? 13 : 15, appearance: "auto" }}>
        <option value="">—</option>{options.map((t) => <option key={t} value={t}>{flag(t)} {t}</option>)}
      </select>
    </label>
  );
}
