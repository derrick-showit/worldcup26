import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XLogo, FieldSvg, LogoSvg } from './components/svg.jsx';
import AnimatedNumber from './components/AnimatedNumber.jsx';
import {
  ROSTER_COUNT, ROUNDS, SCHEDULE, START_BASE, ADMIN_PASSCODE, COLORS, KICKOFF_S,
  rosterImg, teamName, groupLetter, championOdds,
  fxTeams, fxMatchId, status, matchClock, canVote, winnerOf, champion, nextFixture, liveFixture, currentFixture,
  tallyMatch, myVoteFor, castShot, resetAllVotes, matchStats, shotReaction, shotKind, teamSub,
  tp, earnShare, earnOnce, dailyCheckIn, placeWager, resolveWagers, matchOdds,
  getPicks, setPick, predictionCount, predictedChampion,
  getProfile, setProfile, allPlayers, myName, myColor,
  postChat, getChat, postComment, getComments,
  nFmt, ago, fmtDay, fmtTime, shareOnX, getVotes as getVotesFor,
} from './lib/game.js';

const DAY = 86400000;
import { SHARED } from './lib/storage.js';

/* ===== tiny pub/sub for toast + flash + modal (mirrors source globals) ===== */
function makeBus() {
  let listeners = [];
  return {
    sub(fn) { listeners.push(fn); return () => { listeners = listeners.filter((l) => l !== fn); }; },
    emit(v) { listeners.forEach((l) => l(v)); },
  };
}
export const toastBus = makeBus();
export const flashBus = makeBus();
export const modalBus = makeBus();
export function toast(m) { toastBus.emit(m); }
export function flash(m) { flashBus.emit(m); }
export function openModal(node) { modalBus.emit(node); }
export function closeModal() { modalBus.emit(null); }

export function Toast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const t = useRef();
  useEffect(() => toastBus.sub((m) => { setMsg(m); setShow(true); clearTimeout(t.current); t.current = setTimeout(() => setShow(false), 2200); }), []);
  return <div className={'toast' + (show ? ' show' : '')}>{msg}</div>;
}
export function Flash() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const t = useRef();
  useEffect(() => flashBus.sub((m) => { setMsg(m); setShow(true); clearTimeout(t.current); t.current = setTimeout(() => setShow(false), 2600); }), []);
  return <div className={'flash' + (show ? ' show' : '')}>{msg}</div>;
}
export function ModalRoot() {
  const [node, setNode] = useState(null);
  useEffect(() => modalBus.sub(setNode), []);
  if (!node) return null;
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      {node}
    </div>
  );
}

/* require check-in: with Privy, just call login() */
function requireCheckIn(ctx, after) {
  if (ctx.id) { after && after(); return true; }
  ctx.login();
  return false;
}

/* ===== PLAY — single centered column (match-wrap) ===== */
function fxIndex(f) { for (let i = 0; i < SCHEDULE.length; i++) { if (SCHEDULE[i].id === f.id) return i; } return 0; }
const ROUND_DISP = { 'Qualifiers': 'Qualifying Round', 'Knockouts': 'Knockout Round', 'Round of 10': 'Round of 10', 'Play-In': 'Play-In', 'Semi-Finals': 'Semi-Finals', 'Final': 'Final' };
function roundDisp(f) { return ROUND_DISP[f.rn] || f.rn; }
function fmtLongDate(ts) { return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }

/* ===== HOME / LANDING (root route #/) =====
   Marketing landing on the black/gold/Geist theme. CTAs start the game via
   ctx.login(). The live match lives at #/play. */
/* Fade-in-on-scroll: adds .is-in once the element enters the viewport.
   IntersectionObserver only (no deps); respects reduced-motion via CSS. */
function useFadeIn() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-in'); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
function FadeSection({ className, children }) {
  const ref = useFadeIn();
  return <section ref={ref} className={'fade-up ' + (className || '')}>{children}</section>;
}

/* Mini live-board mockup for the How-It-Works sticky media (visual only). */
function MiniBoard({ aId, bId, variant }) {
  return (
    <div className={'hiw-board' + (variant ? ' ' + variant : '')}>
      <div className="hiw-halves">
        <div className="hiw-half" style={{ backgroundImage: `url('${rosterImg(aId)}')` }} />
        <div className="hiw-half" style={{ backgroundImage: `url('${rosterImg(bId)}')` }} />
      </div>
      <FieldSvg />
      <div className="hiw-goal l" /><div className="hiw-goal r" />
    </div>
  );
}

/* Sticky split-screen How-It-Works (superhi-style): the LEFT column is sticky
   and swaps its visual as each step scrolls past on the RIGHT, via an
   IntersectionObserver tracking which step is centered. */
