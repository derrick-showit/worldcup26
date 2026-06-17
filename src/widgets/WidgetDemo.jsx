/**
 * WidgetDemo.jsx — interactive widget showcase & embed reference
 *
 * Add to your router:
 *   import WidgetDemo from './widgets/WidgetDemo';
 *   <Route path="/widgets" element={<WidgetDemo />} />
 *
 * No API key needed — powered by worldcup26.ir (free, no signup)
 */

import { useState } from "react";
import {
  HubWidget,
  LivescoreWidget,
  StandingsWidget,
  BracketWidget,
  MatchCentreWidget,
  SquadWidget,
  TopscorersWidget,
  TournamentLivescoreWidget,
} from "./WorldCupWidgets";

const WIDGETS = [
  {
    key: "hub",
    label: "Hub",
    desc: "Live count, next match, group leaders",
    snippet: `<HubWidget theme="light" />`,
    Component: HubWidget,
    props: {},
  },
  {
    key: "livescore",
    label: "Livescore",
    desc: "Live + today's scores, refreshes every 30s",
    snippet: `<LivescoreWidget theme="light" />`,
    Component: LivescoreWidget,
    props: {},
  },
  {
    key: "standings",
    label: "Standings",
    desc: "Group table with W/D/L, GF, GA, GD, Pts",
    snippet: `<StandingsWidget\n  group="A"      {/* optional default group */}\n  theme="light"\n/>`,
    Component: StandingsWidget,
    props: {},
  },
  {
    key: "bracket",
    label: "Knockout Bracket",
    desc: "Full bracket R32 → Final",
    snippet: `<BracketWidget theme="light" />`,
    Component: BracketWidget,
    props: {},
  },
  {
    key: "matchcentre",
    label: "Match Centre",
    desc: "Single-match deep dive — score, phase, venue",
    snippet: `<MatchCentreWidget\n  team="United States"  {/* optional team filter */}\n  theme="light"\n/>`,
    Component: MatchCentreWidget,
    props: { team: "United States" },
  },
  {
    key: "squad",
    label: "Squad & Fixtures",
    desc: "Any team's full fixture list and group rivals",
    snippet: `<SquadWidget\n  defaultTeam="United States"\n  theme="light"\n/>`,
    Component: SquadWidget,
    props: { defaultTeam: "United States" },
  },
  {
    key: "topscorers",
    label: "Top Scoring Teams",
    desc: "Teams ranked by goals — group stage",
    snippet: `<TopscorersWidget theme="light" />`,
    Component: TopscorersWidget,
    props: {},
  },
  {
    key: "tournament",
    label: "Tournament Livescore",
    desc: "Full 104-match feed grouped by date",
    snippet: `<TournamentLivescoreWidget theme="light" />`,
    Component: TournamentLivescoreWidget,
    props: {},
  },
];

export default function WidgetDemo() {
  const [theme, setTheme] = useState("light");
  const [active, setActive] = useState("hub");
  const [copied, setCopied] = useState(false);

  const widget = WIDGETS.find(w => w.key === active);
  const { Component, props, snippet } = widget;

  const bg     = theme === "dark" ? "#0e0e0e" : "#f4f4f2";
  const card   = theme === "dark" ? "#1a1a1a" : "#fff";
  const text   = theme === "dark" ? "#f0f0ee" : "#111";
  const muted  = theme === "dark" ? "#555"    : "#888";
  const border = theme === "dark" ? "#2a2a2a" : "#e5e5e3";

  const copy = () => {
    navigator.clipboard.writeText(snippet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ background: bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: text }}>
      {/* Header */}
      <div style={{
        background: "#e63329", color: "#fff",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>⚽ World Cup 2026 Widgets</div>
          <div style={{ fontSize: 11, opacity: .8, marginTop: 1 }}>
            8 free embeddable widgets · no API key · powered by worldcup26.ir
          </div>
        </div>
        <button onClick={() => setTheme(v => v === "light" ? "dark" : "light")} style={{
          padding: "7px 14px", borderRadius: 7,
          border: "1px solid rgba(255,255,255,.35)",
          background: "rgba(255,255,255,.15)",
          color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600,
        }}>
          {theme === "light" ? "🌙 Dark mode" : "☀️ Light mode"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", minHeight: "calc(100vh - 52px)" }}>
        {/* Sidebar */}
        <div style={{ borderRight: `1px solid ${border}`, background: card, padding: "10px 0" }}>
          <div style={{ padding: "4px 14px 8px", fontSize: 10, fontWeight: 700, color: muted, letterSpacing: ".07em" }}>
            WIDGETS
          </div>
          {WIDGETS.map(w => (
            <button key={w.key} onClick={() => setActive(w.key)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "9px 14px", border: "none", cursor: "pointer",
              background: active === w.key ? "#fff0ef" : "transparent",
              borderLeft: `3px solid ${active === w.key ? "#e63329" : "transparent"}`,
              color: active === w.key ? "#e63329" : text,
            }}>
              <div style={{ fontSize: 13, fontWeight: active === w.key ? 700 : 500 }}>{w.label}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 1, lineHeight: 1.4 }}>{w.desc}</div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "22px 26px", overflowY: "auto" }}>
          {/* Embed code */}
          <div style={{
            background: card, border: `1px solid ${border}`,
            borderRadius: 10, marginBottom: 20, overflow: "hidden",
          }}>
            <div style={{
              padding: "8px 14px", background: bg,
              borderBottom: `1px solid ${border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: muted }}>EMBED CODE</span>
              <button onClick={copy} style={{
                fontSize: 12, color: copied ? "#16a34a" : muted,
                background: "none", border: "none", cursor: "pointer", fontWeight: 600,
              }}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <pre style={{
              margin: 0, padding: "12px 14px",
              fontSize: 12, fontFamily: "monospace",
              overflowX: "auto", color: text, lineHeight: 1.6,
            }}>{snippet}</pre>
          </div>

          {/* Live preview */}
          <div style={{ maxWidth: 500 }}>
            <Component theme={theme} {...props} />
          </div>
        </div>
      </div>
    </div>
  );
}
