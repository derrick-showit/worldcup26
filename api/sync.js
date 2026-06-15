// api/sync.js — Vercel serverless function.
// Calls the Anthropic API with web search to fetch live World Cup results.
// Caches results in memory to avoid burning API credits on every request.

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

// In-memory cache — survives across requests on the same warm Vercel instance.
// Worst case (cold start) it just re-fetches. Best case it saves many API calls.
let cached = null;
let cachedAt = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function buildPrompt() {
  const groups = Object.keys(GROUPS).map((g) => `${g}: ${GROUPS[g].join(", ")}`).join("\n");
  return `Search for "2026 FIFA World Cup group standings results" to find current standings. Today is ${new Date().toDateString()}.

Groups:
${groups}

Return ONLY this JSON (no markdown, no text):
{
 "groupOrder": {"A":["1st","2nd","3rd","4th"]},
 "thirds": [],
 "reachedR16": [],
 "reachedQF": [],
 "reachedSF": [],
 "finalists": [],
 "champion": null,
 "provisional": true
}

- groupOrder: current standings for groups with at least one match played. All 4 teams, best to worst. Omit groups with no matches.
- Use EXACT team names from the list above.
- thirds/reachedR16/etc: fill only when those rounds are officially complete.
- provisional: true until a champion is decided.
- Output ONLY valid JSON.`;
}

function tryParse(raw) {
  if (!raw) return null;
  const t = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(t); } catch (x) {}
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch (x) {} }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }

  // Return cached data if fresh
  if (cached && (Date.now() - cachedAt < CACHE_TTL)) {
    res.status(200).json(cached);
    return;
  }

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
        max_tokens: 10000,
        system: "You are a sports data API. Do one web search for current FIFA World Cup 2026 standings, then immediately return the requested JSON. No commentary, no explanation, no extra searches. One search, then JSON.",
        messages: [{ role: "user", content: buildPrompt() }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    const data = await r.json();
    if (data && data.error) {
      res.status(500).json({ error: data.error.message || "Anthropic API error" });
      return;
    }

    const blocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "");
    let json = null;
    for (const cand of [blocks[blocks.length - 1], blocks.join("\n")]) {
      json = tryParse(cand);
      if (json) break;
    }

    const hasData = json && (json.groupOrder || json.champion || json.thirds || json.reachedR16);
    if (!hasData) {
      const snip = blocks.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
      const types = (data.content || []).map(b => b.type).join(",");
      const stopReason = data.stop_reason || "unknown";
      res.status(200).json({ provisional: true, _debug: snip || `(no text blocks — content types: ${types}, stop: ${stopReason})` });
      return;
    }

    // Cache successful results
    cached = json;
    cachedAt = Date.now();
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