function HowItWorks({ steps }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);
  useEffect(() => {
    const els = stepRefs.current.filter(Boolean);
    if (!els.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { const i = Number(e.target.dataset.idx); setActive(i); } });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [steps]);

  const visuals = [
    // 1) two artworks appear / live board
    <MiniBoard key="v0" aId={5} bId={36} variant="ko" />,
    // 2) speed shapes the shot — 8x8 grid with a centered "goal" cell highlighted
    (
      <div key="v1" className="hiw-board">
        <MiniBoard aId={11} bId={30} />
        <div className="hiw-grid">
          {Array.from({ length: 64 }, (_, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            const goal = (r === 3 || r === 4) && (c === 0 || c === 7);
            return <span key={i} className={'hiw-cell' + (goal ? ' goal' : '')} />;
          })}
        </div>
      </div>
    ),
    // 3) the winner — centered artwork on a green field
    (
      <div key="v2" className="hiw-board hiw-winner">
        <div className="hiw-winart" style={{ backgroundImage: `url('${rosterImg(11)}')` }} />
        <div className="hiw-winlbl">WINNER!</div>
      </div>
    ),
  ];

  return (
    <div className="hiw-split">
      <div className="hiw-sticky">
        <div className="hiw-stage">
          {visuals.map((v, i) => (
            <div key={i} className={'hiw-vis' + (active === i ? ' on' : '')}>{v}</div>
          ))}
        </div>
      </div>
      <ol className="hiw-steps">
        {steps.map(([h, b], i) => (
          <li className={'hiw-step' + (active === i ? ' on' : '')} key={i} data-idx={i} ref={(el) => { stepRefs.current[i] = el; }}>
            <span className="hl-step-n">{i + 1}</span>
            <div><div className="hl-step-h">{h}</div><div className="hl-step-b">{b}</div></div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ITEM 8: Home current/next match section — compact cards for the live/most-recent
   match (currentFixture/liveFixture) and the next upcoming match (nextFixture).
   Shows team artworks + nicknames, LIVE/kickoff status, and the live score
   (AnimatedNumber). Each card links to #/play (renders currentFixture). */
function HomeMatchCard({ f, kind }) {
  if (!f) return null;
  const t = fxTeams(f);
  const st = status(f);
  const mc = matchClock(f);
  const tl = tallyMatch(fxMatchId(f));
  const live = st === 'live';
  const ft = st === 'ft';
  const labelKind = kind === 'next' ? 'Next match' : live ? 'Live now' : ft ? 'Latest result' : 'Up next';
  let statusNode;
  if (live) statusNode = <span className="hm-live"><span className="live-dot" /> LIVE · {mc.txt}</span>;
  else if (ft) statusNode = <span className="hm-st-ft">FT</span>;
  else statusNode = <span className="hm-st-up">{fmtDay(f.kickoff)} · {fmtTime(f.kickoff)}</span>;
  return (
    <a className="hm-card" href="#/play">
      <div className="hm-kind">{labelKind} · {roundDisp(f)}</div>
      <div className="hm-teams">
        <div className="hm-team">
          <img src={t.a ? rosterImg(t.a) : '/assets/teams/OpepenWC-Teams-1.webp'} alt="" style={{ opacity: t.a ? 1 : 0.2 }} />
          <span className="hm-nm">{t.a ? teamName(t.a) : 'TBD'}</span>
        </div>
        <div className="hm-mid">
          {(live || ft)
            ? <span className="hm-score"><AnimatedNumber value={tl.L} /><span className="hm-dash">–</span><AnimatedNumber value={tl.R} /></span>
            : <span className="hm-vs">v</span>}
        </div>
        <div className="hm-team r">
          <img src={t.b ? rosterImg(t.b) : '/assets/teams/OpepenWC-Teams-1.webp'} alt="" style={{ opacity: t.b ? 1 : 0.2 }} />
          <span className="hm-nm">{t.b ? teamName(t.b) : 'TBD'}</span>
        </div>
      </div>
      <div className="hm-foot">{statusNode}<span className="hm-go">Watch →</span></div>
    </a>
  );
}
function HomeMatches() {
  const [, force] = useState(0);
  useEffect(() => { const iv = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(iv); }, []);
  const cur = currentFixture();
  const nxt = nextFixture();
  const showNext = nxt && (!cur || nxt.id !== cur.id);
  if (!cur && !showNext) return null;
  return (
    <div className="hm-wrap">
      <HomeMatchCard f={cur} kind="current" />
      {showNext && <HomeMatchCard f={nxt} kind="next" />}
    </div>
  );
}

export function ViewHome({ ctx }) {
  // Every CTA routes to the live/latest match (#/play renders currentFixture).
  // Fire lazy login too, but always end up on the current match.
  const go = () => { ctx.login(); location.hash = '#/play'; };
  const steps = [
    ['Two artworks appear', 'Each match runs 90 seconds. Two 45-second halves with a 30 second halftime. You vote for the one you prefer.'],
    ['Speed shapes the shot', 'An instant choice lands center goal; a slow choice drifts wide, or misses completely. Changing your mind could cause an own goal.'],
    ['The strongest instinct wins', 'The artwork that earns the fastest, most confident votes accumulates the most goals and advances. Only one will become a 1/1.'],
  ];
  return (
    <div className="home-landing">
      {/* HERO */}
      <FadeSection className="hl-hero">
        <h1 className="hl-h1">Your Gut Vote Counts More Than Your Considered One</h1>
        <p className="hl-sub">40 artworks enter. One lifts the Cup. How fast you decide shapes how much your vote counts.</p>
      </FadeSection>

      {/* CURRENT + NEXT MATCH (item 8) */}
      <FadeSection className="hl-block hl-matches">
        <h2 className="hl-h2">The match is live</h2>
        <HomeMatches />
      </FadeSection>

      {/* FIELD GRAPHIC + KICKOFF */}
      <FadeSection className="hl-field-sec">
        <div className="hl-field"><FieldSvg /></div>
        <div className="hl-kickoff">The Art World Cup Begins</div>
        <div className="hl-date">July 1st @ 7:00 PM UTC</div>
        <button className="hl-cta-green" onClick={go}>Sign Up to Play</button>
      </FadeSection>

      {/* INSTINCT VS POPULARITY */}
      <FadeSection className="hl-block">
        <h2 className="hl-h2">Most art competitions reward popularity. This one rewards instinct.</h2>
        <p className="hl-sub">Hesitation isn't neutrality … it's a miss. Your first reaction is your real opinion.</p>
      </FadeSection>

      {/* HOW IT WORKS — sticky split-screen */}
      <FadeSection className="hl-block hl-hiw">
        <h2 className="hl-h2">How It Works …</h2>
        <HowItWorks steps={steps} />
      </FadeSection>

      {/* GREEN BAND */}
      <FadeSection className="hl-green-band">
        <h2 className="hl-band-h">Instinct Is Honest. Deliberation Is a Story You Tell Yourself.</h2>
        <button className="hl-cta-dark" onClick={go}>Sign Up to Play</button>
      </FadeSection>

      {/* CLOSING — 40 artworks grid with trophy in the middle */}
      <FadeSection className="hl-block">
        <h2 className="hl-h2">The Art World Cup</h2>
        <p className="hl-sub">40 artworks enter. One artwork lifts the Cup.</p>
        <div className="hl-roster">
          {Array.from({ length: ROSTER_COUNT }, (_, i) => {
            const id = i + 1;
            return (
              <React.Fragment key={id}>
                {/* drop the trophy logo into the middle of the grid */}
                {i === 18 ? <div className="hl-trophy"><LogoSvg /></div> : null}
                <div className="hl-tile"><img src={rosterImg(id)} alt={teamName(id)} loading="lazy" /></div>
              </React.Fragment>
            );
          })}
        </div>
      </FadeSection>
    </div>
  );
}

export function ViewPlay({ ctx, loginOnMount }) {
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  useEffect(() => { if (loginOnMount && !ctx.id) ctx.login(); }, [loginOnMount]); // eslint-disable-line
  useEffect(() => { resolveWagers(); }, []);

  // Single per-second tick drives the live match (clock/score/% only).
  useEffect(() => {
    const iv = setInterval(() => rerender(), 1000);
    return () => clearInterval(iv);
  }, [rerender]);

  const f = currentFixture();
  const fxId = f ? f.id : 'none';

  return (
    <div className="match-wrap" key={fxId}>
      <MatchCenter ctx={ctx} rerender={rerender} />
      <div style={{ marginTop: 40 }}><SocialStrip ctx={ctx} /></div>
    </div>
  );
}

/* ===== Distraction-board marquee frame =====
   4-edge clipped scrolling marquee (top/bottom horizontal, left/right rotated
   vertical, all scrolling ~55s, opposite directions) hugging the pitch.
   Per-match signboard text/image persisted in localStorage owc:mq:<matchId>. */
const MARQUEE_TXT = 'DISTRACTION BOARD • PAY NO ATTENTION • OR PAY FOR YOUR DISTRACTION HERE • ';
function mqKey(matchId) { return 'owc:mq:' + matchId; }
function getMqCfg(matchId) {
  if (!matchId) return null;
  try { const raw = localStorage.getItem(mqKey(matchId)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function setMqCfg(matchId, cfg) {
  if (!matchId) return;
  try {
    if (cfg && (cfg.text || cfg.img || cfg.color || cfg.bg)) localStorage.setItem(mqKey(matchId), JSON.stringify(cfg));
    else localStorage.removeItem(mqKey(matchId));
  } catch (e) { /* ignore */ }
}
function mqTextFor(matchId) {
  const cfg = getMqCfg(matchId);
  if (cfg && cfg.text && cfg.text.trim()) return cfg.text.trim().toUpperCase() + ' • ';
  return MARQUEE_TXT;
}
function MqContent({ matchId, orient }) {
  const cfg = getMqCfg(matchId);
  // tile uploaded image many times so the strip is always full (no blank gaps)
  if (cfg && cfg.img) {
    const n = orient === 'v' ? 60 : 48;
    return <>{Array.from({ length: n }, (_, i) => (
      <img key={i} className="mq-img" src={cfg.img} alt="" style={{ width: 'auto', objectFit: 'contain', verticalAlign: 'middle', marginRight: 14 }} />
    ))}</>;
  }
  // repeat the text unit a large fixed count so the track is always overfull,
  // then the -50% scroll keystone always has content (no "TEST · TEST …" gaps)
  const unit = mqTextFor(matchId);
  const reps = orient === 'v' ? 80 : 60;
  return <>{unit.repeat(reps)}</>;
}
function Marquee({ edge, matchId }) {
  const cfg = getMqCfg(matchId);
  const st = {};
  if (cfg && cfg.color) st.color = cfg.color;
  if (cfg && cfg.bg) st.background = cfg.bg;
  if (edge === 'top' || edge === 'bottom') {
    return <div className={'marquee mq-' + edge} style={st}><span className="mq-track"><MqContent matchId={matchId} orient="h" /></span></div>;
  }
  return (
    <div className={'marquee mq-' + edge} style={st}>
      <div className="mq-rot"><span className="mq-vtrack"><MqContent matchId={matchId} orient="v" /></span></div>
    </div>
  );
}

/* deterministic 0..7 cell from a string seed (stable across per-second ticks) */
function shotCellFromSeed(seed, salt) {
  let hsh = 0; const str = String(seed) + '|' + (salt || '');
  for (let i = 0; i < str.length; i++) { hsh = (hsh * 31 + str.charCodeAt(i)) | 0; }
  hsh = Math.abs(hsh);
  return { col: hsh % 8, row: (Math.floor(hsh / 8)) % 8 };
}
function ShotOverlay({ side, seed }) {
  const c = shotCellFromSeed(seed, side);
  return (
    <div className={'shot-ov shot-' + side}>
      <div className="shot-cell" style={{ left: (c.col / 8 * 100) + '%', top: (c.row / 8 * 100) + '%' }} />
    </div>
  );
}

/* the field on the strict grid: LEFT art cols 0-7 (0-50%), RIGHT art cols 8-15
   (50-100%); field-2 markings overlay (-100..1700); solid black goal boxes
   (1 cell x 2 cells, rows 3-4) sticking out one cell each side; vote zones over
   the two image rects only; center state; voted shot overlay; FT extras. */
function PitchField({ aId, bId, zones, state, extra, votedSide, votedSeed }) {
  return (
    <div className="pitch-wrap mc-pitch arena">
      <div className="pitch-imgs">
        <div className="pitch-half half hl" style={{ backgroundImage: aId ? `url('${rosterImg(aId)}')` : 'none' }}>
          {aId && <div className="shot-hover"><div className="shot-cell" /></div>}
          {votedSide === 'l' && <ShotOverlay side="l" seed={votedSeed} />}
        </div>
        <div className="pitch-half half hr" style={{ backgroundImage: bId ? `url('${rosterImg(bId)}')` : 'none' }}>
          {bId && <div className="shot-hover"><div className="shot-cell" /></div>}
          {votedSide === 'r' && <ShotOverlay side="r" seed={votedSeed} />}
        </div>
      </div>
      <FieldSvg />
      <div className="goal-box l" />
      <div className="goal-box r" />
      {zones}
      {state}
      {extra}
    </div>
  );
}

/* board = one-cell marquee FRAME (z below) + the 1600x800 play area (z above)
   + signboard edit button. The play area sits inside the marquee frame. */
function Board({ children, phaseClass, matchId, onEdit }) {
  return (
    <div className="board">
      {/* marquee frame — rendered BELOW the play area (lower z-index) */}
      <Marquee edge="top" matchId={matchId} />
      <Marquee edge="bottom" matchId={matchId} />
      <Marquee edge="left" matchId={matchId} />
      <Marquee edge="right" matchId={matchId} />
      {/* play area (1600x800) — team images + field + goal boxes live here */}
      <div className={'board-inner play-area' + (phaseClass ? ' ' + phaseClass : '')}>
        {children}
      </div>
      {matchId && (
        <button className="mq-edit" title="Edit signboards" aria-label="Edit signboards"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎</button>
      )}
    </div>
  );
}

function BoardState({ big, lbl, attrs }) {
  return (
    <div className="board-state">
      {big != null && <div className="bs-big" {...(attrs || {})}>{big}</div>}
      {lbl && <div className="bs-lbl bs-blend">{lbl}</div>}
    </div>
  );
}

/* Pixel confetti — a one-shot burst of small colored squares that fall/scatter
   for ~2.6s then stop. Memoized off `seed` so it is generated once when FT is
   entered (not rebuilt every per-second tick). Pure CSS animation, no deps. */
const Confetti = React.memo(function Confetti({ seed }) {
  const pieces = React.useMemo(() => {
    let h = 0; const str = String(seed);
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return (h % 1000) / 1000; };
    return Array.from({ length: 44 }, () => ({
      left: rnd() * 100,
      delay: rnd() * 0.5,
      dur: 1.8 + rnd() * 1.0,
      drift: (rnd() - 0.5) * 80,
      size: 6 + Math.round(rnd() * 8),
      color: COLORS[Math.floor(rnd() * COLORS.length)],
      spin: rnd() * 720 - 360,
    }));
  }, [seed]);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-pc" style={{
          left: p.left + '%', width: p.size, height: p.size, background: p.color,
          animationDelay: p.delay + 's', animationDuration: p.dur + 's',
          '--drift': p.drift + 'px', '--spin': p.spin + 'deg',
        }} />
      ))}
    </div>
  );
});

function Scoreboard({ t, tl, finished, winner }) {
  const lWin = finished && winner === t.a, rWin = finished && winner === t.b;
  return (
    <div className="scoreboard">
      <div className={'sb-cell l' + (lWin ? ' sb-win' : '')}>
        <div className="sb-nm">{teamName(t.a)}</div>
        <div className="sb-score"><AnimatedNumber value={tl.L} /></div>
      </div>
      <div className="sb-mid"><span className="sb-vs">–</span></div>
      <div className={'sb-cell r' + (rWin ? ' sb-win' : '')}>
        <div className="sb-nm">{teamName(t.b)}</div>
        <div className="sb-score"><AnimatedNumber value={tl.R} /></div>
      </div>
    </div>
  );
}

/* ── Circular concentric bracket (the centerpiece) ── */
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx, cy, r, a0, a1) {
  const s = polar(cx, cy, r, a1), e = polar(cx, cy, r, a0);
  const large = (a1 - a0) <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}
