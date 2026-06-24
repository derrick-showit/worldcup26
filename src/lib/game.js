// Game logic ported faithfully from the source index.html <script>.
// Identity-bound functions take the Privy identity id (e.g. "privy:abc123") as a param.

import { J, storage } from './storage.js';

/* ===== CONFIG / ROSTER ===== */
export const ADMIN_PASSCODE = 'dewdOpepen082';
export const TICKER_ITEMS = ['YOUR BRAND HERE', 'THIS TICKER Ξ0.69 PER WEEK', '4,416 ACTIVE PLAYERS', 'VOTE · PREDICT · EARN · COMPETE', 'OPEPENWC26/SPONSOR'];
export const COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d35400', '#7f8c8d', '#e84393'];
export const SHARE_URL = 'https://opepenworldcup.xyz';
export const ROSTER_COUNT = 40;
export function rosterImg(id) { return `/assets/teams/OpepenWC-Teams-${id}.webp`; }
export const TEAM_NAMES = {
  1: 'The Crimson Set', 2: 'Cobalt City', 3: 'The Checkers', 4: 'Halftone United',
  5: 'The Negatives', 6: 'Pigment FC', 7: 'The Editions', 8: 'Monotype Rovers',
  9: 'The Glyphs', 10: 'Consensus FC', 11: 'The Vermillions', 12: 'Grid City',
  13: 'The Plates', 14: 'Inkwell United', 15: 'The Mints', 16: 'Bitmap Athletic',
  17: 'The Frames', 18: 'Vector Wanderers', 19: 'The Renders', 20: 'Pixel Albion',
  21: 'The Burnt', 22: 'Provenance FC', 23: 'The Squares', 24: 'Cyan Rovers',
  25: 'The Optimists', 26: 'Reveal United', 27: 'The Pales', 28: 'Gradient City',
  29: 'The Opted-In', 30: 'Stencil FC', 31: 'The Saturated', 32: 'Aperture United',
  33: 'The Tessellates', 34: 'Marble Rovers', 35: 'The Embers', 36: 'Contrast City',
  37: 'The Primaries', 38: 'Woodcut United', 39: 'The Latent', 40: 'Set Forty FC',
};
export function teamName(id) { return TEAM_NAMES[id] || ('Opepen #' + id); }
/* numeric id as a small secondary label, e.g. "The Embers · #35" */
export function teamSub(id) { return TEAM_NAMES[id] ? ('#' + id) : ''; }
export function groupLetter(id) { return 'ABCDEFGHIJ'[Math.floor((id - 1) / 4)]; }
export function championOdds(id) { return +(1 + id / 2.2).toFixed(1); }

/* First kickoff anchor.
   DEMO: ~5 hours ago, so the first matches are already live/finished and you can see them now.
   For a real event, use a future date instead, e.g.:
   export const START_BASE=(()=>{const d=new Date();d.setDate(d.getDate()+7);d.setHours(12,0,0,0);return d.getTime();})(); */
/* ── 90-second matches: 10s kickoff countdown + 45s + 30s halftime + 45s = 130s window.
   Matches run BACK-TO-BACK, so the whole 39-match tournament is one ~85-minute event. ── */
export const KICKOFF_S = 10, HALF_S = 45, HT_S = 30;
export const MATCH_MS = (KICKOFF_S + HALF_S + HT_S + HALF_S) * 1000; // 130s
/* Hold on the WINNER screen for 60s after full time before the next kickoff. */
export const GAP_MS = 60000;
/* DEMO: start ~11 min ago so the first few matches are finished and one is live now.
   For a real event, anchor to a future time instead, e.g.:
   export const START_BASE=(()=>{const d=new Date();d.setHours(d.getHours()+1,0,0,0);return d.getTime();})(); */
