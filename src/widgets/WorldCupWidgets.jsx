/**
 * ================================================================
 * WorldCupWidgets.jsx — Free embeddable World Cup 2026 widgets
 * ================================================================
 * Data source: worldcup26.ir (open-source, NO API KEY required)
 * GitHub: github.com/rezarahiminia/worldcup2026
 *
 * Widgets:
 *   <LivescoreWidget />             live + today's scores
 *   <StandingsWidget />             group standings table
 *   <BracketWidget />               knockout bracket
 *   <HubWidget />                   tournament overview
 *   <MatchCentreWidget />           single-match deep dive
 *   <SquadWidget />                 team fixtures & rivals
 *   <TopscorersWidget />            teams ranked by goals
 *   <TournamentLivescoreWidget />   full 104-match feed
 *
 * Usage (no API key needed):
 *   import { LivescoreWidget } from './widgets/WorldCupWidgets';
 *   <LivescoreWidget />
 *   <StandingsWidget group="A" />
 *   <MatchCentreWidget team="United States" />
 *
 * Pass theme="dark" for dark mode on any widget.
 * ================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";

/* ── API ────────────────────────────────────────────────────────── */

const BASE = "https://worldcup26.ir";

// Team id → name map (matches the API's numeric IDs exactly)
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

// Reverse map: name → id
const TEAM_ID_BY_NAME = Object.fromEntries(
  Object.entries(TEAM_BY_ID).map(([id, name]) => [name, id])
);

const FLAGS = {
  Mexico:"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷","Czech Republic":"🇨🇿",
  Canada:"🇨🇦","Bosnia and Herzegovina":"🇧🇦",Qatar:"🇶🇦",Switzerland:"🇨🇭",
  Brazil:"🇧🇷",Morocco:"🇲🇦",Haiti:"🇭🇹",Scotland:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "United States":"🇺🇸",Paraguay:"🇵🇾",Australia:"🇦🇺",Turkey:"🇹🇷",
  Germany:"🇩🇪","Curaçao":"🇨🇼","Ivory Coast":"🇨🇮",Ecuador:"🇪🇨",
  Netherlands:"🇳🇱",Japan:"🇯🇵",Sweden:"🇸🇪",Tunisia:"🇹🇳",
  Belgium:"🇧🇪",Egypt:"🇪🇬",Iran:"🇮🇷","New Zealand":"🇳🇿",
  Spain:"🇪🇸","Cape Verde":"🇨🇻","Saudi Arabia":"🇸🇦",Uruguay:"🇺🇾",
  France:"🇫🇷",Senegal:"🇸🇳",Iraq:"🇮🇶",Norway:"🇳🇴",
  Argentina:"🇦🇷",Algeria:"🇩🇿",Austria:"🇦🇹",Jordan:"🇯🇴",
  Portugal:"🇵🇹","DR Congo":"🇨🇩",Uzbekistan:"🇺🇿",Colombia:"🇨🇴",
  England:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",Croatia:"🇭🇷",Ghana:"🇬🇭",Panama:"🇵🇦",
};

const GROUPS_BY_TEAM = {
  Mexico:"A","South Africa":"A","South Korea":"A","Czech Republic":"A",
  Canada:"B","Bosnia and Herzegovina":"B",Qatar:"B",Switzerland:"B",
  Brazil:"C",Morocco:"C",Haiti:"C",Scotland:"C",
  "United States":"D",Paraguay:"D",Australia:"D",Turkey:"D",
  Germany:"E","Curaçao":"E","Ivory Coast":"E",Ecuador:"E",
  Netherlands:"F",Japan:"F",Sweden:"F",Tunisia:"F",
  Belgium:"G",Egypt:"G",Iran:"G","New Zealand":"G",
  Spain:"H","Cape Verde":"H","Saudi Arabia":"H",Uruguay:"H",
  France:"I",Senegal:"I",Iraq:"I",Norway:"I",
  Argentina:"J",Algeria:"J",Austria:"J",Jordan:"J",
  Portugal:"K","DR Congo":"K",Uzbekistan:"K",Colombia:"K",
  England:"L",Croatia:"L",Ghana:"L",Panama:"L",
};

const GROUPS = {
  A:["Mexico","South Africa","South Korea","Czech Republic"],
  B:["Canada","Bosnia and Herzegovina","Qatar","Switzerland"],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["United States","Paraguay","Australia","Turkey"],
  E:["Germany","Curaçao","Ivory Coast","Ecuador"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Iraq","Norway"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","DR Congo","Uzbekistan","Colombia"],
  L:["England","Croatia","Ghana","Panama"],
};