function CircularBracket() {
  const SZ = 560, cx = SZ / 2, cy = SZ / 2;
  // outer→inner radii per round (r1..r6). r6 = champion center.
  const radii = { r1: 250, r2: 205, r3: 162, r4: 122, r5: 84, r6: 0 };
  const liveId = (liveFixture() || {}).id;
  const imgR = { r1: 9, r2: 12, r3: 16, r4: 20, r5: 24 };
  const arcs = [];
  const imgs = [];
  const defs = [];

  ROUNDS.forEach((R) => {
    if (R.key === 'r6') return; // champion drawn at center
    const fxs = SCHEDULE.filter((f) => f.rk === R.key);
    const n = fxs.length;
    const r = radii[R.key];
    const ir = imgR[R.key];
    const gap = n > 1 ? 3 : 0; // degrees of gap between arcs
    const span = 360 / n;
    fxs.forEach((f, i) => {
      const a0 = i * span + gap / 2;
      const a1 = (i + 1) * span - gap / 2;
      const st = status(f);
      const isLive = f.id === liveId;
      const cls = 'cb-arc' + (st === 'ft' ? ' ft' : '') + (isLive ? ' live' : '');
      arcs.push(<path key={f.id} className={cls} d={arcPath(cx, cy, r, a0, a1)} />);
      // place the two team images along the arc when known
      const t = fxTeams(f);
      const mid = (a0 + a1) / 2;
      const off = Math.min(span / 2 - 1.5, span * 0.28);
      [[t.a, mid - off], [t.b, mid + off]].forEach(([tid, deg], k) => {
        if (!tid) return;
        const p = polar(cx, cy, r, deg);
        const cid = `cbimg-${R.key}-${i}-${k}`;
        defs.push(
          <clipPath key={cid} id={cid}><circle cx={p.x} cy={p.y} r={ir} /></clipPath>
        );
        imgs.push(
          <g key={cid + 'g'}>
            <image href={rosterImg(tid)} x={p.x - ir} y={p.y - ir} width={ir * 2} height={ir * 2}
              clipPath={`url(#${cid})`} preserveAspectRatio="xMidYMid slice" />
            <circle cx={p.x} cy={p.y} r={ir} className={'cb-imgring' + (isLive ? ' live' : '')} />
          </g>
        );
      });
    });
  });

  const ch = champion();
  const finalFx = SCHEDULE.find((f) => f.rk === 'r6');
  const finalLive = !!finalFx && finalFx.id === liveId;

  return (
    <div className="circle-bracket" onClick={() => { location.hash = '#/bracket'; }} title="Open full bracket">
      <div className="cb-title">The Bracket</div>
      <svg viewBox={`0 0 ${SZ} ${SZ}`} className="cb-svg" aria-label="Tournament bracket">
        <defs>{defs}</defs>
        {/* faint guide rings */}
        {Object.entries(radii).map(([k, r]) => r > 0 && (
          <circle key={k} cx={cx} cy={cy} r={r} className="cb-ring" />
        ))}
        {arcs}
        {imgs}
        {/* champion center */}
        <circle cx={cx} cy={cy} r={48} className={'cb-center' + (finalLive ? ' live' : '')} />
        {ch ? (
          <>
            <clipPath id="cb-champ"><circle cx={cx} cy={cy} r={40} /></clipPath>
            <image href={rosterImg(ch)} x={cx - 40} y={cy - 40} width={80} height={80} clipPath="url(#cb-champ)" preserveAspectRatio="xMidYMid slice" />
            <circle cx={cx} cy={cy} r={40} className="cb-champring" />
          </>
        ) : (
          <text x={cx} y={cy + 14} textAnchor="middle" className="cb-trophy">🏆</text>
        )}
      </svg>
      <div className="cb-legend">Outer → inner · winners move in · tap to open</div>
    </div>
  );
}

/* ── Match Center — single-column, per-second state machine ── */
function MatchCenter({ ctx, rerender }) {
  const f = currentFixture();

  // Tournament over → champion screen.
  if (!f) {
    const ch = champion();
    return (
      <div>
        <div className="match-no">The Cup is Lifted</div>
        <p className="sb-sub">The tournament is complete.</p>
        {ch && (
          <div className="mc-champ" style={{ maxWidth: 420, margin: '18px auto' }}>
            <img src={rosterImg(ch)} alt="" />
            <div><div className="mc-champ-lbl">🏆 Champion</div><b>{teamName(ch)}</b></div>
          </div>
        )}
        <div className="center" style={{ marginTop: 16 }}><a className="btn-ghost" href="#/bracket">View the bracket →</a></div>
      </div>
    );
  }
  return <MatchPanel key={f.id} ctx={ctx} f={f} rerender={rerender} />;
}

function MatchPanel({ ctx, f, rerender }) {
  const t = fxTeams(f), mId = fxMatchId(f);
  const openedAt = useRef(Date.now());
  const [reaction, setReaction] = useState(null);
  const [sbOpen, setSbOpen] = useState(false);
  const reactT = useRef();
  useEffect(() => () => clearTimeout(reactT.current), []);

  const mc = matchClock(f);
  const phase = mc.phase;
  const matchNo = fxIndex(f) + 1;

  // status-row center cell (Geist sans; dot blinks only on LIVE)
  let stClass, stCenter;
  if (phase === '1H' || phase === '2H' || phase === 'HT') {
    stClass = 'msr-live';
    stCenter = <><span className="live-dot" /><span>LIVE</span></>;
  } else if (phase === 'ft') {
    stClass = 'msr-ft';
    stCenter = <span>FULL TIME</span>;
  } else {
    stClass = 'msr-ko';
    stCenter = <span>KICKOFF</span>;
  }

  const TitleRow = <div className="match-no">Match No. {matchNo}</div>;
  const StatusRow = (
    <div className="match-status-row">
      <div className="msr-l">{roundDisp(f)}</div>
      <div className={'msr-c ' + stClass}>{stCenter}</div>
      <div className="msr-r">{fmtLongDate(f.kickoff)}</div>
    </div>
  );
  const Editor = sbOpen ? <SignboardEditor matchId={mId} onClose={() => { setSbOpen(false); rerender(); }} /> : null;

  /* matchup pending */
  if (!t.a || !t.b) {
    return (
      <div className="match-fade">
        {TitleRow}{StatusRow}
        <Board matchId={mId} onEdit={() => setSbOpen(true)}>
          <PitchField aId={null} bId={null} state={<BoardState lbl="MATCHUP PENDING" />} />
        </Board>
        <p className="sb-sub">Waiting on the previous round to finish.</p>
        <MatchInfo ctx={ctx} f={f} t={t} mId={mId} />
        {Editor}
      </div>
    );
  }

  const tl = tallyMatch(mId), mv = myVoteFor(mId, ctx.id);

  const showReaction = (decisionMs, teamNm, switched) => {
    setReaction(shotReaction(decisionMs, teamNm, switched));
    clearTimeout(reactT.current);
    reactT.current = setTimeout(() => setReaction(null), 2600);
  };
  const vote = (side) => {
    if (!canVote(f)) {
      flash(phase === 'HT' ? 'Halftime — voting resumes for the 2nd half' : 'Voting is closed right now');
      return;
    }
    if (!ctx.id) return requireCheckIn(ctx);
    const prev = myVoteFor(mId, ctx.id);
    const switched = !!prev && prev.side !== side;
    const decisionMs = Date.now() - openedAt.current;
    castShot(mId, ctx.id, side, decisionMs);
    showReaction(decisionMs, teamName(side === 'LFT' ? t.a : t.b), switched);
    rerender();
  };

  /* ---- KICKOFF / UPCOMING ---- */
  if (phase === 'up' || phase === 'KO') {
    const num = phase === 'KO' ? mc.remain : Math.max(0, Math.ceil((f.kickoff - Date.now()) / 1000));
    const koState = (
      <div className="board-state">
        <div className="bs-big bs-blend"><span>KICKOFF IN</span></div>
        <div className="bs-lbl bs-blend"><AnimatedNumber value={num} suffix="S" /></div>
      </div>
    );
    return (
      <div className="match-fade">
        {TitleRow}{StatusRow}
        <Board matchId={mId} phaseClass="ko" onEdit={() => setSbOpen(true)}>
          <PitchField aId={t.a} bId={t.b} state={koState} />
        </Board>
        <button className="wager-cta" onClick={() => { if (!ctx.id) return requireCheckIn(ctx); openWager(ctx, f, rerender); }}>Wager TP on this match →</button>
        <p className="wager-note">Taste Points (TP) is the game critique currency. TP has no monetary value.</p>
        <MatchInfo ctx={ctx} f={f} t={t} mId={mId} />
        {Editor}
      </div>
    );
  }

  /* ---- HALFTIME ---- */
  if (phase === 'HT') {
    const htState = (
      <div className="board-state">
        <div className="bs-big bs-blend"><span>HALFTIME</span></div>
        <div className="bs-lbl bs-blend"><AnimatedNumber value={mc.remain} suffix="S" /></div>
      </div>
    );
    return (
      <div className="match-fade">
        {TitleRow}{StatusRow}
        <Board matchId={mId} phaseClass="ht" onEdit={() => setSbOpen(true)}>
          <PitchField aId={t.a} bId={t.b} state={htState} />
        </Board>
        <Scoreboard t={t} tl={tl} finished={false} />
        <p className="sb-sub">Take your shot. Choose your Opepen. Left, or Right?</p>
        <MatchInfo ctx={ctx} f={f} t={t} mId={mId} />
        {Editor}
      </div>
    );
  }

  /* ---- FULL TIME ---- (winner centered + green field + pixel confetti) */
  if (phase === 'ft') {
    const lp = tl.total ? Math.round(tl.L / tl.total * 100) : 50;
    const w = winnerOf(f.id) || (lp >= 50 ? t.a : t.b);
    const extra = (
      <>
        <div className="ft-winwrap">
          <div className="ft-shot block ft-winart">
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${rosterImg(w)}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <FtStatLayer mId={mId} />
          </div>
        </div>
        <Confetti seed={f.id} />
        <div className="board-state ft-winlabel"><div className="bs-big bs-blend"><span>WINNER!</span></div></div>
      </>
    );
    return (
      <div className="match-fade">
        {TitleRow}{StatusRow}
        <Board matchId={mId} phaseClass="ft-win" onEdit={() => setSbOpen(true)}>
          <PitchField aId={t.a} bId={t.b} state={null} extra={extra} />
        </Board>
        <Scoreboard t={t} tl={tl} finished winner={w} />
        <p className="sb-sub">{teamName(w)} go through. Hover the artwork for the match stats layer.</p>
        <MatchInfo ctx={ctx} f={f} t={t} mId={mId} />
        {Editor}
      </div>
    );
  }

  /* ---- LIVE (1H / 2H) ---- */
  const zones = (
    <div className="vote-zones">
      <div className="vote-zone zl" onClick={() => vote('LFT')} />
      <div className="vote-zone zr" onClick={() => vote('RGT')} />
    </div>
  );
  const stateNode = <BoardState big={<AnimatedNumber className="bs-blend" value={mc.up} suffix="S" />} />;
  const extra = reaction ? <div className="mc-reaction">{reaction}</div> : null;
  return (
    <div className="match-fade">
      {TitleRow}{StatusRow}
      <Board matchId={mId} onEdit={() => setSbOpen(true)}>
        <PitchField aId={t.a} bId={t.b} zones={zones} state={stateNode} extra={extra}
          votedSide={mv ? (mv.side === 'LFT' ? 'l' : 'r') : null} votedSeed={mId} />
      </Board>
      <Scoreboard t={t} tl={tl} finished={false} />
      <p className="sb-sub">Take your shot. Choose your Opepen. Left, or Right?</p>
      <MatchInfo ctx={ctx} f={f} t={t} mId={mId} />
      {Editor}
    </div>
  );
}