export const START_BASE = Date.now() - (5 * 130 + 25) * 1000;
export const ROUNDS = [
  { key: 'r1', name: 'Qualifiers', adv: '40 → 20', matches: 20 },
  { key: 'r2', name: 'Knockouts', adv: '20 → 10', matches: 10 },
  { key: 'r3', name: 'Round of 10', adv: '10 → 5', matches: 5 },
  { key: 'r4', name: 'Play-In', adv: '5 → 4', matches: 1 },
  { key: 'r5', name: 'Semi-Finals', adv: '4 → 2', matches: 2 },
  { key: 'r6', name: 'Final', adv: '2 → 1', matches: 1 },
];

/* Build the fixture list, every match back-to-back (kickoff = START_BASE + n*MATCH_MS). */
export const SCHEDULE = (() => {
  const out = []; let n = 0;
  ROUNDS.forEach((R) => {
    for (let i = 0; i < R.matches; i++) {
      out.push({ id: R.key + '-' + i, rk: R.key, rn: R.name, adv: R.adv, i, kickoff: START_BASE + n * (MATCH_MS + GAP_MS) });
      n++;
    }
  });
  return out;
})();
export function fxById(id) { return SCHEDULE.find((f) => f.id === id); }
export function fxMatchId(f) { return 'm:' + f.id; }

/* Seeds: qualifiers pair 1v40,2v39,...  Later rounds resolve from prior winners. */
export function fxTeams(f) {
  if (f.rk === 'r1') return { a: f.i + 1, b: 40 - f.i };
  if (f.rk === 'r2') { return { a: winnerOf('r1-' + (f.i * 2)), b: winnerOf('r1-' + (f.i * 2 + 1)) }; }
  if (f.rk === 'r3') { return { a: winnerOf('r2-' + (f.i * 2)), b: winnerOf('r2-' + (f.i * 2 + 1)) }; }
  if (f.rk === 'r4') { return { a: winnerOf('r3-3'), b: winnerOf('r3-4') }; } // play-in: two lowest survivors
  if (f.rk === 'r5') { return f.i === 0 ? { a: winnerOf('r3-0'), b: winnerOf('r4-0') } : { a: winnerOf('r3-1'), b: winnerOf('r3-2') }; }
  if (f.rk === 'r6') { return { a: winnerOf('r5-0'), b: winnerOf('r5-1') }; }
  return { a: null, b: null };
}
export function status(f) { const n = Date.now(); if (n < f.kickoff) return 'up'; if (n >= f.kickoff + MATCH_MS) return 'ft'; return 'live'; }
/* Seconds-based match clock: KO countdown → 1st half → halftime → 2nd half → FT.
   Returns { phase:'up'|'KO'|'1H'|'HT'|'2H'|'ft', remain (sec left in phase), half, txt }.
   Voting is allowed only when phase is '1H' or '2H'. */