// Normalise a raw game object into a consistent shape
function normaliseGame(g) {
  const homeId = g.home_team_id;
  const awayId = g.away_team_id;
  const homeName = g.home_team_name_en || TEAM_BY_ID[homeId] || g.home_team_label || "TBD";
  const awayName = g.away_team_name_en || TEAM_BY_ID[awayId] || g.away_team_label || "TBD";
  const finished = g.time_elapsed === "finished";
  const live     = g.time_elapsed === "live";
  const status   = finished ? "finished" : live ? "live" : "scheduled";

  // Parse "MM/DD/YYYY HH:mm" → ISO string (treat as UTC-6 approx, just used for display)
  let kickoff_utc = null;
  if (g.local_date) {
    const [datePart, timePart] = g.local_date.split(" ");
    const [mo, dy, yr] = datePart.split("/");
    kickoff_utc = `${yr}-${mo}-${dy}T${timePart}:00`;
  }

  return {
    id: g.id,
    home_team: homeName,
    away_team: awayName,
    home_team_id: homeId,
    away_team_id: awayId,
    home_team_label: g.home_team_label || null,
    away_team_label: g.away_team_label || null,
    home_score: finished || live ? parseInt(g.home_score, 10) : null,
    away_score: finished || live ? parseInt(g.away_score, 10) : null,
    home_scorers: g.home_scorers && g.home_scorers !== "null" ? g.home_scorers : null,
    away_scorers: g.away_scorers && g.away_scorers !== "null" ? g.away_scorers : null,
    status,
    phase: live ? "live" : finished ? "FT" : "PRE",
    round: g.type,        // group | r32 | r16 | qf | sf | final | third
    group_name: g.group && g.group.length === 1 ? g.group : null,
    matchday: g.matchday,
    stadium_id: g.stadium_id,
    kickoff_utc,
    raw_date: g.local_date,
  };
}

/* ── Theme ─────────────────────────────────────────────────────── */

function useTheme(theme = "light") {
  const d = theme === "dark";
  return {
    bg:         d ? "#111"     : "#fff",
    bgSoft:     d ? "#1a1a1a"  : "#f7f7f5",
    border:     d ? "#2a2a2a"  : "#e8e8e6",
    text:       d ? "#f0f0ee"  : "#111",
    muted:      d ? "#666"     : "#888",
    accent:     "#e63329",
    accentSoft: d ? "#2a1010"  : "#fff0ef",
    live:       "#16a34a",
    liveSoft:   d ? "#0d2010"  : "#f0fdf4",
    gold:       "#d4a017",
    font:       "'Inter', ui-sans-serif, system-ui, sans-serif",
    radius:     "10px",
    dark: d,
  };
}

/* ── Shared data fetcher ────────────────────────────────────────── */

// Cache fetched data in module scope to avoid redundant requests
const _cache = {};
const _inFlight = {};

async function apiFetch(path) {
  if (_cache[path]) return _cache[path];
  if (_inFlight[path]) return _inFlight[path];
  const promise = fetch(BASE + path)
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .then(data => { _cache[path] = data; delete _inFlight[path]; return data; })
    .catch(e => { delete _inFlight[path]; throw e; });
  _inFlight[path] = promise;
  return promise;
}

function useApiData(path, refreshMs = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (bustCache = false) => {
    if (bustCache) delete _cache[path];
    try {
      const d = await apiFetch(path);
      if (mountedRef.current) { setData(d); setLoading(false); setError(null); }
    } catch (e) {
      if (mountedRef.current) { setError(e.message); setLoading(false); }
    }
  }, [path]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    load();
    if (refreshMs > 0) {
      const iv = setInterval(() => load(true), refreshMs);
      return () => { mountedRef.current = false; clearInterval(iv); };
    }
    return () => { mountedRef.current = false; };
  }, [load, refreshMs]);

  return { data, loading, error, refetch: () => load(true) };
}

/* ── Highlights (SerpApi enrichment) ───────────────────────────── */

// Module-level highlight cache — persists across widget re-renders,
// cleared only on page reload. Populated by POST /api/highlights.
const _highlights = {};   // "TeamA_vs_TeamB" → { link, thumbnail, duration, score, date }
let _highlightsFetchedAt = 0;
let _highlightsFetching  = false;
const HIGHLIGHTS_TTL = 15 * 60 * 1000; // re-fetch at most every 15 min

function highlightKey(team1, team2) {
  return [team1, team2].filter(Boolean).sort().join("_vs_").replace(/\s+/g, "_");
}