/* ── Per-match signboard editor (custom marquee text / uploaded image) ── */
function SignboardEditor({ matchId, onClose }) {
  const cfg = getMqCfg(matchId) || {};
  const [text, setText] = useState(cfg.text || '');
  const [img, setImg] = useState(cfg.img || null);
  const [color, setColor] = useState(cfg.color || '#5a5a5a');
  const [bg, setBg] = useState(cfg.bg || '#070707');
  const onFile = (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => setImg(rd.result);
    rd.readAsDataURL(file);
  };
  return (
    <div className="sb-back" onClick={onClose}>
      <div className="sb-pop" onClick={(e) => e.stopPropagation()}>
        <button className="sb-pop-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="sb-pop-h">Edit signboards</div>
        <label className="sb-lbl">Marquee text</label>
        <textarea className="sb-text" rows="2" placeholder="Custom signboard text for this match…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="sb-colors">
          <div className="sb-col">
            <label className="sb-lbl">Text color</label>
            <input type="color" className="sb-color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div className="sb-col">
            <label className="sb-lbl">Background</label>
            <input type="color" className="sb-color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </div>
        </div>
        <label className="sb-lbl">Upload image (tiled banner)</label>
        <input type="file" accept="image/*" className="sb-file" onChange={onFile} />
        <div className="sb-prev">{img && <img src={img} alt="preview" style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain' }} />}</div>
        <div className="sb-row">
          <button className="sb-btn sb-save" onClick={() => { setMqCfg(matchId, { text, img, color, bg }); toast('Signboard updated for this match'); onClose(); }}>Save</button>
          <button className="sb-btn sb-clear" onClick={() => { setMqCfg(matchId, null); toast('Signboard reset to default'); onClose(); }}>Clear / Reset</button>
        </div>
      </div>
    </div>
  );
}

/* ── Post-match stats reveal (CSS :hover, no JS flicker) ──
   Wrap any finished-match artwork; a translucent green overlay with
   off-white label/value rows reveals on hover. */
export function StatsOverlay({ mId, t, w }) {
  const s = matchStats(mId);
  const gd = Math.abs((s.goalsL || 0) - (s.goalsR || 0));
  const avg = (((s.dtL || 0) + (s.dtR || 0)) / 2);
  const rows = [
    ['Goals', `${s.goalsL}-${s.goalsR}`],
    ['Shots', `${s.L.shots}-${s.R.shots}`],
    ['Shots on target', `${s.L.ot}-${s.R.ot}`],
    ['Own goals', `${s.L.og}-${s.R.og}`],
    ['Avg decision time', `${(Math.round(avg * 10) / 10)}s`],
    ['Goal difference', `+${gd}`],
    ['Possession', `${s.possL}% / ${s.possR}%`],
  ];
  return (
    <div className="stats-overlay" aria-hidden="true">
      <div className="so-title">Full-time stats</div>
      {rows.map(([k, v]) => (
        <div className="so-row" key={k}><span className="so-k">{k}</span><span className="so-v">{v}</span></div>
      ))}
    </div>
  );
}

/* translucent green FT stats layer revealed on hover over the winner artwork */
function FtStatLayer({ mId }) {
  const s = matchStats(mId);
  const gd = Math.abs(s.goalsL - s.goalsR);
  const rows = [
    ['Goals', `${s.goalsL} – ${s.goalsR}`],
    ['Shots', `${s.L.shots} – ${s.R.shots}`],
    ['Shots on target', `${s.L.ot} – ${s.R.ot}`],
    ['Own goals', `${s.L.og} – ${s.R.og}`],
    ['Avg decision', `${s.dtL}s / ${s.dtR}s`],
    ['Goal difference', `+${gd}`],
    ['Possession', `${s.possL}% / ${s.possR}%`],
  ];
  return (
    <div className="ft-statlayer">
      <div className="sl-title">Match stats</div>
      {rows.map(([k, v]) => (
        <div className="ft-statrow" key={k}><span className="sl-lab">{k}</span><span className="sl-val">{v}</span></div>
      ))}
    </div>
  );
}

/* ===== MATCH INFO (redesign): KEY STATS / COMMENTARY / CRITIQUE ===== */
function KeyStatsPane({ t, mId }) {
  const s = matchStats(mId);
  const Bar = ({ lab, lv, rv, fmt }) => {
    const l = fmt ? fmt(lv) : String(lv), r = fmt ? fmt(rv) : String(rv);
    const tot = (+lv) + (+rv) || 1; const lpc = Math.round((+lv) / tot * 100);
    return (
      <div className="ks-row">
        <div className="ks-vals"><span>{l}</span><span className="ks-lab">{lab}</span><span>{r}</span></div>
        <div className="ks-bar"><div className="l" style={{ width: lpc + '%' }} /><div className="r" style={{ width: (100 - lpc) + '%' }} /></div>
      </div>
    );
  };
  return (
    <div>
      <div className="ks-head">
        <div className="ks-team"><img src={rosterImg(t.a)} alt="" />{teamName(t.a)}</div>
        <div className="ks-team">{teamName(t.b)}<img src={rosterImg(t.b)} alt="" /></div>
      </div>
      <div className="ks-sub">Goals &amp; Shots</div>
      <Bar lab="Goals" lv={s.goalsL} rv={s.goalsR} />
      <Bar lab="Shots" lv={s.L.shots} rv={s.R.shots} />
      <Bar lab="Shots on target" lv={s.L.ot} rv={s.R.ot} />
      <Bar lab="Own goals" lv={s.L.og} rv={s.R.og} />
      <div className="ks-sub">Decisiveness</div>
      <Bar lab="Average decision time" lv={s.dtL} rv={s.dtR} fmt={(v) => v + 's'} />
      {s.total === 0 && <p className="note center" style={{ marginTop: 16 }}>No shots yet — be the first to vote.</p>}
    </div>
  );
}

/* Seeded PRNG (Mulberry32-ish) so flavor beats are STABLE across per-second ticks. */
function seededRng(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function CommentaryPane({ f, t, mId }) {
  const v = Object.values(getVotesFor(mId)).sort((a, b) => a.voteTs - b.voteTs);
  const mc = matchClock(f);
  const nameA = teamName(t.a), nameB = teamName(t.b);
  let seed = 0; for (const c of f.id) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  seed = Math.abs(seed) || 1;
  const rng = seededRng(seed);
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];

  // current match-minute (0..90) reached so far
  const phaseMin = mc.phase === 'ft' ? 90 : (mc.phase === 'up' || mc.phase === 'KO') ? 0 : Math.min(90, mc.up || 0);
  const secOf = (x) => Math.min(90, Math.max(1, Math.round((x.voteTs - f.kickoff) / 1000) - KICKOFF_S));

  // ── beat pools (Guardian-style flavor) ──
  const possBeats = [
    `${nameA} keep the ball, knocking it about with intent.`,
    `${nameB} press high and force a turnover.`,
    `A possession swing — ${nameB} now dictating the tempo.`,
    `Patient build-up from ${nameA}, probing for an opening.`,
    `End to end stuff now; neither side willing to sit back.`,
    `${nameB} switch the play and stretch the pitch.`,
  ];
  const shotBeats = [
    `A tester from distance — ${nameA} go close.`,
    `${nameB} sting the keeper's palms with a low drive.`,
    `Half-chance for ${nameA}, scrambled away.`,
    `${nameB} force a smart save down to the right.`,
    `Off target — ${nameA} drag it wide of the upright.`,
    `Blocked! ${nameB} fizz one into a defender.`,
  ];
  const crowdBeats = [
    `The crowd are up on their feet for that one.`,
    `A roar around the ground as the tackles fly in.`,
    `Nervy atmosphere here — every touch scrutinised.`,
    `The neutrals are loving this open contest.`,
  ];
  const nearBeats = [
    `Oh, so close! ${nameA} rattle the woodwork.`,
    `A near-miss — ${nameB} flash one across the face of goal.`,
    `Inches away! ${nameA} can't quite convert.`,
  ];

  const lines = [];
  lines.push({ m: 1, key: 'Kick-off', t: `Kick-off at the ${roundDisp(f)}. ${nameA} get us underway against ${nameB}.` });

  // ── vote-driven goals / lead changes / own goals ──
  let L = 0, R = 0, lastLead = null;
  const voteEvents = [];
  v.forEach((x) => {
    const el = secOf(x);
    if (x.side === 'LFT') L++; else R++;
    const lead = L > R ? 'L' : R > L ? 'R' : null;
    if (lead && lead !== lastLead) { lastLead = lead; const team = lead === 'L' ? nameA : nameB; voteEvents.push({ m: el, ev: true, key: 'Goal!', t: `${team} hit the front — a confident shot finds the corner.` }); }
    else if ((x.changes || 0) >= 2) { voteEvents.push({ m: el, key: 'Own goal', t: 'Disaster — a voter changes their mind once too often and turns it into an own goal.' }); }
    else if (shotKind(x.decisionMs || 10000) === 'on target') { voteEvents.push({ m: el, key: 'On target', t: `A decisive vote — ${(x.side === 'LFT' ? nameA : nameB)} force a save.` }); }
  });
  voteEvents.forEach((e) => lines.push(e));

  // ── flavored beats on a ~5s cadence across the minutes played so far ──
  const beatKinds = [
    { key: 'Possession', pool: possBeats },
    { key: 'Shot', pool: shotBeats },
    { key: 'Off target', pool: shotBeats },
    { key: 'Near miss', pool: nearBeats },
    { key: 'Crowd', pool: crowdBeats },
  ];
  for (let m = 5; m <= Math.max(5, phaseMin); m += 5) {
    if (m === 45) continue; // reserve for half-time
    const bk = beatKinds[Math.floor(rng() * beatKinds.length) % beatKinds.length];
    lines.push({ m, key: bk.key, t: pick(bk.pool) });
  }

  // ── half-time / full-time ──
  if (phaseMin >= 45) lines.push({ m: 45, key: 'Half-time', t: `Half-time. ${L >= R ? nameA : nameB} edge it on shots so far.` });
  if (mc.phase === 'ft') { const w = winnerOf(f.id); lines.push({ m: 90, ev: true, key: 'Full time', t: `Full time. ${w ? teamName(w) : '—'} go through. A deserved result on the balance of the shots.` }); }
  else if (mc.phase === '1H' || mc.phase === '2H' || mc.phase === 'HT') {
    lines.push({ m: Math.max(2, phaseMin), key: 'Live', t: pick(possBeats) });
  }

  // sort by minute, then de-dup identical consecutive texts
  const sorted = lines.sort((a, b) => a.m - b.m || (a.ev ? -1 : 1));
  const out = []; let prevTxt = null;
  sorted.forEach((l) => { if (l.t !== prevTxt) { out.push(l); prevTxt = l.t; } });
  // ITEM 4: latest on top — display newest-first (descending by minute). Kick-off
  // ends at the bottom, full-time at the top as the match progresses.
  const display = out.slice().reverse();

  return (
    <div>
      <div className="cm">
        {display.map((l, i) => (
          <div className="cm-row" key={i}>
            <div className="cm-min">{l.m}″</div>
            <div><div className={'cm-key' + (l.ev ? ' ev' : '')}>{l.key.toUpperCase()}</div><div className="cm-txt">{l.t}</div></div>
          </div>
        ))}
      </div>
      <p className="cm-foot">Live, in-match critique &amp; voting updates.</p>
    </div>
  );
}

function MatchInfo({ ctx, f, t, mId }) {
  const [tab, setTab] = useState('stats');
  return (
    <div className="matchinfo">
      <h2 className="mi-head">Match Info</h2>
      <div className="mi-tabs">
        <button className={'mi-tab' + (tab === 'stats' ? ' active' : '')} onClick={() => setTab('stats')}>Key Stats</button>
        <button className={'mi-tab' + (tab === 'pbp' ? ' active' : '')} onClick={() => setTab('pbp')}>Commentary</button>
        <button className={'mi-tab' + (tab === 'chat' ? ' active' : '')} onClick={() => setTab('chat')}>Critique</button>
      </div>
      <div className="mi-pane">
        {(!t.a || !t.b) ? <p className="note center" style={{ marginTop: 18 }}>Stats appear once the matchup is set.</p>
          : tab === 'stats' ? <KeyStatsPane t={t} mId={mId} />
            : tab === 'pbp' ? <CommentaryPane f={f} t={t} mId={mId} />
              : <MatchChat ctx={ctx} mId={mId} heightPx={320} />}
      </div>
    </div>
  );
}

function ScoreLine({ t, tl }) {
  return (
    <div className="mc-score">
      <div className="mc-score-team"><img src={rosterImg(t.a)} alt="" /><span>{teamName(t.a)}</span></div>
      <div className="mc-score-nums">{tl.L} <span>-</span> {tl.R}</div>
      <div className="mc-score-team r"><span>{teamName(t.b)}</span><img src={rosterImg(t.b)} alt="" /></div>
    </div>
  );
}

function HalftimeShare({ ctx, f, mId, leader, tl }) {
  const [, force] = useState(0);
  const flagKey = 'ht:' + mId; // one +25 TP award per match, guarded via tp().flags
  const already = !!tp().flags[flagKey];
  const onShare = () => {
    const txt = `${teamName(leader)} leads ${tl.L}-${tl.R} at halftime in the Opepen World Cup. Who you got?`;
    shareOnX(txt, () => {
      // earnOnce persists the flag in tp() and awards exactly once.
      if (ctx.id && earnOnce(flagKey, 25, 'Shared at halftime')) {
        ctx.rerender(); force((n) => n + 1);
        toast('+25 TP — thanks for sharing!');
      }
    });
  };
  return (
    <div className="ht-share">
      <div className="ht-share-txt">{teamName(leader)} leads {tl.L}-{tl.R} at halftime — share for {already ? 'TP earned' : '+25 TP'}</div>
      <button className="btn-x" onClick={onShare} disabled={already}><XLogo /> {already ? 'Shared ✓' : 'Share on X (+25 TP)'}</button>
    </div>
  );
}

/* shared tab strip used by every match phase */
function MatchTabs({ ctx, f, t, mId, activeTab, setActiveTab }) {
  return (
    <>
      <div className="tabs">
        <button className={'tab' + (activeTab === 'stats' ? ' active' : '')} onClick={() => setActiveTab('stats')}>Match Stats</button>
        <button className={'tab' + (activeTab === 'pbp' ? ' active' : '')} onClick={() => setActiveTab('pbp')}>Play-by-Play</button>
        <button className={'tab' + (activeTab === 'chat' ? ' active' : '')} onClick={() => setActiveTab('chat')}>Critique</button>
      </div>
      <div className="tabpane">
        {activeTab === 'stats' && <StatsPane f={f} t={t} mId={mId} />}
        {activeTab === 'pbp' && <PbpPane f={f} t={t} mId={mId} />}
        {activeTab === 'chat' && <MatchChat ctx={ctx} mId={mId} />}
      </div>
    </>
  );
}

/* ── Social / results / leaderboard strip (full width, below split) ── */
function SocialStrip({ ctx }) {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const fts = SCHEDULE.filter((f) => status(f) === 'ft').slice(-8).reverse();
  const players = allPlayers();
  return (
    <div className="social-strip">
      <div className="ss-col">
        <div className="sec-title">Recent results</div>
        {fts.length ? fts.map((f) => {
          const tt = fxTeams(f), w = winnerOf(f.id);
          return (
            <div className="fx fx-ft" key={f.id} onClick={() => openMatchDetail(ctx, f, rerender)}>
              <img src={rosterImg(tt.a)} alt="" /><span className={'nm' + (w === tt.a ? ' win' : '')}>{tt.a ? teamName(tt.a) : 'TBD'}</span>
              <span className="vs">v</span>
              <img src={rosterImg(tt.b)} alt="" /><span className={'nm' + (w === tt.b ? ' win' : '')}>{tt.b ? teamName(tt.b) : 'TBD'}</span>
              <span className="time">{f.rn}</span><span className="st ft">FT</span>
            </div>
          );
        }) : <div className="note">No matches finished yet.</div>}
      </div>
      <div className="ss-col ss-side">
        <div className="sec-title">The room</div>
        <div className="ss-stat"><div className="ss-num">{nFmt(players.length)}</div><div className="ss-lbl">players in the pool</div></div>
        <button className="btn-x" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
          onClick={() => shareWithEarn(ctx, "I'm watching the Opepen World Cup live — vote, predict and earn Taste Points 🏆")}>
          <XLogo /> Share the tournament
        </button>
        <a className="btn-ghost" style={{ display: 'block', textAlign: 'center', marginTop: 10 }} href="#/standings">View standings →</a>
      </div>
    </div>
  );
}

function StatsPane({ f, t, mId }) {
  const s = matchStats(mId);
  const Bar = ({ lab, lv, rv, fmt }) => {
    const l = fmt ? fmt(lv) : lv, r = fmt ? fmt(rv) : rv;
    const tot = (+lv) + (+rv) || 1; const lpc = Math.round((+lv) / tot * 100);
    return (
      <div className="ms-row">
        <div className="ms-vals"><span>{l}</span><span className="lab">{lab}</span><span>{r}</span></div>
        <div className="ms-bar"><div className="l" style={{ width: lpc + '%' }} /><div className="r" style={{ width: (100 - lpc) + '%' }} /></div>
      </div>
    );
  };
  return (
    <>
      <div className="ms-head">
        <div className="ms-team"><img src={rosterImg(t.a)} alt="" />{teamName(t.a)}</div>
        <span>Key</span>
        <div className="ms-team">{teamName(t.b)}<img src={rosterImg(t.b)} alt="" /></div>
      </div>
      <div className="ms-poss">
        <div style={{ textAlign: 'center' }}><div className="pv" style={{ color: 'var(--green-bright)' }}>{s.possL}%</div></div>
        <svg width="92" height="92" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#fff" strokeWidth="4" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--green-bright)" strokeWidth="4" strokeDasharray={`${s.possL} ${100 - s.possL}`} strokeDashoffset="25" transform="rotate(-90 18 18)" />
        </svg>
        <div style={{ textAlign: 'center' }}><div className="pv">{s.possR}%</div></div>
      </div>
      <div className="ms-sub">Goals &amp; shots</div>
      <Bar lab="Goals" lv={s.goalsL} rv={s.goalsR} />
      <Bar lab="Shots (votes)" lv={s.L.shots} rv={s.R.shots} />
      <Bar lab="Shots on target" lv={s.L.ot} rv={s.R.ot} />
      <Bar lab="Own goals (vote changes)" lv={s.L.og} rv={s.R.og} />
      <div className="ms-sub">Decisiveness</div>
      <Bar lab="Avg decision time" lv={s.dtL} rv={s.dtR} fmt={(v) => v + 's'} />
      {s.total === 0 && <p className="note center" style={{ marginTop: 14 }}>No shots yet — be the first to vote.</p>}
    </>
  );
}

function PbpPane({ f, t, mId }) {
  const v = Object.values(getVotesFor(mId)).sort((a, b) => a.voteTs - b.voteTs);
  const mc = matchClock(f); const lines = [];
  const nameA = teamName(t.a), nameB = teamName(t.b);
  let seed = 0; for (const c of f.id) seed += c.charCodeAt(0);
  const flavor = ['A real end-to-end contest developing here.', 'The crowd is split and the tension is building.', 'You sense a goal coming.', 'Plenty of conviction in these votes.', 'A patient, probing spell of support.'];
  lines.push({ m: 0, key: 'Kick-off', t: `Kick-off at the ${f.rn}. ${nameA} get us underway against ${nameB}.` });
  let L = 0, R = 0, lastLead = null;
  v.forEach((x) => {
    const el = Math.min(90, Math.max(1, Math.round(((x.voteTs - f.kickoff) / 60000))));
    if (x.side === 'LFT') L++; else R++;
    const lead = L > R ? 'L' : R > L ? 'R' : null;
    if (lead && lead !== lastLead) { lastLead = lead; const team = lead === 'L' ? nameA : nameB; lines.push({ m: el, ev: true, key: 'Goal!', t: `${team} hit the front — a confident shot finds the corner. ${flavor[(seed + el) % flavor.length]}` }); }
    else if ((x.changes || 0) >= 2) { lines.push({ m: el, ev: true, key: 'Own goal', t: 'Disaster — a voter changes their mind once too often and turns it into an own goal.' }); }
  });
  if (mc.phase === 'HT' || mc.min >= 45) lines.push({ m: 45, key: 'Half-time', t: `Half-time. ${L >= R ? nameA : nameB} edge it on shots so far.` });
  if (mc.phase === 'ft') { const w = winnerOf(f.id); lines.push({ m: 90, ev: true, key: 'Full time', t: `Full time. ${w ? teamName(w) : '—'} go through. A deserved result on the balance of the shots.` }); }
  else lines.push({ m: Math.floor(mc.min), key: 'Live', t: flavor[(seed) % flavor.length] });
  const sorted = lines.sort((a, b) => a.m - b.m || 0);
  return (
    <>
      <div className="pbp">
        {sorted.map((l, i) => (
          <div className="pbp-row" key={i}>
            <div className={'pbp-min' + (l.ev ? ' ev' : '')}>{l.m}'</div>
            <div><div className="pbp-key">{l.key}</div><div className="pbp-txt">{l.t}</div></div>
          </div>
        ))}
      </div>
      <p className="note center" style={{ marginTop: 12 }}>Auto-generated from live voting. Guardian-style, second by second.</p>
    </>
  );
}

function MatchChat({ ctx, mId, heightPx }) {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const inpRef = useRef();
  const wrapRef = useRef();
  const cs = getComments(mId);
  useEffect(() => { if (wrapRef.current) wrapRef.current.scrollTop = wrapRef.current.scrollHeight; });
  const send = () => {
    const v = inpRef.current.value.trim(); if (!v) return;
    if (!ctx.id) return requireCheckIn(ctx);
    postComment(mId, ctx.id, myName(ctx.id, ctx.identity?.short), myColor(ctx.id), v);
    inpRef.current.value = ''; rerender();
  };
  return (
    <>
      <div className="chat-wrap" style={{ height: heightPx || 260 }} ref={wrapRef}>
        {cs.length ? cs.map((c, i) => {
          const mine = ctx.id && c.idId === ctx.id;
          const av = <div className="msg-av" style={{ background: c.color || '#333' }}>{((c.name || '?')[0]).toUpperCase()}</div>;
          const body = <div className="msg-body"><div className={'msg-meta' + (mine ? ' mine' : '')}>{c.name} · {ago(c.ts)}</div><div className={'msg-bubble ' + (mine ? 'mine' : 'other')}>{c.text}</div></div>;
          return <div className={'msg' + (mine ? ' mine' : '')} key={i}>{mine ? <>{body}{av}</> : <>{av}{body}</>}</div>;
        }) : <div style={{ color: 'var(--muted-dim)', fontSize: 12, textAlign: 'center', padding: 16 }}>No critiques yet</div>}
      </div>
      <div className="chat-input-row">
        <input className="chat-input" ref={inpRef} placeholder="Add your critique…" maxLength={200} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <button className="chat-send" onClick={send}>Send</button>
      </div>
    </>
  );
}

/* ===== wager modal ===== */
function openWager(ctx, f, rerender) {
  openModal(<WagerModal ctx={ctx} f={f} rerender={rerender} />);
}
function WagerModal({ ctx, f, rerender }) {
  const t = fxTeams(f); const od = matchOdds(f);
  const [pick, setPick] = useState(null);
  const stakeRef = useRef();
  const [err, setErr] = useState('');
  const place = () => {
    const stake = parseInt(stakeRef.current.value, 10);
    if (!pick) return;
    if (!stake || stake <= 0) { setErr('Enter a stake'); return; }
    if (stake > tp().bal) { setErr('Not enough TP'); return; }
    const od2 = matchOdds(f);
    placeWager(f.id, pick, stake, pick === t.a ? od2.a : od2.b);
    closeModal(); toast('Wager placed: ' + stake + ' TP on ' + teamName(pick)); rerender && rerender();
  };
  return (
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <button className="close" onClick={closeModal}>×</button>
      <h2>Wager Taste Points</h2>
      <p className="lead">{f.rn}. Pick a side and stake TP — paid at full time. Balance: {nFmt(tp().bal)} TP.</p>
      <div className="sel-row" style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[t.a, t.b].map((id, i) => (
          <div className="tcard" key={id} style={{ flex: 1, textAlign: 'center', borderColor: pick === id ? '#fff' : '' }} onClick={() => setPick(id)}>
            <img src={rosterImg(id)} alt="" /><div className="nm">{teamName(id)}</div>
            <div className="meta"><span>odds</span><span className="odds">{i === 0 ? od.a : od.b}×</span></div>
          </div>
        ))}
      </div>
      <label>Stake (TP)</label>
      <input type="number" ref={stakeRef} min="1" placeholder="e.g. 250" />
      {err && <div className="err">{err}</div>}
      <button className="b-primary" disabled={!pick} onClick={place}>{pick ? 'Place wager on ' + teamName(pick) : 'Select a side'}</button>
    </div>
  );
}