export function matchClock(f) {
  const e = (Date.now() - f.kickoff) / 1000; // seconds since window start
  const total = KICKOFF_S + HALF_S + HT_S + HALF_S; // 130
  if (e < 0) return { phase: 'up', remain: 0, up: 0, txt: '—' };
  if (e >= total) return { phase: 'ft', remain: 0, up: 90, txt: 'FT' };
  if (e < KICKOFF_S) return { phase: 'KO', remain: Math.ceil(KICKOFF_S - e), up: 0, txt: 'Kickoff ' + Math.ceil(KICKOFF_S - e) + 's' };
  const t = e - KICKOFF_S; // 0..120 across play + halftime
  // 1st half: count UP 0..45 (seconds elapsed in the half)
  if (t < HALF_S) { const up = Math.min(HALF_S, Math.floor(t)); return { phase: '1H', half: 1, remain: Math.ceil(HALF_S - t), up, txt: up + 's' }; }
  // halftime: stays a COUNTDOWN
  if (t < HALF_S + HT_S) return { phase: 'HT', remain: Math.ceil(HALF_S + HT_S - t), up: HALF_S, txt: 'HT ' + Math.ceil(HALF_S + HT_S - t) + 's' };
  // 2nd half: count UP 45..90
  const up = Math.min(2 * HALF_S, HALF_S + Math.floor(t - HALF_S - HT_S));
  return { phase: '2H', half: 2, remain: Math.ceil(2 * HALF_S + HT_S - t), up, txt: up + 's' };
}
export function canVote(f) { const p = matchClock(f).phase; return p === '1H' || p === '2H'; }
export function winnerOf(fid) { const f = fxById(fid); if (!f) return null; if (status(f) !== 'ft') return null; const t = fxTeams(f); if (!t.a || !t.b) return null; const tl = tallyMatch(fxMatchId(f)); if (tl.total === 0) return t.a; return tl.L >= tl.R ? t.a : t.b; }
export const champion = () => winnerOf('r6-0');
export function nextFixture() { const n = Date.now(); return SCHEDULE.find((f) => n < f.kickoff + MATCH_MS); } // first not-yet-finished
export function liveFixture() { return SCHEDULE.find((f) => status(f) === 'live') || null; }
/* The fixture to DISPLAY in the Play view, honoring the 60s post-FT hold:
   1) the live match, if any; else
   2) the most-recently-finished match while still inside its 60s WINNER hold
      (now < kickoff + MATCH_MS + GAP_MS) — shown as the celebration; else
   3) the next upcoming match (its KICKOFF IN nS countdown). */
export function currentFixture() {
  const n = Date.now();
  const live = liveFixture();
  if (live) return live;
  // most-recently-finished still inside the post-FT hold window
  let held = null;
  for (const f of SCHEDULE) {
    if (n >= f.kickoff + MATCH_MS && n < f.kickoff + MATCH_MS + GAP_MS) held = f; // last match
  }
  if (held) return held;
  return nextFixture();
}

/* ===== profile (keyed by Privy identity id) ===== */
export function getProfile(id) { if (!id) return null; return J.get('player:' + id, null); }
export function setProfile(id, p) { if (!id) return; J.set('player:' + id, { ...p, id, ts: Date.now() }); }
export function allPlayers() { return storage.list('player:').keys.map((k) => J.get(k, null)).filter(Boolean); }
export function myName(id, fallbackShort) { const p = getProfile(id); if (p && p.name) return p.name; return fallbackShort || 'player'; }
export function myColor(id) {
  const p = getProfile(id); if (p && p.color) return p.color;
  let h = 0; const s = id || ''; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % COLORS.length; return COLORS[h];
}

/* ===== predictions (local) ===== */
export function getPicks() { return J.get('picks', {}); }
export function setPick(fid, team) { const p = getPicks(); p[fid] = team; J.set('picks', p); }
export function predictionCount() { return Object.keys(getPicks()).length; }
export function predictedChampion() { return getPicks()['r6-0'] || null; }

/* ===== votes / shots (shared) ===== */
export function voteKey(mId, idId) { return 'vote:' + mId + ':' + idId; }
export function getVotes(mId) { const pre = 'vote:' + mId + ':'; const out = {}; storage.list(pre).keys.forEach((k) => { const r = J.get(k, null); if (r) out[k.slice(pre.length)] = r; }); return out; }
export function tallyMatch(mId) { const v = getVotes(mId); let L = 0, R = 0; Object.values(v).forEach((x) => { if (x.side === 'LFT') L++; else if (x.side === 'RGT') R++; }); return { L, R, total: L + R }; }
export function myVoteFor(mId, id) { if (!id) return null; return J.get(voteKey(mId, id), null); }
export function castShot(mId, id, side, decisionMs) {
  if (!id) return; const key = voteKey(mId, id); const cur = J.get(key, null); const now = Date.now();
  let rec;
  if (cur) { rec = { ...cur, side, voteTs: now, changes: (cur.changes || 0) + (cur.side !== side ? 1 : 0) }; }
  else rec = { side, firstSide: side, firstTs: now, voteTs: now, decisionMs: decisionMs || 0, changes: 0 };
  J.set(key, rec);
}
export function resetAllVotes() { storage.list('vote:').keys.forEach((k) => storage.delete(k)); }