async function fetchAndCacheHighlights() {
  if (_highlightsFetching) return;
  if (Date.now() - _highlightsFetchedAt < HIGHLIGHTS_TTL) return;
  _highlightsFetching = true;
  try {
    // POST triggers SerpApi fetch on the server; response includes full cache
    const res = await fetch("/api/highlights", { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    if (data.highlights) {
      Object.assign(_highlights, data.highlights);
    }
    _highlightsFetchedAt = Date.now();
  } catch {
    // Highlights are optional — fail silently
  } finally {
    _highlightsFetching = false;
  }
}

// Kick off a background highlights fetch when widgets load (non-blocking)
// Called at module level so it runs once across all widget instances
setTimeout(fetchAndCacheHighlights, 2000);

function useHighlight(homeTeam, awayTeam, isFinished) {
  const [highlight, setHighlight] = useState(null);
  const key = highlightKey(homeTeam, awayTeam);

  useEffect(() => {
    if (!isFinished) return;
    // Check module cache first
    if (_highlights[key]) { setHighlight(_highlights[key]); return; }
    // Otherwise try a GET to see if server has it cached
    fetch(`/api/highlights?match=${encodeURIComponent(key)}`)
      .then(r => r.json())
      .then(d => { if (d.highlight) { _highlights[key] = d.highlight; setHighlight(d.highlight); } })
      .catch(() => {});
  }, [key, isFinished]);

  return highlight;
}

function HighlightCard({ t, highlight, compact = false }) {
  if (!highlight?.link) return null;
  return (
    <a
      href={highlight.link}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 8 : 12,
        padding: compact ? "8px 12px" : "10px 16px",
        background: t.bgSoft,
        borderTop: `1px solid ${t.border}`,
        textDecoration: "none",
        color: t.text,
        transition: "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = t.border}
      onMouseLeave={e => e.currentTarget.style.background = t.bgSoft}
    >
      {/* Thumbnail */}
      {highlight.thumbnail && !compact && (
        <div style={{
          position: "relative", flexShrink: 0,
          width: 80, height: 45, borderRadius: 5, overflow: "hidden",
          background: "#000",
        }}>
          <img
            src={highlight.thumbnail}
            alt="Match highlights"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
            onError={e => { e.target.style.display = "none"; }}
          />
          {/* Play button overlay */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "rgba(230,51,41,0.92)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 9, color: "#fff", marginLeft: 2 }}>▶</span>
            </div>
          </div>
        </div>
      )}
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: compact ? 11 : 12, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {!compact && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".05em",
              background: "#e63329", color: "#fff",
              padding: "1px 6px", borderRadius: 3, flexShrink: 0,
            }}>▶ HIGHLIGHTS</span>
          )}
          {compact && <span style={{ color: t.accent, fontSize: 14 }}>▶</span>}
          <span style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: compact ? t.accent : t.text,
          }}>
            {compact ? "Watch highlights" : `Watch match highlights`}
          </span>
          {highlight.duration && !compact && (
            <span style={{ color: t.muted, fontSize: 11, flexShrink: 0 }}>{highlight.duration}</span>
          )}
        </div>
        {!compact && highlight.date && (
          <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
            {highlight.tournament || "FIFA World Cup 2026"} · {highlight.date}
          </div>
        )}
      </div>
      <span style={{ color: t.muted, fontSize: 12, flexShrink: 0 }}>↗</span>
    </a>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function Flag({ team, size = 18 }) {
  return <span style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}>{FLAGS[team] || "⚽"}</span>;
}