/* ===== TEAMS ===== */
export function ViewTeams({ ctx }) {
  return (
    <>
      <h1 className="page-title">The Field</h1>
      <p className="page-sub">40 artworks enter — tap a card</p>
      <div className="teams-grid">
        {Array.from({ length: ROSTER_COUNT }, (_, k) => k + 1).map((i) => (
          <div className="tcard" key={i} onClick={() => openTeamCard(ctx, i)}>
            <img src={rosterImg(i)} alt="" />
            <div className="nm">{teamName(i)}</div>
            <div className="meta"><span>Grp {groupLetter(i)} · #{i}</span><span className="odds">{championOdds(i)}×</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
function openTeamCard(ctx, id) {
  let w = 0, l = 0;
  SCHEDULE.forEach((f) => { if (status(f) !== 'ft') return; const t = fxTeams(f); if (t.a !== id && t.b !== id) return; const win = winnerOf(f.id); if (win === id) w++; else if (win) l++; });
  openModal(
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <button className="close" onClick={closeModal}>×</button>
      <img src={rosterImg(id)} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', border: '1px solid #1a1a1a', marginBottom: 14 }} />
      <h2>{teamName(id)}</h2>
      <p className="lead">Group {groupLetter(id)} · Seed #{id}</p>
      <div style={{ display: 'flex', gap: 18, fontFamily: 'var(--mono)', fontSize: 13, marginBottom: 16 }}>
        <div><div style={{ color: 'var(--muted)' }}>Champion odds</div><div style={{ color: 'var(--gold)', fontSize: 18 }}>{championOdds(id)}×</div></div>
        <div><div style={{ color: 'var(--muted)' }}>Record</div><div style={{ fontSize: 18 }}>{w}–{l}</div></div>
      </div>
      <button className="b-primary" onClick={() => { if (!ctx.id) return requireCheckIn(ctx); setPick('r6-0', id); toast('Champion pick: ' + teamName(id)); closeModal(); }}>Make this my champion pick</button>
      <button className="btn-x" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => shareWithEarn(ctx, `My Opepen World Cup champion pick: ${teamName(id)} 🏆 (${championOdds(id)}× odds). Make yours:`)}><XLogo /> Share this pick</button>
    </div>
  );
}

function shareWithEarn(ctx, text) {
  shareOnX(text, () => { if (ctx.id) { if (earnShare()) ctx.rerender(); } });
}

/* ===== BRACKET ===== */
export function ViewBracket({ ctx }) {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  useEffect(() => { resolveWagers(); }, []);
  // Per-second tick so the circular bracket's live ring stays current.
  useEffect(() => { const iv = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(iv); }, []);
  const picks = getPicks();
  return (
    <>
      <h1 className="page-title">Bracket &amp; Schedule</h1>
      <p className="page-sub">Tap a fixture to predict the winner · {predictionCount()} picks made</p>
      <div className="cb-page-wrap"><CircularBracket /></div>
      <div className="center" style={{ marginBottom: 18 }}>
        <button className="btn-x" style={{ display: 'inline-flex' }} onClick={() => {
          shareWithEarn(ctx, `I filled out my Opepen World Cup bracket 🏆 ${predictedChampion() ? 'Champion: ' + teamName(predictedChampion()) : ''} Predict yours:`);
          if (ctx.id && earnOnce('postedBracket', 500, 'Posted bracket')) toast('+500 TP — bracket shared!');
        }}><XLogo /> Share my bracket (+TP)</button>
      </div>
      <div>
        {ROUNDS.map((R) => (
          <React.Fragment key={R.key}>
            <div className="round-head"><h2>{R.name}</h2><span className="adv">{R.adv}</span></div>
            {SCHEDULE.filter((f) => f.rk === R.key).map((f) => {
              const t = fxTeams(f), st = status(f), win = winnerOf(f.id), pick = picks[f.id];
              return (
                <div className={'fx' + (st === 'ft' ? ' fx-ft' : '')} key={f.id} onClick={() => {
                  openMatchDetail(ctx, f, rerender);
                }}>
                  <img src={t.a ? rosterImg(t.a) : '/assets/teams/OpepenWC-Teams-1.webp'} alt="" style={{ opacity: t.a ? 1 : 0.15 }} />
                  <span className={'nm' + (win === t.a ? ' win' : '')}>{t.a ? teamName(t.a) : 'TBD'}</span><span className="vs">v</span>
                  <img src={t.b ? rosterImg(t.b) : '/assets/teams/OpepenWC-Teams-1.webp'} alt="" style={{ opacity: t.b ? 1 : 0.15 }} />
                  <span className={'nm' + (win === t.b ? ' win' : '')}>{t.b ? teamName(t.b) : 'TBD'}</span>
                  <span className="time">{fmtDay(f.kickoff)}<br />{fmtTime(f.kickoff)}</span>
                  <span className={'st ' + st}>{st === 'live' ? 'LIVE' : st === 'ft' ? 'FT' : '·'}</span>
                  {pick && <span className="st" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>★{pick === t.a ? 'L' : 'R'}</span>}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
/* Bracket match-detail modal: artworks + nicknames, score/winner (FT) with the
   winning side highlighted, kickoff date/time, round, and key match stats (when
   there are votes). Predict-winner stays available for upcoming matches. */
function openMatchDetail(ctx, f, rerender) {
  const t = fxTeams(f);
  if (!t.a || !t.b) { flash('Matchup not set yet'); return; }
  const st = status(f);
  const mId = fxMatchId(f);
  const tl = tallyMatch(mId);
  const win = winnerOf(f.id);
  const lWin = st === 'ft' && win === t.a;
  const rWin = st === 'ft' && win === t.b;
  const s = matchStats(mId);
  const hasVotes = s.total > 0;
  const gd = Math.abs((s.goalsL || 0) - (s.goalsR || 0));
  const avg = Math.round((((s.dtL || 0) + (s.dtR || 0)) / 2) * 10) / 10;
  const statRows = [
    ['Goals', `${s.goalsL} – ${s.goalsR}`],
    ['Shots', `${s.L.shots} – ${s.R.shots}`],
    ['Shots on target', `${s.L.ot} – ${s.R.ot}`],
    ['Own goals', `${s.L.og} – ${s.R.og}`],
    ['Avg decision', `${avg}s`],
    ['Goal difference', `+${gd}`],
    ['Possession', `${s.possL}% / ${s.possR}%`],
  ];
  const goPredict = () => { closeModal(); if (!ctx.id) return requireCheckIn(ctx, () => openPredict(ctx, f, t, rerender)); openPredict(ctx, f, t, rerender); };
  openModal(
    <div className="modal md-modal" onClick={(e) => e.stopPropagation()}>
      <button className="close" onClick={closeModal}>×</button>
      <div className="md-round">{roundDisp(f)} · {st === 'ft' ? 'Full time' : st === 'live' ? 'Live now' : 'Upcoming'}</div>
      <div className="md-teams">
        <div className={'md-team' + (lWin ? ' md-win' : '')}>
          <img src={rosterImg(t.a)} alt="" />
          <div className="md-nm">{teamName(t.a)}</div>
          {st !== 'up' && <div className="md-score">{tl.L}</div>}
        </div>
        <div className="md-vs">{st === 'up' ? 'v' : '–'}</div>
        <div className={'md-team' + (rWin ? ' md-win' : '')}>
          <img src={rosterImg(t.b)} alt="" />
          <div className="md-nm">{teamName(t.b)}</div>
          {st !== 'up' && <div className="md-score">{tl.R}</div>}
        </div>
      </div>
      {st === 'ft' && win && <div className="md-result">{teamName(win)} go through</div>}
      <div className="md-meta">
        <span>{fmtDay(f.kickoff)} · {fmtTime(f.kickoff)}</span>
      </div>
      <div className="md-stats">
        <div className="md-stats-h">Match stats</div>
        {statRows.map(([k, val]) => (
          <div className="md-stat-row" key={k}><span className="md-sk">{k}</span><span className="md-sv">{val}</span></div>
        ))}
        {!hasVotes && <p className="note" style={{ textAlign: 'center', marginTop: 10 }}>No shots taken yet.</p>}
      </div>
      {st === 'live' && <button className="b-primary" style={{ marginTop: 18 }} onClick={() => { closeModal(); location.hash = '#/play'; }}>Watch live & vote →</button>}
      {st === 'up' && <button className="b-primary" style={{ marginTop: 18 }} onClick={goPredict}>Predict the winner →</button>}
    </div>
  );
}

function openPredict(ctx, f, t, rerender) {
  const pick = getPicks()[f.id];
  const choose = (team) => { setPick(f.id, team); if (predictionCount() >= 8) earnOnce('postedPredictions', 200, 'Made predictions'); closeModal(); toast('Prediction saved'); rerender(); };
  openModal(
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <button className="close" onClick={closeModal}>×</button>
      <div className="sec-title">{f.rn} · predict the winner</div>
      <div style={{ display: 'flex', gap: 10, margin: '14px 0' }}>
        {[t.a, t.b].map((id) => (
          <div className="tcard" key={id} style={{ flex: 1, textAlign: 'center', borderColor: pick === id ? '#fff' : '' }} onClick={() => choose(id)}>
            <img src={rosterImg(id)} alt="" /><div className="nm">{teamName(id)}</div>
          </div>
        ))}
      </div>
      <p className="note">Your prediction is scored against the crowd's actual result when this match finishes.</p>
    </div>
  );
}

/* ===== STANDINGS ===== */
export function ViewStandings({ ctx }) {
  useEffect(() => { resolveWagers(); }, []);
  const picks = getPicks(); const pts = { r1: 1, r2: 2, r3: 4, r4: 6, r5: 9, r6: 15 };
  let score = 0, correct = 0, decided = 0;
  SCHEDULE.forEach((f) => { const w = winnerOf(f.id); if (w == null) return; decided++; if (picks[f.id] && picks[f.id] === w) { score += pts[f.rk]; correct++; } });
  const players = allPlayers();
  return (
    <>
      <h1 className="page-title">Standings</h1>
      <p className="page-sub">Predictor points + Taste Points</p>
      <div className="scorecard">
        <div className="sec-title">Your predictor score</div>
        <div className="big">{score}<span> pts</span></div>
        <p className="note" style={{ marginTop: 12 }}>{correct} correct of {decided} decided matches · {nFmt(tp().bal)} TP balance</p>
      </div>
      <div className="players">
        <div className="sec-title">Players in the pool ({players.length})</div>
        {players.length ? players.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)).map((p) => (
          <div className="pl-row" key={p.id}>
            <div className="pl-av" style={{ background: p.color || '#333' }}>{((p.name || '?')[0]).toUpperCase()}</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{p.name || 'player'}{p.id === ctx.id ? ' · you' : ''}</div></div>
          </div>
        )) : <div className="note">No players yet.</div>}
      </div>
      <p className="hint" style={{ marginTop: 20 }}>Predictor scoring: Qualifier +1 · Knockout +2 · R10 +4 · Play-In +6 · Semi +9 · Final/Champion +15</p>
    </>
  );
}

/* ===== EARN ===== */
export function ViewEarn({ ctx }) {
  const [, force] = useState(0);
  const rerender = () => { force((n) => n + 1); ctx.rerender(); };
  useEffect(() => { if (ctx.id) resolveWagers(); }, [ctx.id]);
  if (!ctx.id) {
    return (
      <>
        <h1 className="page-title">Earn Taste Points</h1>
        <p className="page-sub">Check in to start earning</p>
        <div className="center"><button className="btn-primary" onClick={() => ctx.login()}>Check in →</button></div>
      </>
    );
  }
  const t = tp(); const today = new Date().toDateString(); const sharesToday = (t.shares || []).filter((d) => d === today).length;
  return (
    <>
      <h1 className="page-title">Taste Points</h1>
      <p className="page-sub">Vote · Predict · Earn · Compete</p>
      <div className="panel" style={{ textAlign: 'center' }}>
        <div className="pl">Your balance</div>
        <div style={{ fontSize: 46, fontWeight: 700, color: 'var(--gold)' }}><AnimatedNumber value={t.bal} /><span style={{ fontSize: 16, color: 'var(--muted)' }}> TP</span></div>
      </div>
      <div className="panel">
        <div className="pl">Share &amp; earn</div>
        <p className="note" style={{ marginTop: 0 }}>Share on X to earn <b style={{ color: 'var(--gold)' }}>+100 TP</b> per share (up to 5/day).</p>
        <div className="progress"><div className="ptrack"><div className="pfill" style={{ width: Math.min(100, sharesToday / 5 * 100) + '%' }} /></div><span>{sharesToday}/5 today</span></div>
        <button className="btn-x" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => {
          const before = tp().bal;
          shareOnX("I'm playing the Opepen World Cup — vote, predict, and earn Taste Points 🏆", () => earnShare());
          setTimeout(() => { if (tp().bal > before) toast('+100 TP — thanks for sharing!'); rerender(); }, 300);
        }}><XLogo /> Share on X</button>
      </div>
      <div className="panel">
        <div className="pl">Ways to earn</div>
        <div className="earn-row"><span>Post your bracket</span><span className={'amt' + (t.flags.postedBracket ? ' done' : '')}>{t.flags.postedBracket ? '✓ earned' : '+500'}</span></div>
        <div className="earn-row"><span>Make 8+ predictions</span><span className={'amt' + (t.flags.postedPredictions ? ' done' : '')}>{t.flags.postedPredictions ? '✓ earned' : '+200'}</span></div>
        <div className="earn-row"><span>Daily check-in</span><span className={'amt' + (t.flags.lastCheckIn === today ? ' done' : '')} style={{ cursor: 'pointer' }} onClick={() => { if (dailyCheckIn()) { toast('+50 TP — checked in!'); rerender(); } }}>{t.flags.lastCheckIn === today ? '✓ today' : '+50 — claim'}</span></div>
      </div>
      <div className="panel">
        <div className="pl">Open wagers</div>
        {(t.wagers || []).filter((w) => w.status === 'open').length ? t.wagers.filter((w) => w.status === 'open').map((w) => (
          <div className="earn-row" key={w.id}><span>{teamName(w.team)} · {w.odds}×</span><span className="amt">{w.stake} TP</span></div>
        )) : <p className="note" style={{ marginTop: 0 }}>No open wagers. Wager from a live match.</p>}
        {(t.wagers || []).filter((w) => w.status !== 'open').slice(0, 5).map((w) => (
          <div className="earn-row" key={w.id}><span>{teamName(w.team)} {w.status === 'won' ? '✓' : '✗'}</span><span className={'amt' + (w.status === 'won' ? ' done' : '')}>{w.status === 'won' ? '+' + w.payout : '-' + w.stake} TP</span></div>
        ))}
      </div>
      <div className="panel">
        <div className="pl">Recent activity</div>
        {t.log.length ? t.log.slice(0, 8).map((e, i) => (
          <div className="earn-row" key={i}><span>{e.r}</span><span className="amt">{e.a > 0 ? '+' : ''}{e.a} TP</span></div>
        )) : <p className="note" style={{ marginTop: 0 }}>Nothing yet.</p>}
      </div>
    </>
  );
}

/* ===== BANTER (gated) ===== */
export function ViewBanter({ ctx }) {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const gPick = !!predictedChampion() || predictionCount() >= 1;
  const gShare = !!tp().flags.sharedOnce;
  // Banter "verified email": with Privy, any authenticated user that HAS an email.
  const gEmail = !!(ctx.identity && ctx.identity.verifiedEmail);
  const unlocked = ctx.id && gPick && gShare && gEmail;
  const inpRef = useRef();
  const wrapRef = useRef();
  useEffect(() => { if (unlocked && wrapRef.current) wrapRef.current.scrollTop = wrapRef.current.scrollHeight; });

  if (!unlocked) {
    const gck = (on, n) => <div className={'gck' + (on ? ' on' : '')}>{on ? '✓' : n}</div>;
    return (
      <>
        <h1 className="page-title">Critique</h1>
        <p className="page-sub">Earn your place at the table</p>
        <div className="gate">
          <div className="gitem">{gck(!!ctx.id, '1')}<div className="gtxt"><div className="t">Check in</div><div className="d">Email, social, or wallet via Privy</div></div></div>
          <div className="gitem">{gck(gPick, '2')}<div className="gtxt"><div className="t">Fill out your bracket</div><div className="d">Predict at least your champion · <a href="#/bracket" style={{ textDecoration: 'underline' }}>go</a></div></div></div>
          <div className="gitem">{gck(gShare, '3')}<div className="gtxt"><div className="t">Post about it on social</div><div className="d">One-click share on X · <a href="#/earn" style={{ textDecoration: 'underline' }}>go</a></div></div></div>
          <div className="gitem">{gck(gEmail, '4')}<div className="gtxt"><div className="t">Verified account</div><div className="d">{gEmail ? 'Verified' : 'Check in with an email (Privy verifies it)'}</div></div></div>
        </div>
        {!ctx.id && <div className="center" style={{ marginTop: 14 }}><button className="btn-primary" onClick={() => ctx.login()}>Check in →</button></div>}
        <p className="hint" style={{ marginTop: 18 }}>Complete all four to unlock the critique.</p>
      </>
    );
  }
  const msgs = getChat();
  const send = () => {
    const v = inpRef.current.value.trim(); if (!v) return;
    postChat(ctx.id, myName(ctx.id, ctx.identity?.short), myColor(ctx.id), v);
    inpRef.current.value = ''; rerender();
  };
  return (
    <>
      <h1 className="page-title">Critique</h1>
      <p className="page-sub">The critics’ table — talk taste</p>
      <div className="chat-wrap" ref={wrapRef}>
        {msgs.length ? msgs.map((mm, i) => {
          const mine = ctx.id && mm.idId === ctx.id;
          const av = <div className="msg-av" style={{ background: mm.color || '#333' }}>{((mm.name || '?')[0]).toUpperCase()}</div>;
          const body = <div className="msg-body"><div className={'msg-meta' + (mine ? ' mine' : '')}>{mm.name} · {ago(mm.ts)}</div><div className={'msg-bubble ' + (mine ? 'mine' : 'other')}>{mm.text}</div></div>;
          return <div className={'msg' + (mine ? ' mine' : '')} key={i}>{mine ? <>{body}{av}</> : <>{av}{body}</>}</div>;
        }) : <div style={{ color: 'var(--muted-dim)', fontSize: 12, textAlign: 'center', padding: 20 }}>No critiques yet — open the floor 👋</div>}
      </div>
      <div className="chat-input-row">
        <input className="chat-input" ref={inpRef} placeholder="Add your critique…" maxLength={300} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <button className="chat-send" onClick={send}>Send</button>
      </div>
    </>
  );
}

/* ===== PROFILE ===== */
export function ViewProfile({ ctx }) {
  const p = ctx.id ? (getProfile(ctx.id) || {}) : {};
  const id = ctx.identity;
  const [color, setColor] = useState(p.color || (ctx.id ? myColor(ctx.id) : '#333'));
  const nameRef = useRef();
  useEffect(() => { if (!ctx.id) location.hash = '#/login'; }, [ctx.id]);
  if (!ctx.id) return null;
  const initial = ((p.name || myName(ctx.id, id?.short))[0] || '?').toUpperCase();
  return (
    <>
      <h1 className="page-title">{p.name ? 'Profile' : 'Set up your profile'}</h1>
      <p className="page-sub">{p.name ? 'Edit your name and color' : 'Pick a name and color to join'}</p>
      <div className="form-wrap">
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span className="me-av" style={{ width: 54, height: 54, fontSize: 22, background: color }}>{initial}</span>
        </div>
        <p className="note" style={{ textAlign: 'center', margin: '0 0 12px' }}>
          {id?.type === 'wallet' ? 'Wallet' : id?.type === 'social' ? 'Account' : 'Email'}: {id?.label} · {nFmt(tp().bal)} TP
        </p>
        <label className="field-label">Display name</label>
        <input className="field-input" ref={nameRef} maxLength={24} defaultValue={p.name || id?.short || ''} placeholder="e.g. Crypt0punk" />
        <label className="field-label">Color</label>
        <div className="swatches">
          {COLORS.map((c) => (
            <div className={'swatch' + (c === color ? ' sel' : '')} key={c} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => {
          const name = nameRef.current.value.trim() || (id?.short || 'player');
          setProfile(ctx.id, { name, color }); dailyCheckIn(); toast('Profile saved'); ctx.rerender(); location.hash = '#/';
        }}>Save profile</button>
        <button className="b-ghost" style={{ marginTop: 10 }} onClick={() => { ctx.logout(); flash('Signed out'); location.hash = '#/'; }}>Sign out</button>
      </div>
    </>
  );
}

/* ===== content pages ===== */
export function ViewRules() {
  return (
    <div className="prose">
      <h1>The Art World Cup</h1>
      <p className="eff">40 artworks enter. One artwork lifts the Cup.</p>
      <h2>Tournament format</h2>
      <ul>
        <li>Qualifying Round: 40 → 20 (4 matches/day)</li><li>Group-Stage Knockouts: 20 → 10 (2/day)</li>
        <li>Round of 10: 10 → 5 (1/day)</li><li>Play-In Match: 5 → 4</li><li>Semi-Finals: 4 → 2</li><li>The Final: 2 → 1 Champion</li>
      </ul>
      <p>Each match is open for <b>90 seconds</b> with a <b>30-second halftime</b> (two 45-second halves). Vote for the artwork you prefer — the one with the most points advances.</p>
      <h2>Every vote is a shot</h2>
      <p>Your vote becomes a shot on goal for the artwork you choose, and how fast you decide shapes the shot:</p>
      <h3>Instant decision</h3><p>You know your favorite immediately — the shot lands near the center of the goal.</p>
      <h3>Quick decision</h3><p>You choose with confidence — the shot lands on target.</p>
      <h3>Slow decision</h3><p>You spend time comparing — the shot lands farther from center.</p>
      <h3>Long decision</h3><p>You struggle to decide — the shot may drift wide, hit the post, or miss completely.</p>
      <h2>Trust your first instinct</h2>
      <p>This competition rewards both popularity and conviction. Artworks that earn fast, confident choices score stronger goals than those that require lengthy deliberation.</p>
      <h2>Changed your mind?</h2>
      <p>You can change your vote before the match closes — but changing it reduces its value. A changed vote may count as a weaker shot, miss the target, or become an <b>own goal</b> for the artwork you abandoned. The more times a vote changes, the greater the chance of an own goal.</p>
      <h2>Match statistics</h2>
      <ul><li>Goals scored</li><li>Shots on target</li><li>Own goals forced</li><li>Average decision time</li><li>Fastest victory</li><li>Goal difference</li><li>Clean sheets</li></ul>
      <h2>The goal</h2>
      <p>To discover the artwork that people love most — and recognize fastest. The champion isn't just the most popular piece; it's the artwork with the strongest instinctive appeal.</p>
    </div>
  );
}
export function ViewAbout() {
  return (
    <div className="prose">
      <h1>About</h1>
      <p>The Opepen World Cup is a social prediction game built around art. Forty artworks enter a World-Cup-style tournament; the crowd votes each match and one artwork lifts the Cup. But you're not just voting — you're a scout, an analyst, and a fan.</p>
      <p>Two competitions run at once: the <b>art tournament</b> (artwork vs artwork, deciding the champion) and the <b>predictor tournament</b> (player vs player, deciding who best predicts it). Earn <b>Taste Points</b> by sharing, predicting, and showing up; wager them on matches; climb the standings.</p>
      <p>Vote. Predict. Earn. Compete. Questions or sponsorships? <a href="#/sponsor">Get in touch</a>.</p>
    </div>
  );
}
export function ViewSponsor() {
  return (
    <div className="prose">
      <h1>Sponsor</h1>
      <p className="eff">Opepenwc26/sponsor</p>
      <p>The ticker at the top of every screen is for sale — your brand in front of every voter, every match, all tournament long.</p>
      <h2>The ticker</h2><p>Ξ0.69 per week. One line, your words, linked to your site.</p>
      <h2>Match presenting</h2><p>Put your product on the arena and results for a featured round. Pricing on request.</p>
      <p>Reach out at <a href="#/sponsor">hello@opepenworldcup.xyz</a>.</p>
    </div>
  );
}
export function ViewTerms() {
  return (
    <div className="prose">
      <h1>Terms</h1>
      <p className="eff">Effective June 11, 2026</p>
      <h2>What this is</h2><p>The Opepen World Cup is a place where people render quick verdicts between two artworks and predict a bracket. Scores, standings, and Taste Points are aggregated crowd opinion and an in-app game currency — they have no monetary value.</p>
      <h2>No real-money gambling</h2><p>Taste Points are earned in-app and cannot be purchased, redeemed, or exchanged for money or anything of value. Wagering with Taste Points is a game mechanic only.</p>
      <h2>Not affiliated</h2><p>Opepen, contract names, and related marks belong to their owners. Their appearance identifies the artwork being voted on and implies no affiliation or endorsement, except where a placement is explicitly labeled as sponsored.</p>
      <h2>Voting</h2><p>One verdict per match per person. Automated voting, manipulation, brigading, and circumventing the one-vote rule are prohibited, and we may discard votes or block access where we see it.</p>
      <h2>Accounts</h2><p>Connecting an identity — by email, social, or wallet via Privy — is required to vote, predict, earn, and chat. You are responsible for activity under your identity.</p>
      <h2>No warranties</h2><p>The service is provided as is, without warranties of any kind. Our total liability is limited to the amount you paid us, which for most people is zero.</p>
      <h2>Changes</h2><p>We may update these terms; continued use after changes means acceptance. Questions: <a href="#/sponsor">hello@opepenworldcup.xyz</a>.</p>
    </div>
  );
}
export function ViewPrivacy() {
  return (
    <div className="prose">
      <h1>Privacy</h1>
      <p className="eff">Effective June 11, 2026</p>
      <h2>What we collect</h2><p>Voting, predictions, and Taste Points: identifiers stored in your browser plus your verdicts, picks, balance, and a display name and color you choose. Check-in is handled by Privy (email, social login, or wallet) — Privy manages the credential and any embedded wallet; we never receive your keys and cannot move funds. No payment info, location, contacts, or third-party trackers beyond Privy auth.</p>
      <h2>What is public</h2><p>Aggregate match results, chat, and your chosen display name/color are visible to the pool. Your bracket, predictions, and Taste Points stay on your own device. Email addresses are never shown publicly.</p>
      <h2>Sharing</h2><p>Share buttons open X's composer with text you can edit; we don't post on your behalf and can't read your X account.</p>
      <h2>Storage</h2><p>Local browser storage holds your picks, points, and identity; shared results, chat, and profiles live in the project database. No tracking cookies.</p>
      <h2>Retention and deletion</h2><p>To delete your identity or data, email <a href="#/sponsor">hello@opepenworldcup.xyz</a>.</p>
      <h2>Changes</h2><p>If this policy changes materially, we'll note it here with a new effective date.</p>
    </div>
  );
}

/* ===== ADMIN ===== */
export function ViewAdmin() {
  const [ok, setOk] = useState(sessionStorage.getItem('owc_admin') === '1');
  useEffect(() => {
    if (ok) return;
    const entry = window.prompt('Enter admin passcode');
    if (entry === null) { location.hash = '#/'; return; }
    if (entry === ADMIN_PASSCODE) { sessionStorage.setItem('owc_admin', '1'); setOk(true); }
    else { flash('Wrong passcode'); location.hash = '#/'; }
  }, []); // eslint-disable-line
  if (!ok) return null;
  return (
    <>
      <h1 className="page-title">Admin</h1>
      <p className="page-sub">Manage the tournament</p>
      <div className="form-wrap">
        <div className="sec-title">Schedule</div>
        <p className="note" style={{ marginTop: 0 }}>First kickoff: <b>{fmtDay(START_BASE)} {fmtTime(START_BASE)}</b>. Change the <code>START_BASE</code> calc near the top of src/lib/game.js to reschedule. {SCHEDULE.length} fixtures over 18 days.</p>
        <div className="sec-title" style={{ marginTop: 22 }}>Roster</div>
        <p className="note" style={{ marginTop: 0 }}>40 images load from <code>/assets/teams/</code>. Replace files there to change the roster.</p>
        <div className="sec-title" style={{ marginTop: 22 }}>Votes</div>
        <button className="b-ghost" onClick={() => { if (confirm('Reset all match votes for everyone?')) { resetAllVotes(); toast('All votes reset'); } }}>Reset ALL match votes</button>
        <div className="sec-title" style={{ marginTop: 22 }}>Session</div>
        <button className="b-ghost" onClick={() => { sessionStorage.removeItem('owc_admin'); location.hash = '#/'; }}>Lock admin</button>
        <p className="note">Data mode: <b>{SHARED ? 'shared (Supabase)' : 'local-only'}</b>.</p>
      </div>
    </>
  );
}