/* shot quality by decision time (seconds): 0-3s goal · 4-15s on target · 16-45s wide · 45s+ desperate */
export function shotWeight(ms) { const s = ms / 1000; if (s < 3) return 1; if (s < 15) return 0.8; if (s < 45) return 0.5; return 0.3; }
export function shotKind(ms) { const s = ms / 1000; if (s < 3) return 'goal'; if (s < 15) return 'on target'; if (s < 45) return 'wide'; return 'desperate'; }

/* ===== randomized shot-reaction phrase pool (varies repeated clicks) =====
   Buckets mirror shotKind(): goal / on target / wide / desperate.
   "switched" => the voter changed their mind (scuffed it). {team} = nickname. */
const SHOT_PHRASES = {
  goal: [
    '⚽ {team} — rifled into the top corner!',
    '⚽ {team} bury it — unstoppable from there!',
    '⚽ Clinical from {team} — back of the net!',
    '⚽ {team} score a screamer!',
  ],
  'on target': [
    '🎯 {team} force a save',
    '🎯 {team} sting the keeper\'s palms',
    '🎯 On target — {team} go close',
    '🎯 {team} draw a fingertip stop',
  ],
  wide: [
    '↗ {team} — dragged wide',
    '↗ {team} pull it past the post',
    '↗ Just wide for {team}',
    '↗ {team} scuff it off target',
  ],
  desperate: [
    'Hopeful effort, {team}',
    'Wild swing from {team} — miles over',
    'Desperate hack from {team}',
    '{team} launch one into the stands',
  ],
  switched: [
    '😬 Scuffed it, {team} — changed your mind',
    '😬 {team} mishit it after second thoughts',
    '😬 {team} — a scuffed change of heart',
    '😬 {team} fluff it, mind already wandering',
  ],
};
export function shotReaction(decisionMs, teamNm, switched) {
  const bucket = switched ? 'switched' : shotKind(decisionMs);
  const pool = SHOT_PHRASES[bucket] || SHOT_PHRASES.wide;
  const phrase = pool[Math.floor(Math.random() * pool.length)];
  return phrase.replace('{team}', teamNm);
}
export function matchStats(mId) {
  const v = Object.values(getVotes(mId)); const s = { L: { shots: 0, ot: 0, og: 0, goals: 0, dt: [] }, R: { shots: 0, ot: 0, og: 0, goals: 0, dt: [] } };
  // NOTE: index buckets by L/R, NOT 'LFT'/'RGT' — keep this fix.
  const k = (side) => (side === 'LFT' ? 'L' : 'R');
  v.forEach((x) => {
    const cur = k(x.side), w = shotWeight(x.decisionMs || 10000);
    s[cur].shots++; if ((x.decisionMs || 99999) < 15000) s[cur].ot++; s[cur].dt.push(x.decisionMs || 0);
    // own goal: started one side, switched away with changes
    if (x.firstSide && x.firstSide !== x.side && (x.changes || 0) > 0) { s[k(x.firstSide)].og++; s[cur].goals += (x.changes >= 2 ? 0.5 : 0.8) * w; }
    else s[cur].goals += w;
  });
  const tot = s.L.shots + s.R.shots;
  const poss = tot ? Math.round(s.L.shots / tot * 100) : 50;
  const avg = (a) => (a.length ? Math.round(a.reduce((p, c) => p + c, 0) / a.length / 1000 * 10) / 10 : 0);
  return { L: s.L, R: s.R, possL: poss, possR: 100 - poss, goalsL: Math.round(s.L.goals), goalsR: Math.round(s.R.goals), dtL: avg(s.L.dt), dtR: avg(s.R.dt), total: tot };
}