function fmtTime(kickoff_utc) {
  if (!kickoff_utc) return "";
  try {
    return new Date(kickoff_utc).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

function fmtDateTime(kickoff_utc) {
  if (!kickoff_utc) return "TBD";
  try {
    return new Date(kickoff_utc).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return kickoff_utc; }
}

function fmtDateHeader(kickoff_utc) {
  if (!kickoff_utc) return "";
  try {
    const today = new Date().toDateString();
    const d = new Date(kickoff_utc);
    if (d.toDateString() === today) return "Today";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch { return kickoff_utc?.slice(0, 10) || ""; }
}

function dateKey(kickoff_utc) {
  return kickoff_utc ? kickoff_utc.slice(0, 10) : "unknown";
}

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

/* ── Shared UI ──────────────────────────────────────────────────── */

function Shell({ t, title, subtitle, badge, children, style }) {
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`, borderRadius: t.radius,
      fontFamily: t.font, color: t.text, overflow: "hidden", fontSize: 14, ...style,
    }}>
      <div style={{
        background: t.accent, padding: "11px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "#fff" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: "rgba(255,255,255,.75)", marginTop: 1 }}>{subtitle}</div>}
        </div>
        {badge && (
          <div style={{
            fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.2)",
            color: "#fff", padding: "3px 9px", borderRadius: 999, letterSpacing: ".05em",
          }}>{badge}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function Spinner({ t }) {
  return (
    <div style={{ padding: 32, textAlign: "center", color: t.muted, fontSize: 13 }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>⚽</div>Loading…
    </div>
  );
}

function Err({ t, msg }) {
  return (
    <div style={{ padding: 20, color: t.accent, fontSize: 12, textAlign: "center" }}>
      {msg || "Could not load data"}
    </div>
  );
}

function Empty({ t, msg }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: t.muted, fontSize: 13 }}>
      {msg || "No data available"}
    </div>
  );
}

function TabBar({ t, tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
      {tabs.map(({ id, label }) => (
        <button key={id} onClick={() => onSelect(id)} style={{
          flex: 1, padding: "8px 4px", border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: active === id ? 700 : 500,
          background: active === id ? t.accent : "transparent",
          color: active === id ? "#fff" : t.muted,
        }}>{label}</button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Shared MatchRow — used by Livescore and Tournament widgets
   ════════════════════════════════════════════════════════════════ */

function MatchRow({ g, t, i, showGroup = false }) {
  const done = g.status === "finished";
  const live = g.status === "live";
  const highlight = useHighlight(g.home_team, g.away_team, done);

  return (
    <div style={{ borderTop: i ? `1px solid ${t.border}` : "none" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "11px 16px",
        background: live ? t.liveSoft : "transparent",
      }}>
        <div style={{ width: 46, fontSize: 11, color: t.muted, flexShrink: 0, textAlign: "center" }}>
          {live
            ? <span style={{ color: t.live, fontWeight: 700 }}>LIVE</span>
            : done
              ? <span>FT</span>
              : <span>{fmtTime(g.kickoff_utc)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <Flag team={g.home_team} size={15} />
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {g.home_team}
            </span>
            {g.home_score != null && <span style={{ fontSize: 15, fontWeight: 700 }}>{g.home_score}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Flag team={g.away_team} size={15} />
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {g.away_team}
            </span>
            {g.away_score != null && <span style={{ fontSize: 15, fontWeight: 700 }}>{g.away_score}</span>}
          </div>
        </div>
        {showGroup && g.group_name && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: t.accent,
            background: t.accentSoft, padding: "2px 7px", borderRadius: 4, flexShrink: 0,
          }}>GRP {g.group_name}</span>
        )}
      </div>
      {/* Compact highlight link — appears only for finished matches with a highlight */}
      {highlight && <HighlightCard t={t} highlight={highlight} compact />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   1. LIVESCORE WIDGET
   ════════════════════════════════════════════════════════════════ */

export function LivescoreWidget({ theme = "light", style }) {
  const t = useTheme(theme);
  const { data, loading, error } = useApiData("/get/games", 30_000);
  const [filter, setFilter] = useState("today");

  const games = (data?.games || []).map(normaliseGame);
  const today = todayKey();
  const liveCount = games.filter(g => g.status === "live").length;

  const visible = games.filter(g => {
    if (filter === "live")    return g.status === "live";
    if (filter === "today")   return dateKey(g.kickoff_utc) === today;
    return g.status === "finished";
  });

  return (
    <Shell t={t} title="Livescore" subtitle="FIFA World Cup 2026"
      badge={liveCount ? `${liveCount} LIVE` : null} style={style}>
      <TabBar t={t}
        tabs={[
          { id: "live",  label: `Live${liveCount ? ` (${liveCount})` : ""}` },
          { id: "today", label: "Today" },
          { id: "all",   label: "Results" },
        ]}
        active={filter} onSelect={setFilter}
      />
      {loading && <Spinner t={t} />}
      {error   && <Err t={t} msg={error} />}
      {!loading && !error && visible.length === 0 && (
        <Empty t={t} msg={filter === "live" ? "No matches live right now" : "No matches today"} />
      )}
      {visible.map((g, i) => (
        <MatchRow key={g.id} g={g} t={t} i={i} showGroup />
      ))}
      <div style={{
        padding: "7px 16px", borderTop: `1px solid ${t.border}`,
        fontSize: 11, color: t.muted, textAlign: "right",
      }}>Refreshes every 30s</div>
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════
   2. STANDINGS WIDGET
   ════════════════════════════════════════════════════════════════ */

export function StandingsWidget({ theme = "light", group, style }) {
  const t = useTheme(theme);
  const { data, loading, error } = useApiData("/get/groups", 60_000);
  const { data: teamsData } = useApiData("/get/teams", 0);
  const [active, setActive] = useState(group || "A");

  // Build id→name from live teams endpoint when available
  const idToName = {};
  (teamsData?.teams || []).forEach(tm => { idToName[tm.id] = tm.name_en; });
  // Fallback to hardcoded map
  Object.assign(idToName, { ...TEAM_BY_ID, ...idToName });

  const groupKeys = Object.keys(GROUPS);
  const rawGroup = (data?.groups || []).find(g => g.name === active);
  const rows = rawGroup
    ? [...rawGroup.teams]
        .sort((a, b) => parseInt(b.pts) - parseInt(a.pts) || parseInt(b.gd) - parseInt(a.gd) || parseInt(b.gf) - parseInt(a.gf))
        .map((row, i) => ({
          position: i + 1,
          team: idToName[row.team_id] || `Team ${row.team_id}`,
          played: parseInt(row.mp),
          won: parseInt(row.w),
          drawn: parseInt(row.d),
          lost: parseInt(row.l),
          goals_for: parseInt(row.gf),
          goals_against: parseInt(row.ga),
          goal_difference: parseInt(row.gd),
          points: parseInt(row.pts),
        }))
    : GROUPS[active].map((name, i) => ({
        position: i + 1, team: name,
        played: 0, won: 0, drawn: 0, lost: 0,
        goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
      }));

  const cols = ["#", "Team", "P", "W", "D", "L", "GF", "GD", "Pts"];
  const grid = "28px 1fr 26px 26px 26px 26px 26px 30px 32px";

  return (
    <Shell t={t} title="Group Standings" subtitle="FIFA World Cup 2026" style={style}>
      <div style={{
        display: "flex", overflowX: "auto", gap: 5, padding: "8px 14px",
        borderBottom: `1px solid ${t.border}`, background: t.bgSoft,
      }}>
        {groupKeys.map(g => (
          <button key={g} onClick={() => setActive(g)} style={{
            padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: active === g ? 700 : 500, flexShrink: 0,
            background: active === g ? t.accent : t.bg,
            color: active === g ? "#fff" : t.text,
          }}>{g}</button>
        ))}
      </div>
      {loading && <Spinner t={t} />}
      {error   && <Err t={t} msg={error} />}
      {!loading && !error && (<>
        <div style={{
          display: "grid", gridTemplateColumns: grid,
          padding: "6px 14px", gap: 2,
          fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: ".06em",
          borderBottom: `1px solid ${t.border}`, background: t.bgSoft,
        }}>
          {cols.map(c => <span key={c} style={{ textAlign: c === "Team" ? "left" : "center" }}>{c}</span>)}
        </div>
        {rows.map((row, i) => (
          <div key={row.team} style={{
            display: "grid", gridTemplateColumns: grid,
            padding: "9px 14px", gap: 2, alignItems: "center",
            borderTop: i ? `1px solid ${t.border}` : "none",
            background: i < 2 ? t.liveSoft : i === 2 ? t.accentSoft : "transparent",
            borderLeft: `3px solid ${i < 2 ? t.live : i === 2 ? t.gold : "transparent"}`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.muted, textAlign: "center" }}>{row.position}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
              <Flag team={row.team} size={14} />
              <span style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.team}
              </span>
            </div>
            {[row.played, row.won, row.drawn, row.lost, row.goals_for, row.goal_difference].map((v, j) => (
              <span key={j} style={{
                fontSize: 12, textAlign: "center",
                color: j === 5 && v > 0 ? t.live : j === 5 && v < 0 ? t.accent : t.text,
              }}>{v}</span>
            ))}
            <span style={{
              fontSize: 13, fontWeight: 700, textAlign: "center",
              color: i < 2 ? t.live : t.text,
            }}>{row.points}</span>
          </div>
        ))}
        <div style={{
          padding: "7px 14px", fontSize: 10.5, color: t.muted,
          display: "flex", gap: 14, borderTop: `1px solid ${t.border}`, background: t.bgSoft,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.live, display: "inline-block" }} />Advances
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: t.gold, display: "inline-block" }} />Potential 3rd
          </span>
        </div>
      </>)}
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════
   3. BRACKET WIDGET
   ════════════════════════════════════════════════════════════════ */

const ROUND_TABS = [
  { id: "r32",   label: "R32" },
  { id: "r16",   label: "R16" },
  { id: "qf",    label: "QF"  },
  { id: "sf",    label: "SF"  },
  { id: "final", label: "Final" },
];

export function BracketWidget({ theme = "light", style }) {
  const t = useTheme(theme);
  const { data, loading, error } = useApiData("/get/games", 60_000);
  const [activeRound, setActiveRound] = useState("r16");

  const allGames = (data?.games || []).map(normaliseGame);
  const roundGames = allGames.filter(g => g.round === activeRound);

  return (
    <Shell t={t} title="Knockout Bracket" subtitle="FIFA World Cup 2026" style={style}>
      <TabBar t={t} tabs={ROUND_TABS} active={activeRound} onSelect={setActiveRound} />
      {loading && <Spinner t={t} />}
      {error   && <Err t={t} msg={error} />}
      {!loading && !error && roundGames.length === 0 && (
        <Empty t={t} msg="Fixtures not yet determined" />
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 10, padding: 12,
      }}>
        {roundGames.map(g => {
          const live = g.status === "live";
          const done = g.status === "finished";
          const homeWins = done && g.home_score > g.away_score;
          const awayWins = done && g.away_score > g.home_score;
          return (
            <div key={g.id} style={{
              border: `1px solid ${live ? t.live : t.border}`,
              borderRadius: 8, overflow: "hidden",
            }}>
              <div style={{
                background: live ? t.live : t.bgSoft, padding: "5px 10px",
                fontSize: 10, fontWeight: 700,
                color: live ? "#fff" : t.muted,
                display: "flex", justifyContent: "space-between",
              }}>
                <span>{g.round?.toUpperCase()}</span>
                <span>{live ? "LIVE" : done ? "FT" : fmtTime(g.kickoff_utc)}</span>
              </div>
              {[
                { team: g.home_team, score: g.home_score, label: g.home_team_label, wins: homeWins },
                { team: g.away_team, score: g.away_score, label: g.away_team_label, wins: awayWins },
              ].map((side, si) => (
                <div key={si} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  borderTop: si ? `1px solid ${t.border}` : "none",
                  background: side.wins ? t.liveSoft : "transparent",
                }}>
                  <Flag team={side.team} size={15} />
                  <span style={{
                    flex: 1, fontSize: 12.5, fontWeight: side.wins ? 700 : 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: side.team === "TBD" ? t.muted : t.text,
                  }}>
                    {side.label || side.team}
                  </span>
                  {side.score != null && (
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      color: side.wins ? t.live : live ? t.accent : t.text,
                    }}>{side.score}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════
   4. HUB WIDGET
   ════════════════════════════════════════════════════════════════ */

export function HubWidget({ theme = "light", style }) {
  const t = useTheme(theme);
  const { data: gamesData, loading, error } = useApiData("/get/games", 30_000);
  const { data: groupsData } = useApiData("/get/groups", 120_000);
  const { data: teamsData }  = useApiData("/get/teams", 0);

  const idToName = {};
  (teamsData?.teams || []).forEach(tm => { idToName[tm.id] = tm.name_en; });
  Object.assign(idToName, { ...TEAM_BY_ID, ...idToName });

  const games    = (gamesData?.games || []).map(normaliseGame);
  const live     = games.filter(g => g.status === "live");
  const finished = games.filter(g => g.status === "finished");
  const now      = new Date().toISOString();
  const next     = games
    .filter(g => g.status === "scheduled" && g.kickoff_utc >= now)
    .sort((a, b) => a.kickoff_utc?.localeCompare(b.kickoff_utc))[0];

  // Group leaders
  const leaders = (groupsData?.groups || []).map(grp => {
    const sorted = [...grp.teams].sort((a,b) => parseInt(b.pts)-parseInt(a.pts)||parseInt(b.gd)-parseInt(a.gd));
    const top = sorted[0];
    return top ? { g: grp.name, team: idToName[top.team_id] || `Team ${top.team_id}`, pts: parseInt(top.pts) } : null;
  }).filter(Boolean);

  return (
    <Shell t={t} title="Tournament Hub" subtitle="FIFA World Cup 2026" style={style}>
      {loading && <Spinner t={t} />}
      {error   && <Err t={t} msg={error} />}
      {!loading && !error && (
        <div>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${t.border}` }}>
            {[
              { label: "Played",    val: finished.length },
              { label: "Remaining", val: Math.max(0, games.length - finished.length) },
              { label: "Live Now",  val: live.length, hi: live.length > 0 },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: "14px 10px", textAlign: "center",
                borderRight: i < 2 ? `1px solid ${t.border}` : "none",
                background: s.hi ? t.liveSoft : "transparent",
              }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.hi ? t.live : t.text }}>{s.val}</div>
                <div style={{ fontSize: 10.5, color: t.muted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Live matches */}
          {live.length > 0 && (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`, background: t.liveSoft }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.live, letterSpacing: ".06em", marginBottom: 8 }}>
                ● LIVE NOW
              </div>
              {live.map((g, i) => (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: i ? 8 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    <Flag team={g.home_team} size={14} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.home_team}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{g.home_score} – {g.away_score}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.away_team}</span>
                    <Flag team={g.away_team} size={14} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Next match */}
          {next && (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: ".06em", marginBottom: 6 }}>NEXT MATCH</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <Flag team={next.home_team} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{next.home_team}</span>
                </div>
                <div style={{
                  padding: "5px 12px", background: t.accent, color: "#fff",
                  borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{fmtDateTime(next.kickoff_utc)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{next.away_team}</span>
                  <Flag team={next.away_team} />
                </div>
              </div>
            </div>
          )}

          {/* Group leaders */}
          {leaders.length > 0 && (
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: ".06em", marginBottom: 8 }}>GROUP LEADERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 6 }}>
                {leaders.map(({ g, team, pts }) => (
                  <div key={g} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 10px",
                    background: t.bgSoft, borderRadius: 7, border: `1px solid ${t.border}`,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: t.accent, width: 12 }}>{g}</span>
                    <Flag team={team} size={13} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {team}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.live, flexShrink: 0 }}>{pts}p</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════
   5. MATCH CENTRE WIDGET
   ════════════════════════════════════════════════════════════════ */

export function MatchCentreWidget({ theme = "light", team, matchId, style }) {
  const t = useTheme(theme);
  const { data, loading, error } = useApiData("/get/games", 20_000);

  const games = (data?.games || []).map(normaliseGame);

  const match = (() => {
    if (!games.length) return null;
    let pool = games;
    if (matchId) return games.find(g => g.id === String(matchId)) || null;
    if (team) {
      const id = TEAM_ID_BY_NAME[team];
      pool = games.filter(g => id
        ? g.home_team_id === id || g.away_team_id === id
        : g.home_team === team || g.away_team === team
      );
    }
    return (
      pool.find(g => g.status === "live") ||
      [...pool].filter(g => g.status === "scheduled")
        .sort((a,b) => a.kickoff_utc?.localeCompare(b.kickoff_utc))[0] ||
      [...pool].filter(g => g.status === "finished").pop() ||
      null
    );
  })();

  const live = match?.status === "live";
  const done = match?.status === "finished";
  const homeWins = done && match.home_score > match.away_score;
  const awayWins = done && match.away_score > match.home_score;
  const highlight = useHighlight(match?.home_team, match?.away_team, done);

  return (
    <Shell t={t} title="Match Centre"
      subtitle={match ? (done ? "Full Time" : live ? "Live" : "Upcoming") : "FIFA World Cup 2026"}
      badge={match?.group_name ? `Group ${match.group_name}` : match?.round?.toUpperCase()}
      style={style}
    >
      {loading && <Spinner t={t} />}
      {error   && <Err t={t} msg={error} />}
      {!loading && !error && !match && <Empty t={t} msg="No match found" />}
      {match && (
        <>
          <div style={{
            padding: "24px 16px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${t.border}`,
            background: live ? t.liveSoft : "transparent",
          }}>
            {/* Home */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}><Flag team={match.home_team} size={36} /></div>
              <div style={{ fontSize: 13.5, fontWeight: homeWins ? 700 : 600, color: homeWins ? t.live : t.text }}>
                {match.home_team}
              </div>
            </div>
            {/* Score */}
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 80 }}>
              {(live || done) ? (
                <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em" }}>
                  <span style={{ color: homeWins ? t.live : t.text }}>{match.home_score}</span>
                  <span style={{ color: t.muted, margin: "0 6px" }}>–</span>
                  <span style={{ color: awayWins ? t.live : t.text }}>{match.away_score}</span>
                </div>
              ) : (
                <div style={{ fontSize: 18, fontWeight: 700, color: t.accent }}>
                  {fmtDateTime(match.kickoff_utc)}
                </div>
              )}
              <div style={{
                marginTop: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                color: live ? t.live : t.muted,
              }}>
                {live ? "LIVE" : done ? "FULL TIME" : match.round?.toUpperCase()}
              </div>
            </div>
            {/* Away */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}><Flag team={match.away_team} size={36} /></div>
              <div style={{ fontSize: 13.5, fontWeight: awayWins ? 700 : 600, color: awayWins ? t.live : t.text }}>
                {match.away_team}
              </div>
            </div>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              ["📅 Kickoff", fmtDateTime(match.kickoff_utc)],
              match.group_name && ["⚽ Group", `Group ${match.group_name}`],
              ["🏆 Round", match.round?.replace(/_/g, " ")?.toUpperCase()],
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ color: t.muted }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          {/* Highlight card — only shows when SerpApi has returned a YouTube link */}
          <HighlightCard t={t} highlight={highlight} />
        </>
      )}
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════
   6. SQUAD WIDGET
   ════════════════════════════════════════════════════════════════ */

