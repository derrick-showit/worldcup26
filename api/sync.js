// api/sync.js — Vercel serverless function.
// Holds the Anthropic API key (server-side only) and runs the live-results web search,
// returning the parsed JSON outcomes object the app scores against.
// Set ANTHROPIC_API_KEY in your environment — a FUNDED key from console.anthropic.com
// (the account/org needs a credit balance, or calls fail with "credit balance too low").

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

function buildPrompt() {
  const groups = Object.keys(GROUPS).map((g) => `${g}: ${GROUPS[g].join(", ")}`).join("\n");
  return `Search the web for "2026 FIFA World Cup results scores" and "2026 FIFA World Cup group standings" to find the latest match results.

The 2026 FIFA World Cup started June 11, 2026. Today is ${new Date().toDateString()}.

The groups are:
${groups}

After searching, respond with ONLY this JSON object (no markdown fences, no commentary, no explanation):
{
 "groupOrder": {"A":["1st place team","2nd place team","3rd place team","4th place team"]},
 "thirds": [],
 "reachedR16": [],
 "reachedQF": [],
 "reachedSF": [],
 "finalists": [],
 "champion": null,
 "provisional": true
}

Rules:
- groupOrder: For every group where at least one match has been played, list all 4 teams ordered by current standings (points, then goal difference, then goals scored). Include groups even if not all matches are done. Omit groups with zero matches played.
- Use the EXACT team names from the groups list above (e.g. "Korea Republic" not "South Korea", "Türkiye" not "Turkey", "Ivory Coast" not "Côte d'Ivoire").
- thirds: only fill once ALL group stage matches are complete — list the best third-placed teams that qualified for the Round of 32.
- reachedR16/reachedQF/reachedSF/finalists/champion: fill only as those rounds are completed.
- provisional: true while tournament is ongoing, false only once a champion is decided.
- If somehow no matches have been played yet, return just: {"provisional": true}
- CRITICAL: Output ONLY valid JSON. No text before or after.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: "Missing ANTHROPIC_API_KEY environment variable" }); return; }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: buildPrompt() }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    const data = await r.json();
    if (data && data.error) {
      res.status(500).json({ error: data.error.message || "Anthropic API error" });
      return;
    }
    // Extract text blocks from the response — web search results come as tool_use/tool_result
    // blocks, but the final answer is in text blocks
    const blocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "");
    const tryParse = (raw) => {
      if (!raw) return null;
      const t = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      try { return JSON.parse(t); } catch (x) {}
      const i = t.indexOf("{"), j = t.lastIndexOf("}");
      if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch (x) {} }
      return null;
    };
    let json = null;
    for (const cand of [blocks[blocks.length - 1], blocks.join("\n")]) {
      json = tryParse(cand);
      if (json) break;
    }
    const hasData = json && (json.groupOrder || json.champion || json.thirds || json.reachedR16);
    if (!hasData) {
      const snip = blocks.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
      const allContent = JSON.stringify((data.content || []).map(b => ({ type: b.type, text: (b.text || "").slice(0, 100) }))).slice(0, 300);
      res.status(200).json({ provisional: true, _debug: snip || "(no text blocks found)", _blocks: allContent });
      return;
    }
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