/* ===== Taste Points + wagers (local) ===== */
export function tp() { return J.get('tp', { bal: 1000, log: [], flags: {}, shares: [], wagers: [] }); }
function tpSave(o) { J.set('tp', o); }
export function award(amount, reason) { const t = tp(); t.bal += amount; t.log.unshift({ a: amount, r: reason, ts: Date.now() }); t.log = t.log.slice(0, 40); tpSave(t); }
function todayStr() { return new Date().toDateString(); }
export function earnShare() { const t = tp(); const today = todayStr(); t.shares = (t.shares || []).filter((d) => d === today); if (t.shares.length >= 5) return false; t.shares.push(today); t.flags.sharedOnce = true; tpSave(t); award(100, 'Shared on X'); return true; }
export function earnOnce(flag, amount, reason) { const t = tp(); if (t.flags[flag]) return false; t.flags[flag] = true; tpSave(t); award(amount, reason); return true; }
export function dailyCheckIn() { const t = tp(); if (t.flags.lastCheckIn === todayStr()) return false; t.flags.lastCheckIn = todayStr(); tpSave(t); award(50, 'Daily check-in'); return true; }
export function placeWager(fid, team, stake, odds) { const t = tp(); if (stake > t.bal || stake <= 0) return false; t.bal -= stake; t.wagers.unshift({ id: Date.now(), fid, team, stake, odds, status: 'open', ts: Date.now() }); tpSave(t); return true; }
export function resolveWagers() { const t = tp(); let changed = false; t.wagers.forEach((w) => { if (w.status !== 'open') return; const f = fxById(w.fid); if (!f || status(f) !== 'ft') return; const win = winnerOf(w.fid); if (win == null) return; w.status = win === w.team ? 'won' : 'lost'; if (w.status === 'won') { const payout = Math.round(w.stake * w.odds); t.bal += payout; w.payout = payout; t.log.unshift({ a: payout, r: 'Won wager ' + teamName(w.team), ts: Date.now() }); } changed = true; }); if (changed) { t.log = t.log.slice(0, 40); tpSave(t); } }
export function matchOdds(f) { const t = fxTeams(f); if (!t.a || !t.b) return { a: 2, b: 2 }; const tl = tallyMatch(fxMatchId(f)); if (tl.total < 3) { const oa = Math.max(1.2, 1 + t.a / 40), ob = Math.max(1.2, 1 + t.b / 40); return { a: +oa.toFixed(2), b: +ob.toFixed(2) }; } const pa = tl.L / tl.total || 0.5; return { a: +Math.max(1.15, 1 / Math.max(0.12, pa)).toFixed(2), b: +Math.max(1.15, 1 / Math.max(0.12, 1 - pa)).toFixed(2) }; }

/* ===== chat + comments (shared rows) ===== */
function rid() { return Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
export function postChat(id, name, color, text) { if (!id) return; J.set('chat:' + rid(), { idId: id, name, color, text: text.slice(0, 300), ts: Date.now() }); }
export function getChat() { return storage.list('chat:').keys.map((k) => J.get(k, null)).filter(Boolean).sort((a, b) => a.ts - b.ts); }
export function postComment(mId, id, name, color, text) { J.set('cmt:' + mId + ':' + rid(), { idId: id, name, color, text: text.slice(0, 200), ts: Date.now() }); }
export function getComments(mId) { return storage.list('cmt:' + mId + ':').keys.map((k) => J.get(k, null)).filter(Boolean).sort((a, b) => a.ts - b.ts); }

/* ===== util ===== */
export function nFmt(n) { return Number(n).toLocaleString('en-US'); }
export function ago(ts) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; }
export function fmtDay(ts) { return new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); }
export function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
export function shareOnX(text, onShared) { const u = `https://x.com/intent/tweet?${new URLSearchParams({ text, url: SHARE_URL })}`; window.open(u, '_blank', 'noopener,noreferrer,width=600,height=460'); if (onShared) onShared(); }