export function SquadWidget({ theme = "light", defaultTeam, style }) {
  const t = useTheme(theme);
  const { data, loading } = useApiData("/get/games", 0);
  const [selected, setSelected] = useState(defaultTeam || "United States");

  const allGames = (data?.games || []).map(normaliseGame);
  const teamId = TEAM_ID_BY_NAME[selected];

  const teamGames = allGames
    .filter(g => teamId
      ? g.home_team_id === teamId || g.away_team_id === teamId
      : g.home_team === selected || g.away_team === selected
    )
    .sort((a, b) => a.kickoff_utc?.localeCompare(b.kickoff_utc));

  const groupRivals = (GROUPS[GROUPS_BY_TEAM[selected]] || []).filter(n => n !== selected);

  return (
    <Shell t={t} title="Squad & Fixtures" subtitle="FIFA World Cup 2026" style={style}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border}`, background: t.bgSoft }}>
        <select value={selected} onChange={e => setSelected(e.target.value)} style={{
          width: "100%", padding: "8px 10px", borderRadius: 7, fontSize: 13,
          border: `1px solid ${t.border}`, background: t.bg, color: t.text,
        }}>
          {Object.entries(GROUPS).map(([g, teams]) => (
            <optgroup key={g} label={`Group ${g}`}>
              {teams.map(name => (
                <option key={name} value={name}>{FLAGS[name] || "⚽"} {name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div style={{
        padding: "14px 16px", borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", gap: 14, background: t.accentSoft,
      }}>
        <div style={{ fontSize: 44 }}><Flag team={selected} size={44} /></div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{selected}</div>
          {GROUPS_BY_TEAM[selected] && (
            <div style={{
              display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 700,
              background: t.accent, color: "#fff", padding: "2px 9px", borderRadius: 4,
            }}>Group {GROUPS_BY_TEAM[selected]}</div>
          )}
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 10, color: t.muted, fontWeight: 600, marginBottom: 4 }}>Group rivals</div>
          <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
            {groupRivals.map(r => (
              <span key={r} title={r} style={{ cursor: "pointer", fontSize: 18 }}
                onClick={() => setSelected(r)}>
                <Flag team={r} size={18} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 0" }}>
        <div style={{
          padding: "4px 16px 8px", fontSize: 10, fontWeight: 700,
          color: t.muted, letterSpacing: ".06em",
        }}>MATCHES</div>
        {loading && <Spinner t={t} />}
        {teamGames.map((g, i) => {
          const isHome  = g.home_team_id === teamId || g.home_team === selected;
          const myScore = isHome ? g.home_score : g.away_score;
          const opScore = isHome ? g.away_score : g.home_score;
          const opp     = isHome ? g.away_team : g.home_team;
          const live    = g.status === "live";
          const done    = g.status === "finished";
          const result  = done
            ? myScore > opScore ? "W" : myScore < opScore ? "L" : "D"
            : null;
          return (
            <div key={g.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 16px",
              borderTop: i ? `1px solid ${t.border}` : "none",
              background: live ? t.liveSoft : "transparent",
            }}>
              <div style={{ fontSize: 11, color: live ? t.live : t.muted, width: 40, fontWeight: live ? 700 : 400 }}>
                {live ? "LIVE" : done ? "FT" : fmtTime(g.kickoff_utc)}
              </div>
              <span style={{ fontSize: 11, color: t.muted, width: 14 }}>{isHome ? "H" : "A"}</span>
              <Flag team={opp} size={14} />
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {opp}
              </span>
              {(live || done) && (
                <span style={{ fontSize: 13, fontWeight: 700 }}>{myScore ?? 0} – {opScore ?? 0}</span>
              )}
              {result && (
                <span style={{
                  width: 22, height: 22, borderRadius: 4, fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: result === "W" ? t.live : result === "L" ? t.accent : t.border,
                  color: result === "D" ? t.text : "#fff",
                }}>{result}</span>
              )}
            </div>
          );
        })}
        {!loading && teamGames.length === 0 && <Empty t={t} msg="No fixtures found" />}
      </div>
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════
   7. TOPSCORERS WIDGET  (team goals from standings)
   ════════════════════════════════════════════════════════════════ */

export function TopscorersWidget({ theme = "light", style }) {
  const t = useTheme(theme);
  const { data: groupsData, loading, error } = useApiData("/get/groups", 120_000);
  const { data: teamsData } = useApiData("/get/teams", 0);

  const idToName = {};
  (teamsData?.teams || []).forEach(tm => { idToName[tm.id] = tm.name_en; });
  Object.assign(idToName, { ...TEAM_BY_ID, ...idToName });

  const rows = [];
  (groupsData?.groups || []).forEach(grp => {
    grp.teams.forEach(row => {
      const gf = parseInt(row.gf);
      if (gf > 0) rows.push({
        team: idToName[row.team_id] || `Team ${row.team_id}`,
        group: grp.name,
        gf, ga: parseInt(row.ga), gd: parseInt(row.gd),
      });
    });
  });
  rows.sort((a, b) => b.gf - a.gf || a.ga - b.ga);

  return (
    <Shell t={t} title="Top Scoring Teams" subtitle="FIFA World Cup 2026 · Group Stage" style={style}>
      {loading && <Spinner t={t} />}
      {error   && <Err t={t} msg={error} />}
      {!loading && !error && rows.length === 0 && (
        <Empty t={t} msg="No goals recorded yet" />
      )}
      {rows.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "32px 1fr 40px 40px 40px",
          padding: "6px 14px", gap: 2,
          fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: ".06em",
          background: t.bgSoft, borderBottom: `1px solid ${t.border}`,
        }}>
          {["#", "Team", "GF", "GA", "GD"].map((h, i) => (
            <span key={h} style={{ textAlign: i === 1 ? "left" : "center" }}>{h}</span>
          ))}
        </div>
      )}
      {rows.slice(0, 16).map((row, i) => (
        <div key={row.team} style={{
          display: "grid", gridTemplateColumns: "32px 1fr 40px 40px 40px",
          alignItems: "center", gap: 2, padding: "10px 14px",
          borderTop: i ? `1px solid ${t.border}` : "none",
          background: i < 3 ? t.accentSoft : "transparent",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? t.accent : t.muted, textAlign: "center" }}>
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
            <Flag team={row.team} size={15} />
            <span style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.team}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: t.accent,
              background: t.accentSoft, padding: "1px 5px", borderRadius: 3, flexShrink: 0,
            }}>G{row.group}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: t.live }}>{row.gf}</span>
          <span style={{ fontSize: 12, textAlign: "center", color: t.muted }}>{row.ga}</span>
          <span style={{
            fontSize: 12, fontWeight: 600, textAlign: "center",
            color: row.gd > 0 ? t.live : row.gd < 0 ? t.accent : t.muted,
          }}>
            {row.gd > 0 ? `+${row.gd}` : row.gd}
          </span>
        </div>
      ))}
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════
   8. TOURNAMENT LIVESCORE WIDGET
   ════════════════════════════════════════════════════════════════ */

export function TournamentLivescoreWidget({ theme = "light", style }) {
  const t = useTheme(theme);
  const { data, loading, error, refetch } = useApiData("/get/games", 30_000);
  const [showAll, setShowAll] = useState(false);

  const games = (data?.games || []).map(normaliseGame)
    .sort((a, b) => a.kickoff_utc?.localeCompare(b.kickoff_utc));

  const today = todayKey();

  // Group by date
  const byDate = {};
  games.forEach(g => {
    const dk = dateKey(g.kickoff_utc);
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk].push(g);
  });

  const allDates = Object.keys(byDate).sort();
  const now = new Date();
  const visible = showAll ? allDates : allDates.filter(d => {
    const diff = (new Date(d + "T12:00:00") - now) / 86_400_000;
    return diff > -4 && diff < 8;
  });

  return (
    <Shell t={t} title="Tournament Livescore" subtitle="All 104 FIFA World Cup 2026 Matches" style={style}>
      {loading && <Spinner t={t} />}
      {error   && <Err t={t} msg={error} />}
      {!loading && !error && (
        <div>
          {visible.map(dk => (
            <div key={dk}>
              <div style={{
                padding: "7px 16px", fontSize: 11, fontWeight: 700, letterSpacing: ".05em",
                color: dk === today ? t.accent : t.muted,
                background: t.bgSoft, borderTop: `1px solid ${t.border}`,
              }}>
                {fmtDateHeader(byDate[dk][0]?.kickoff_utc)}
              </div>
              {byDate[dk].map((g, i) => (
                <MatchRow key={g.id} g={g} t={t} i={i} showGroup />
              ))}
            </div>
          ))}
          <div style={{
            padding: "9px 16px", borderTop: `1px solid ${t.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <button onClick={() => setShowAll(s => !s)} style={{
              fontSize: 12, color: t.muted, background: "none", border: "none",
              cursor: "pointer", textDecoration: "underline", padding: 0,
            }}>
              {showAll ? "Fewer dates" : "Show all dates"}
            </button>
            <button onClick={refetch} style={{
              fontSize: 12, color: t.accent, background: "none", border: "none",
              cursor: "pointer", fontWeight: 600, padding: 0,
            }}>↻ Refresh</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════════
   DEFAULT EXPORT — full showcase
   ════════════════════════════════════════════════════════════════ */

export default function WorldCupWidgetShowcase({ theme = "light" }) {
  const t = useTheme(theme);
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: t.bg, color: t.text }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 20, padding: 20,
      }}>
        <HubWidget theme={theme} />
        <LivescoreWidget theme={theme} />
        <StandingsWidget theme={theme} />
        <BracketWidget theme={theme} />
        <MatchCentreWidget theme={theme} team="United States" />
        <SquadWidget theme={theme} defaultTeam="United States" />
        <TopscorersWidget theme={theme} />
        <TournamentLivescoreWidget theme={theme} />
      </div>
    </div>
  );
}
