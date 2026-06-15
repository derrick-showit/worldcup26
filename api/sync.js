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
  return `Find 2026 FIFA World Cup results and current standings using web search. Today is ${new Date().toDateString()}.

Groups:
${groups}

Respond with ONLY this JSON (no markdown, no commentary):
{
 "groupOrder": {"A":["current 1st","current 2nd","current 3rd","current 4th"]},
 "thirds": ["the third-placed teams that have OFFICIALLY qualified to the Round of 32 (only once the group stage is complete)"],
 "reachedR16": ["teams that have officially won their Round of 32 match"],
 "reachedQF": ["the teams officially in the quarter-finals"],
 "reachedSF": ["the teams officially in the semi-finals"],
 "finalists": ["the teams officially in the final"],
 "champion": "the World Cup winner once decided",
 "provisional": true
}
Rules:
- groupOrder: give the CURRENT standings of every group that has played at least one match, ordering all four teams best-to-worst by the official ranking (points, then goal difference, then goals scored). Include groups even if they are NOT finished. Omit only groups with no matches played yet.
- Use the exact team names from the groups list above.
- "provisional": true while the tournament is in progress (group standings not yet final, or no champion); false only once the champion is decided.
- If no matches have been played at all, return {"provisional": true}.`;
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
        model: "claude-sonnet-4-6", // update to a current model string from docs.claude.com if needed
        max_tokens: 2000,
        messages: [{ role: "user", content: buildPrompt() }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    const data = await r.json();
    if (data && data.error) { res.status(500).json({ error: data.error.message || "Anthropic API error" }); return; }
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    let json = {};
    try { json = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { json = {}; }
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
